/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';

import ConfigUtils from '../ConfigUtils';
import rateLimitManager from '../RateLimitManager';
import { probeBucket, isRateLimitError, resetProbes } from '../RateLimitProbe';

const first = 'http://sample.server/geoserver/wms?SERVICE=WMS&LAYERS=nurc:One&BBOX=1';
const second = 'http://sample.server/geoserver/wms?SERVICE=WMS&LAYERS=nurc:Two&BBOX=2';

describe('RateLimitProbe', () => {
    beforeEach(() => {
        ConfigUtils.setConfigProp('rateLimit', { baseDelay: 1000 });
        rateLimitManager.reset();
        resetProbes();
    });

    afterEach(() => {
        ConfigUtils.removeConfigProp('rateLimit');
        rateLimitManager.reset();
        resetProbes();
    });

    it('recognizes a 429 in the shapes the two engines report it', () => {
        expect(isRateLimitError({ status: 429 })).toBe(true);
        expect(isRateLimitError({ statusCode: 429 })).toBe(true);
        expect(isRateLimitError({ response: { status: 429 } })).toBe(true);
        expect(isRateLimitError({ originalError: { response: { status: 429 } } })).toBe(true);
        expect(isRateLimitError({ status: 500 })).toBe(false);
        expect(isRateLimitError()).toBe(false);
    });

    it('sends one request for the whole server and hands its failure to the others', (done) => {
        let sent = 0;
        const fetchOnce = () => {
            sent++;
            return Promise.reject({ status: 429 });
        };

        const follower = probeBucket(second, {}, fetchOnce).then(() => 'resolved', (e) => e);
        const prober = probeBucket(first, {}, fetchOnce).then(() => 'resolved', (e) => e);

        Promise.all([prober, follower]).then(([a, b]) => {
            try {
                expect(sent).toBe(1);
                expect(a.status).toBe(429);
                expect(b.status).toBe(429);
                done();
            } catch (e) {
                done(e);
            }
        }).catch(done);
    });

    it('holds the requests of the server back while the probe is in flight', (done) => {
        let resolveProbe;
        const probe = probeBucket(first, {}, () => new Promise((resolve) => {
            resolveProbe = resolve;
        }));

        expect(rateLimitManager.getSlotDelay(second) > 0).toBe(true);

        resolveProbe({});
        probe.then(() => {
            // the answer is in, the hold is released even though no 429 arrived
            setTimeout(() => {
                try {
                    expect(rateLimitManager.getSlotDelay(second)).toBe(0);
                    done();
                } catch (e) {
                    done(e);
                }
            }, 0);
        }).catch(done);
    });
});
