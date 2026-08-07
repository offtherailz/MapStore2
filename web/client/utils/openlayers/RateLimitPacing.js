/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { intersects } from 'ol/extent';
import { unByKey } from 'ol/Observable';
import TileState from 'ol/TileState';

import rateLimitManager from '../RateLimitManager';
import { probeBucket, isRateLimitError } from '../RateLimitProbe';

/**
 * Tiles held back from a rate limited server, waiting for the slot they have been given.
 *
 * The way out of the tile queue is the one OpenLayers documents on `Tile#setState`: a tile that
 * cannot be loaded goes to `ERROR`, "otherwise the tile cannot be removed from the tile queue and
 * will block other requests". The way back in is `Tile#load`, which the same file describes as
 * needed "for reloading in case of an error". So a tile that has to wait fails right away, freeing
 * its slot for the layers pointing at healthy servers, and is loaded again once its turn comes.
 *
 * The tiles the view has moved away from stay parked instead of being sent: OpenLayers drops those
 * from its own queue, and a paced tile is out of that queue by definition, so the check has to
 * happen here.
 */
const parkedByMap = new WeakMap();

// a parked tile comes back through the load function, where the slot it was already given must not
// be booked a second time, or it would be pushed one spacing further at every round
const cleared = new WeakSet();

/**
 * The subset of the layer options the throttling looks at, so nothing else of the layer leaks in.
 * @param {object} options the layer options
 * @return {object} bucket options
 */
export const getRateLimitOptions = (options = {}) => ({
    msRateLimitBucket: options.msRateLimitBucket,
    msRateLimitKey: options.msRateLimitKey
});

const getState = (tile) => (typeof tile.getState === 'function' ? tile.getState() : tile.state);

const getEntry = (map) => {
    let entry = parkedByMap.get(map);
    if (!entry) {
        entry = { tiles: new Set(), timer: null, dueAt: Infinity, listener: null };
        parkedByMap.set(map, entry);
    }
    return entry;
};

/**
 * Whether the view still covers the tile. Images of single tile layers carry no coordinate and are
 * always sent, their extent being the view itself.
 */
const isVisible = (map, tile, tileGrid) => {
    if (!tileGrid || !tile.tileCoord) {
        return true;
    }
    const view = map.getView?.();
    const size = map.getSize?.();
    const resolution = view?.getResolution();
    if (!view || !size || !resolution) {
        return true;
    }
    if (tileGrid.getZForResolution(resolution) !== tile.tileCoord[0]) {
        return false;
    }
    return intersects(tileGrid.getTileCoordExtent(tile.tileCoord), view.calculateExtent(size));
};

/**
 * Releases the tiles whose slot has come, and keeps the timer aligned with the next one due.
 * Called with a delay it only arms the timer, called without it does the round.
 * @param {object} map the `ol/Map`
 * @param {number} [delay] milliseconds until the slot of the tile being parked
 */
function pump(map, delay) {
    const entry = getEntry(map);
    const now = rateLimitManager.now();
    if (delay !== undefined) {
        const at = now + Math.max(delay, 0);
        // a round already scheduled for a longer wait must not swallow the one a shorter wait needs
        if (entry.timer !== null && entry.dueAt <= at) {
            return;
        }
        clearTimeout(entry.timer);
        entry.dueAt = at;
        entry.timer = rateLimitManager.scheduler(() => pump(map), Math.max(delay, 0));
        return;
    }
    entry.timer = null;
    entry.dueAt = Infinity;
    // a map without a target paints nowhere, so its tiles have nothing left to wait for: sending
    // them would be a request whose answer is thrown away
    if (typeof map.getTargetElement === 'function' && !map.getTargetElement()) {
        entry.tiles.clear();
        return;
    }
    let next = Infinity;
    entry.tiles.forEach((parked) => {
        // the cache releases the tiles it no longer holds, and a released tile has nothing left to
        // paint on: it is gone for good, not waiting
        if (getState(parked.tile) === TileState.EMPTY) {
            entry.tiles.delete(parked);
            return;
        }
        if (parked.dueAt > now) {
            next = Math.min(next, parked.dueAt);
            return;
        }
        if (!isVisible(map, parked.tile, parked.tileGrid)) {
            return; // stays parked, the next view change asks again
        }
        entry.tiles.delete(parked);
        cleared.add(parked.tile);
        parked.tile.load();
    });
    if (next !== Infinity) {
        pump(map, next - now);
    }
}

const listenToView = (map, entry) => {
    if (entry.listener || typeof map.on !== 'function') {
        return;
    }
    // tiles parked while out of sight are not sent, so the end of a pan is the moment to ask again
    entry.listener = map.on('moveend', () => pump(map));
};

