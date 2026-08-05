/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { getUid } from 'ol/util';
import TileState from 'ol/TileState';

import rateLimitManager from '../RateLimitManager';

const MIN_RENDER_DELAY = 50; // a render scheduled closer than this costs more than it gains

const bucketOptionsBySource = new Map();

/**
 * Associates a tile source with the bucket options of its layer, so the tile queue can ask the
 * rate limit manager about a tile without having the layer configuration at hand.
 * @param {object} source the `ol/source/Tile` of the layer
 * @param {object} options the layer options
 */
export const registerSourceBucket = (source, options = {}) => {
    if (!source) {
        return;
    }
    bucketOptionsBySource.set(getUid(source), {
        msRateLimitBucket: options.msRateLimitBucket,
        msRateLimitKey: options.msRateLimitKey
    });
};

export const unregisterSourceBucket = (source) => {
    if (source) {
        bucketOptionsBySource.delete(getUid(source));
    }
};

/**
 * Spaces out the tiles of a rate limited bucket, leaving the scheduling to OpenLayers.
 *
 * `ol/TileQueue` already orders the tiles by distance from the center of the view and forgets the
 * ones the view has moved away from, both of which are lost by anyone queueing tiles on the side.
 * What it has no notion of is time: it empties the queue as fast as the loading limit allows. This
 * replaces its `loadMoreTiles` with one that skips the tiles whose bucket has no free slot yet and
 * puts them back in the queue, so they keep being reordered and dropped as usual, and asks the map
 * for a new frame when the slot is due.
 *
 * A bucket that has never answered 429 has no spacing, so nothing here changes for a healthy
 * server: the skip never triggers and the queue behaves exactly as the OpenLayers one.
 *
 * @param {object} map the `ol/Map`
 */
export const installTilePacing = (map) => {
    const queue = map?.tileQueue_;
    if (!queue || queue.msRateLimitPaced) {
        return;
    }
    queue.msRateLimitPaced = true;

    let pendingRender = null;
    let pendingAt = Infinity;
    const renderIn = (delay) => {
        const at = Date.now() + Math.max(delay, MIN_RENDER_DELAY);
        // buckets due sooner win: a frame already scheduled for a long backoff must not swallow
        // the one a shorter wait needs
        if (pendingRender !== null && at >= pendingAt) {
            return;
        }
        clearTimeout(pendingRender);
        pendingAt = at;
        pendingRender = setTimeout(() => {
            pendingRender = null;
            pendingAt = Infinity;
            map.render();
        }, at - Date.now());
    };

    queue.loadMoreTiles = function(maxTotalLoading, maxNewLoads) {
        const deferred = [];
        let newLoads = 0;
        let nextSlot = Infinity;
        while (
            this.tilesLoading_ < maxTotalLoading &&
            newLoads < maxNewLoads &&
            this.getCount() > 0
        ) {
            const element = this.dequeue();
            const tile = element[0];
            const tileKey = tile.getKey();
            if (tile.getState() !== TileState.IDLE || tileKey in this.tilesLoadingKeys_) {
                continue;
            }
            // `src_` is the url the tile will request: reprojected or composite tiles have none and
            // are left to the standard behaviour
            const src = tile.src_;
            const delay = src ? rateLimitManager.getSlotDelay(src, bucketOptionsBySource.get(element[1])) : 0;
            if (delay > 0) {
                nextSlot = Math.min(nextSlot, delay);
                deferred.push(element);
                continue;
            }
            this.tilesLoadingKeys_[tileKey] = true;
            ++this.tilesLoading_;
            ++newLoads;
            // the load function reserves the slot for the request it is about to send, which is
            // what makes the next tile of the same bucket see a delay here
            tile.load();
        }
        deferred.forEach((element) => this.enqueue(element));
        if (nextSlot !== Infinity) {
            renderIn(nextSlot);
        }
    };
};
