/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';
import TileQueue from 'ol/TileQueue';
import { DROP } from 'ol/structs/PriorityQueue';
import TileState from 'ol/TileState';

import ConfigUtils from '../../ConfigUtils';
import rateLimitManager from '../../RateLimitManager';
import { installTilePacing } from '../RateLimitPacing';

const URL = 'http://sample.server/geoserver/wms?SERVICE=WMS&LAYERS=nurc:Paced';

const createTile = (src) => ({
    src_: src,
    state: TileState.IDLE,
    getKey: () => src,
    getState: function() {
        return this.state;
    },
    load: function() {
        this.state = TileState.LOADING;
        this.loads = (this.loads || 0) + 1;
        // the real load function reserves the slot for the request it is about to send
        rateLimitManager.wait(src);
    },
    addEventListener: () => {},
    removeEventListener: () => {}
});

const element = (tile) => [tile, 'source-key', [0, 0], 1];

describe('openlayers RateLimitPacing', () => {
    let renders;
    let map;

    const createMap = (priority = () => 1) => {
        renders = 0;
        map = {
            tileQueue_: new TileQueue(priority, () => {}),
            render: () => {
                renders++;
            }
        };
        installTilePacing(map);
        return map;
    };

    beforeEach(() => {
        ConfigUtils.setConfigProp('rateLimit', { baseDelay: 1000, maxDelay: 60000 });
        rateLimitManager.reset();
    });

    afterEach(() => {
        ConfigUtils.removeConfigProp('rateLimit');
        rateLimitManager.reset();
    });

    it('loads every tile when the server has never answered 429', () => {
        createMap();
        const tiles = [createTile(`${URL}&BBOX=1`), createTile(`${URL}&BBOX=2`)];
        tiles.forEach((tile) => map.tileQueue_.enqueue(element(tile)));

        map.tileQueue_.loadMoreTiles(Infinity, Infinity);

        expect(tiles.map((tile) => tile.loads)).toEqual([1, 1]);
        expect(map.tileQueue_.getCount()).toBe(0);
        expect(renders).toBe(0);
    });

    it('holds the tiles back and puts them again in the queue while the server is blocked', () => {
        createMap();
        const tiles = [createTile(`${URL}&BBOX=1`), createTile(`${URL}&BBOX=2`)];
        tiles.forEach((tile) => map.tileQueue_.enqueue(element(tile)));
        rateLimitManager.register429(`${URL}&BBOX=1`, { 'retry-after': '5' });

        map.tileQueue_.loadMoreTiles(Infinity, Infinity);

        expect(tiles.map((tile) => tile.loads)).toEqual([undefined, undefined]);
        // the tiles are still there, so they keep being reordered and dropped by OpenLayers
        expect(map.tileQueue_.getCount()).toBe(2);
    });

    it('asks the map for a new frame when the slot is due', (done) => {
        createMap();
        map.tileQueue_.enqueue(element(createTile(`${URL}&BBOX=1`)));
        rateLimitManager.register429(`${URL}&BBOX=1`, { 'retry-after': '0.1' });

        map.tileQueue_.loadMoreTiles(Infinity, Infinity);

        expect(renders).toBe(0);
        setTimeout(() => {
            try {
                expect(renders).toBe(1);
                done();
            } catch (e) {
                done(e);
            }
        }, 250);
    });

    it('drops a held tile the view no longer wants instead of putting it back', () => {
        let wanted = true;
        createMap(() => (wanted ? 1 : DROP));
        const tile = createTile(`${URL}&BBOX=1`);
        map.tileQueue_.enqueue(element(tile));
        rateLimitManager.register429(`${URL}&BBOX=1`, { 'retry-after': '5' });
        wanted = false;

        map.tileQueue_.loadMoreTiles(Infinity, Infinity);

        expect(tile.loads).toNotExist();
        // OpenLayers still forgets the tiles the view moved away from, the hold does not keep them
        expect(map.tileQueue_.getCount()).toBe(0);
    });

    it('spaces the tiles of the same server one slot apart', (done) => {
        createMap();
        const tiles = [createTile(`${URL}&BBOX=1`), createTile(`${URL}&BBOX=2`)];
        tiles.forEach((tile) => map.tileQueue_.enqueue(element(tile)));
        rateLimitManager.register429(`${URL}&BBOX=1`, { 'retry-after': '0.1' });

        setTimeout(() => {
            map.tileQueue_.loadMoreTiles(Infinity, Infinity);
            try {
                // the first tile reserves the slot, which moves the second one a spacing away
                expect(tiles.filter((tile) => tile.loads).length).toBe(1);
                expect(map.tileQueue_.getCount()).toBe(1);
                done();
            } catch (e) {
                done(e);
            }
        }, 150);
    });

    it('leaves alone the tiles that carry no url, like the reprojected ones', () => {
        createMap();
        const tile = createTile(undefined);
        tile.src_ = undefined;
        map.tileQueue_.enqueue(element(tile));
        rateLimitManager.register429(`${URL}&BBOX=1`, { 'retry-after': '5' });

        map.tileQueue_.loadMoreTiles(Infinity, Infinity);

        expect(tile.loads).toBe(1);
    });
});
