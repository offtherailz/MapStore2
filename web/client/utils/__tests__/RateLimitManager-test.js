/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';
import { RateLimitManager, parseRetryAfter } from '../RateLimitManager';

describe('RateLimitManager', () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);

    it('parses Retry-After seconds and HTTP-date values', () => {
        expect(parseRetryAfter('2', now)).toBe(2000);
        expect(parseRetryAfter('Thu, 01 Jan 2026 00:00:10 GMT', now)).toBe(10000);
        expect(parseRetryAfter('Thu, 01 Jan 2025 00:00:10 GMT', now)).toBe(0);
        expect(parseRetryAfter('not a date', now)).toNotExist();
    });

    it('uses exponential backoff when Retry-After is missing', () => {
        let currentTime = now;
        const manager = new RateLimitManager({
            getConfig: () => ({
                baseDelay: 1000,
                maxDelay: 3000
            }),
            now: () => currentTime
        });
        const url = 'https://example.com/geoserver/wms?LAYERS=workspace:layer&BBOX=1,2,3,4';

        expect(manager.register429(url).delay).toBe(1000);
        currentTime += 1000;
        expect(manager.register429(url).delay).toBe(2000);
        currentTime += 2000;
        expect(manager.register429(url).delay).toBe(3000);
    });

    it('caps Retry-After delays with maxDelay', () => {
        const manager = new RateLimitManager({
            getConfig: () => ({
                maxDelay: 3000
            }),
            now: () => now
        });
        const url = 'https://example.com/geoserver/wms?LAYERS=workspace:layer';

        expect(manager.register429(url, { 'Retry-After': '3600' }).delay).toBe(3000);
        expect(manager.getWaitDelay(url)).toBe(3000);
    });

    it('waits until the current bucket backoff has elapsed', (done) => {
        let currentTime = now;
        const manager = new RateLimitManager({
            getConfig: () => ({
                baseDelay: 1000
            }),
            now: () => currentTime,
            scheduler: (resolve, delay) => {
                expect(delay).toBe(1000);
                currentTime += delay;
                resolve();
            }
        });

        const url = 'https://example.com/wms?LAYERS=workspace:layer';
        manager.register429(url);
        manager.wait(url)
            .then(() => {
                expect(manager.getWaitDelay(url)).toBe(0);
                done();
            })
            .catch(done);
    });

    it('keeps queued waiters pending when a later 429 extends the backoff', (done) => {
        let currentTime = now;
        const scheduled = [];
        const manager = new RateLimitManager({
            getConfig: () => ({
                baseDelay: 1000
            }),
            now: () => currentTime,
            scheduler: (resolve, delay) => {
                scheduled.push({ resolve, delay });
            }
        });
        const url = 'https://example.com/wms?LAYERS=workspace:layer';

        manager.register429(url, { 'retry-after': '1' });
        let resolved = false;
        const waitPromise = manager.wait(url).then(() => {
            resolved = true;
        });
        currentTime = now + 500;
        manager.register429(url, { 'retry-after': '2' });

        expect(scheduled.length).toBe(1);
        expect(scheduled[0].delay).toBe(1000);
        currentTime = now + 1000;
        scheduled.shift().resolve();

        expect(resolved).toBe(false);
        expect(scheduled.length).toBe(1);
        expect(scheduled[0].delay).toBe(1500);

        currentTime = now + 2500;
        scheduled.shift().resolve();
        waitPromise
            .then(() => {
                expect(resolved).toBe(true);
                done();
            })
            .catch(done);
    });

    it('decays consecutive failures after a successful response', () => {
        const manager = new RateLimitManager({
            getConfig: () => ({
                baseDelay: 1000,
                maxDelay: 60000
            }),
            now: () => now
        });
        const url = 'https://example.com/wms?LAYERS=workspace:layer';

        manager.register429(url);
        manager.register429(url);
        manager.registerSuccess(url);

        expect(manager.register429(url).delay).toBe(2000);
    });

    it('does not clear an active backoff when another request succeeds', () => {
        const manager = new RateLimitManager({
            getConfig: () => ({
                baseDelay: 1000
            }),
            now: () => now
        });
        const url = 'https://example.com/wms?LAYERS=workspace:layer';

        manager.register429(url);
        manager.registerSuccess(url);

        expect(manager.getWaitDelay(url)).toBe(1000);
    });

    it('does not create a default bucket for MapStore API requests', () => {
        const manager = new RateLimitManager();
        const apiUrl = '/mapstore/rest/geostore/data/1';

        expect(manager.getBucketKey(apiUrl)).toNotExist();
        expect(manager.register429(apiUrl).shouldRetry).toBe(false);
        expect(Object.keys(manager.buckets).length).toBe(0);
    });

    it('normalizes bucket keys by origin, path and WMS layer', () => {
        const manager = new RateLimitManager({
            getConfig: () => ({
                defaultBucket: 'origin',
                bucketRules: [
                    {
                        urlPattern: '.*geoserver/wms.*',
                        bucket: 'wmsLayer'
                    },
                    {
                        urlPattern: '.*tiles.example.org.*',
                        bucket: 'path'
                    }
                ]
            })
        });

        expect(manager.getBucketKey('https://example.com/a?x=1')).toBe('https://example.com');
        expect(manager.getBucketKey('https://tiles.example.org/a/b?x=1')).toBe('https://tiles.example.org/a/b');
        expect(manager.getBucketKey('https://example.com/geoserver/wms?BBOX=1,2,3,4&LAYERS= workspace:layer '))
            .toBe('https://example.com/geoserver/wms?LAYERS=workspace:layer');
    });

    it('honors maxRetries when registering 429 responses', () => {
        const manager = new RateLimitManager({
            getConfig: () => ({
                baseDelay: 1,
                maxRetries: 1
            }),
            now: () => now
        });
        const url = 'https://example.com/wms?LAYERS=workspace:layer';

        expect(manager.register429(url).shouldRetry).toBe(true);
        expect(manager.register429(url).shouldRetry).toBe(false);
    });

    it('paces two layers of the same server on a single rate', () => {
        let currentTime = now;
        const manager = new RateLimitManager({
            getConfig: () => ({ baseDelay: 1000 }),
            now: () => currentTime
        });
        const first = 'https://example.com/geoserver/wms?LAYERS=workspace:one&BBOX=1,2,3,4';
        const second = 'https://example.com/geoserver/wms?LAYERS=workspace:two&BBOX=1,2,3,4';

        manager.register429(first, { 'retry-after': '1' });

        // the second layer has its own bucket but shares the pace of the server
        expect(manager.getBucketKey(first)).toNotBe(manager.getBucketKey(second));
        expect(manager.isThrottled(second)).toBe(true);
        expect(manager.reserveSlot(first)).toBe(1000);
        expect(manager.reserveSlot(second)).toBe(2000);
        expect(manager.reserveSlot(first)).toBe(3000);
    });

    it('keeps the pace per layer when pacingBucket says so', () => {
        const manager = new RateLimitManager({
            getConfig: () => ({ baseDelay: 1000, pacingBucket: 'wmsLayer' }),
            now: () => now
        });
        const first = 'https://example.com/geoserver/wms?LAYERS=workspace:one&BBOX=1,2,3,4';
        const second = 'https://example.com/geoserver/wms?LAYERS=workspace:two&BBOX=1,2,3,4';

        manager.register429(first, { 'retry-after': '1' });

        expect(manager.isThrottled(second)).toBe(false);
        expect(manager.reserveSlot(second)).toBe(0);
    });

    it('holds back the requests of a server while a probe is in flight', () => {
        let currentTime = now;
        const manager = new RateLimitManager({
            getConfig: () => ({ baseDelay: 1000 }),
            now: () => currentTime
        });
        const url = 'https://example.com/geoserver/wms?LAYERS=workspace:layer&BBOX=1,2,3,4';

        expect(manager.getSlotDelay(url)).toBe(0);
        manager.beginProbe(url);
        expect(manager.getSlotDelay(url) > 0).toBe(true);
        manager.endProbe(url);
        expect(manager.getSlotDelay(url)).toBe(0);
    });

    it('keeps the rate a server asked for, instead of walking under it again', () => {
        let currentTime = now;
        const manager = new RateLimitManager({
            getConfig: () => ({ baseDelay: 1000 }),
            now: () => currentTime
        });
        const url = 'https://example.com/geoserver/wms?LAYERS=workspace:layer&BBOX=1,2,3,4';

        manager.register429(url, { 'retry-after': '1' });
        currentTime += 10000;
        for (let i = 0; i < 8; i++) {
            manager.registerSuccess(url);
        }
        expect(manager.reserveSlot(url)).toBe(0);
        // successes at the pace the server asked for are not a reason to go faster than it allows
        expect(manager.reserveSlot(url)).toBe(1000);
    });

    it('gives the rate back a half at a time once the server has been quiet for long', () => {
        let currentTime = now;
        const manager = new RateLimitManager({
            getConfig: () => ({ baseDelay: 1000 }),
            now: () => currentTime
        });
        const url = 'https://example.com/geoserver/wms?LAYERS=workspace:layer&BBOX=1,2,3,4';

        manager.register429(url, { 'retry-after': '1' });
        currentTime += 31000;
        for (let i = 0; i < 4; i++) {
            manager.registerSuccess(url);
        }
        expect(manager.reserveSlot(url)).toBe(0);
        // the limit may have been lifted in the meantime, and trying is the only way to find out
        expect(manager.reserveSlot(url)).toBe(500);
    });

    it('defaults to three retries', () => {
        const manager = new RateLimitManager();

        expect(manager.getRetryAttempts()).toBe(3);
    });
});
