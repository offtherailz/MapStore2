/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';
import * as Cesium from 'cesium';

import ConfigUtils from '../../ConfigUtils';
import rateLimitManager from '../../RateLimitManager';
import { installRequestPacing, uninstallRequestPacing } from '../RateLimitPacing';

const URL = 'http://sample.server/geoserver/wms?SERVICE=WMS&LAYERS=nurc:Paced&BBOX=1';

describe('cesium RateLimitPacing', () => {
    let issued;
    let renders;
    let viewer;
    let original;

    beforeEach(() => {
        ConfigUtils.setConfigProp('rateLimit', { baseDelay: 1000, maxDelay: 60000 });
        rateLimitManager.reset();
        issued = [];
        renders = 0;
        original = Cesium.RequestScheduler.request;
        Cesium.RequestScheduler.request = (request) => {
            issued.push(request.url);
            return Promise.resolve();
        };
        viewer = { scene: { requestRender: () => {
            renders++;
        } } };
        installRequestPacing(viewer);
    });

    afterEach(() => {
        uninstallRequestPacing(viewer);
        Cesium.RequestScheduler.request = original;
        ConfigUtils.removeConfigProp('rateLimit');
        rateLimitManager.reset();
    });

    it('issues the request when the server has never answered 429', () => {
        const promise = Cesium.RequestScheduler.request({ url: URL });

        expect(issued).toEqual([URL]);
        expect(promise).toExist();
        expect(renders).toBe(0);
    });

    it('holds the request back while the server is blocked', () => {
        rateLimitManager.register429(URL, { 'retry-after': '5' });

        const promise = Cesium.RequestScheduler.request({ url: URL });

        expect(issued).toEqual([]);
        // undefined is how the scheduler is told to ask again later
        expect(promise).toNotExist();
    });

    it('asks the scene for a new frame when the slot is due', (done) => {
        rateLimitManager.register429(URL, { 'retry-after': '0.1' });

        Cesium.RequestScheduler.request({ url: URL });

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

    it('takes a slot only when the request actually starts', (done) => {
        rateLimitManager.register429(URL, { 'retry-after': '0.1' });

        setTimeout(() => {
            try {
                expect(Cesium.RequestScheduler.request({ url: URL })).toExist();
                // the first one took the slot, the second waits a spacing
                expect(Cesium.RequestScheduler.request({ url: URL })).toNotExist();
                expect(issued.length).toBe(1);
                done();
            } catch (e) {
                done(e);
            }
        }, 150);
    });

    it('does not take a slot for a request the scheduler itself held back', (done) => {
        Cesium.RequestScheduler.request = () => undefined;
        installRequestPacing(viewer);
        rateLimitManager.register429(URL, { 'retry-after': '0.05' });

        setTimeout(() => {
            try {
                expect(rateLimitManager.getSlotDelay(URL)).toBe(0);
                Cesium.RequestScheduler.request({ url: URL });
                // the request never started, so the next one still finds the slot free
                expect(rateLimitManager.getSlotDelay(URL)).toBe(0);
                done();
            } catch (e) {
                done(e);
            }
        }, 100);
    });
});