/**
 * Sends the tile, or holds it back until the rate limited server has a slot for it.
 * @param {object} params.map the `ol/Map` the tile belongs to
 * @param {object} params.tile the `ol/ImageTile` or `ol/Image` passed to the load function
 * @param {string} params.src the tile url
 * @param {object} params.options the layer options
 * @param {object} params.tileGrid the tile grid of the source, used to tell whether the tile is still in view
 * @param {function} params.send loads the tile now
 * @param {function} params.fail moves the tile to `ERROR`, which is what frees its queue slot
 */
export const paceTile = ({ map, tile, src, options = {}, tileGrid, send, fail }) => {
    if (cleared.delete(tile)) {
        send();
        return;
    }
    const delay = rateLimitManager.reserveSlot(src, getRateLimitOptions(options));
    if (delay <= 0) {
        send();
        return;
    }
    if (!map) {
        // without a map there is nothing to watch the view with, so waiting in place is the only
        // option left: it is bounded by the slot, unlike the block of a bucket
        rateLimitManager.scheduler(send, delay);
        return;
    }
    const entry = getEntry(map);
    entry.tiles.add({ tile, tileGrid, dueAt: rateLimitManager.now() + delay });
    listenToView(map, entry);
    fail(tile);
    pump(map, delay);
};

/**
 * Forgets the tiles parked for a map, used when the map goes away and by the tests.
 * @param {object} map the `ol/Map`
 */
export const resetPacing = (map) => {
    const entry = map && parkedByMap.get(map);
    if (!entry) {
        return;
    }
    clearTimeout(entry.timer);
    if (entry.listener) {
        unByKey(entry.listener);
    }
    parkedByMap.delete(map);
};

// tile url -> attempts already spent against a rate limited server
const tileRetries = new Map();

/**
 * Options a request has to carry so the throttling looks at the server it is really going to, and
 * not at the proxy the url may have been rewritten to.
 * @param {object} options the layer options
 * @param {string} src the tile url, before any proxy rewriting
 * @return {object} extra axios config
 */
export const rateLimitRequestConfig = (options = {}, src) => ({
    _msRateLimitUrl: src,
    ...getRateLimitOptions(options)
});

/**
 * Config of the request sent only to find out what a native image load hit: the tile owns its
 * retries, so the interceptor must not add its own on top.
 * @param {object} options the layer options
 * @param {string} src the tile url, before any proxy rewriting
 * @return {object} extra axios config
 */
export const probeRequestConfig = (options = {}, src) => ({
    ...rateLimitRequestConfig(options, src),
    _msRateLimitNoRetry: true
});

/**
 * Whether the failure of a tile is only the effect of the throttling, in which case the tile is
 * sent again instead of being blacklisted.
 * @param {object} params.tile the `ol/ImageTile` or `ol/Image`
 * @param {string} params.src the tile url
 * @param {object} params.options the layer options
 * @param {object} params.error the failure to classify
 * @param {function} params.fail moves the tile to `ERROR`
 * @return {boolean} true when the tile has been handed back for another attempt
 */
export const retryRateLimitedTile = ({ tile, src, options = {}, error, fail }) => {
    const rateLimitOptions = getRateLimitOptions(options);
    if (!isRateLimitError(error) || !rateLimitManager.getBucketKey(src, rateLimitOptions)) {
        return false;
    }
    const retries = tileRetries.get(src) || 0;
    if (typeof tile.load !== 'function' || retries >= rateLimitManager.getRetryAttempts()) {
        return false;
    }
    tileRetries.set(src, retries + 1);
    // the tile has to go through ERROR, the only state `Tile#load` accepts to start over, and the
    // only one that gives OpenLayers a fresh image to paint on
    fail(tile);
    tile.load();
    return true;
};

/**
 * Finds out why a tile loaded through a native image failed, the one path whose status is invisible
 * to the application, and reports the answer.
 * @param {string} params.src the tile url
 * @param {object} params.options the layer options
 * @param {function} params.ask sends the request that will tell what the server answers
 * @param {function} params.onFailure called with the failure once it is known
 */
export const explainNativeImageError = ({ src, options = {}, ask, onFailure }) => {
    const rateLimitOptions = getRateLimitOptions(options);
    if (rateLimitManager.isThrottled(src, rateLimitOptions)) {
        // the server is already known to be rate limiting us: the tile waits its turn without
        // spending a request to ask what we already know
        onFailure({ status: 429 });
        return;
    }
    probeBucket(src, rateLimitOptions, ask).catch(onFailure);
};

/**
 * Reports a tile that loaded, so the server can be given part of its rate back.
 * @param {string} src the tile url
 * @param {object} options the layer options
 */
export const registerTileLoaded = (src, options = {}) => {
    tileRetries.delete(src);
    rateLimitManager.registerSuccess(src, getRateLimitOptions(options));
};
