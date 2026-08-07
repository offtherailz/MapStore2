/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';
import TileState from 'ol/TileState';

import ConfigUtils from '../../ConfigUtils';
import rateLimitManager from '../../RateLimitManager';
import { paceTile, resetPacing } from '../RateLimitPacing';

const URL = 'http://sample.server/geoserver/wms?SERVICE=WMS&LAYERS=nurc:Paced';

describe('openlayers RateLimitPacing', () => {
    let now;
    let scheduled;
    let realNow;
    let realScheduler;
    let map;
    let listeners;

    // the tile is only asked for its state, its coordinate and to load again, so the parts of
    // `ol/ImageTile` the pacing touches are all here
    const createTile = (tileCoord = [0, 0, 0]) => ({
        tileCoord,
        state: TileState.IDLE,
        loads: 0,
        getState: function() {
            return this.state;
        },
        load: function() {
            this.state = TileState.LOADING;
            this.loads += 1;
        }
    });

    const fail = (tile) => {
        tile.state = TileState.ERROR;
    };

    // a grid whose tiles are one unit wide, so the tile at x = 0 is in the view below and the one
    // at x = 100 is not
    const tileGrid = {
        getZForResolution: () => 0,
        getTileCoordExtent: ([, x]) => [x, 0, x + 1, 1]
    };

    const createMap = () => {
        listeners = [];
        let extent = [0, 0, 10, 10];
        return {
            setExtent: (value) => {
                extent = value;
            },
            moveEnd: () => listeners.forEach((listener) => listener()),
            getView: () => ({
                getResolution: () => 1,
                calculateExtent: () => extent
            }),
            getSize: () => [256, 256],
            on: (type, listener) => {
                listeners.push(listener);
                return { type };
            }
        };
    };

    // runs the timers whose delay has elapsed, so a test can move time forward in one step
    const tick = (ms) => {
        now += ms;
        const due = scheduled.filter((entry) => entry.at <= now);
        scheduled = scheduled.filter((entry) => entry.at > now);
        due.forEach((entry) => entry.callback());
    };

    beforeEach(() => {
        ConfigUtils.setConfigProp('rateLimit', { baseDelay: 1000, maxDelay: 60000 });
        now = 1000000;
        scheduled = [];
        realNow = rateLimitManager.now;
        realScheduler = rateLimitManager.scheduler;
        rateLimitManager.now = () => now;
        rateLimitManager.scheduler = (callback, delay) => {
            const entry = { callback, at: now + delay };
            scheduled.push(entry);
            return entry;
        };
        rateLimitManager.reset();
        map = createMap();
    });

    afterEach(() => {
        resetPacing(map);
        rateLimitManager.now = realNow;
        rateLimitManager.scheduler = realScheduler;
        rateLimitManager.reset();
        ConfigUtils.removeConfigProp('rateLimit');
    });

    it('sends the tile straight away when the server has never answered 429', () => {
        const tile = createTile();
        let sent = 0;

        paceTile({ map, tile, src: URL, tileGrid, fail, send: () => sent++ });

        expect(sent).toBe(1);
        expect(tile.state).toBe(TileState.IDLE);
    });

    it('fails the tile instead of holding a queue slot, and loads it again when its slot comes', () => {
        rateLimitManager.register429(URL, { 'retry-after': '1' });
        const tile = createTile();
        let sent = 0;

        paceTile({ map, tile, src: URL, tileGrid, fail, send: () => sent++ });

        // the tile is out of the queue right away: nothing was sent and the state frees the slot
        expect(sent).toBe(0);
        expect(tile.state).toBe(TileState.ERROR);
        expect(tile.loads).toBe(0);

        tick(1000);

        expect(tile.loads).toBe(1);
    });

    it('does not book a second slot for a tile coming back after being parked', () => {
        rateLimitManager.register429(URL, { 'retry-after': '1' });
        const tile = createTile();
        let sent = 0;
        const send = () => sent++;

        paceTile({ map, tile, src: URL, tileGrid, fail, send });
        tick(1000);
        // `Tile#load` calls the load function again, which is where the pacing is asked a second time
        paceTile({ map, tile, src: URL, tileGrid, fail, send });

        expect(sent).toBe(1);
        expect(tile.state).toBe(TileState.LOADING);
    });

    it('spaces two tiles of the same server one slot apart', () => {
        rateLimitManager.register429(URL, { 'retry-after': '1' });
        const first = createTile([0, 0, 0]);
        const second = createTile([0, 1, 0]);

        paceTile({ map, tile: first, src: `${URL}&BBOX=1`, tileGrid, fail, send: () => {} });
        paceTile({ map, tile: second, src: `${URL}&BBOX=2`, tileGrid, fail, send: () => {} });

        tick(1000);
        expect(first.loads).toBe(1);
        expect(second.loads).toBe(0);

        tick(1000);
        expect(second.loads).toBe(1);
    });

    it('keeps a tile the view has moved away from parked, and loads it when it comes back', () => {
        rateLimitManager.register429(URL, { 'retry-after': '1' });
        const tile = createTile([0, 100, 0]); // outside the extent of the map above

        paceTile({ map, tile, src: URL, tileGrid, fail, send: () => {} });
        tick(1000);

        expect(tile.loads).toBe(0);

        map.setExtent([99, 0, 110, 10]);
        map.moveEnd();

        expect(tile.loads).toBe(1);
    });

    it('forgets a tile the cache has released', () => {
        rateLimitManager.register429(URL, { 'retry-after': '1' });
        const tile = createTile();

        paceTile({ map, tile, src: URL, tileGrid, fail, send: () => {} });
        tile.state = TileState.EMPTY;
        tick(1000);

        expect(tile.loads).toBe(0);
        expect(tile.state).toBe(TileState.EMPTY);
    });

    it('waits in place when there is no map to watch the view with', () => {
        rateLimitManager.register429(URL, { 'retry-after': '1' });
        const tile = createTile();
        let sent = 0;

        paceTile({ tile, src: URL, tileGrid, fail, send: () => sent++ });

        expect(sent).toBe(0);
        expect(tile.state).toBe(TileState.IDLE);

        tick(1000);
        expect(sent).toBe(1);
    });
});
