/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ConfigUtils from './ConfigUtils';

const DEFAULT_CONFIG = {
    enabled: true,
    baseDelay: 1000,
    maxDelay: 60000,
    maxRetries: 3,
    defaultBucket: 'wmsLayer',
    pacingBucket: 'origin',
    bucketRules: []
};

const RATE_LIMIT_STATUS = 429;
const MIN_SPACING = 100; // below this the spacing is noise and the bucket is considered healthy again
const SUCCESSES_BEFORE_RELAXING = 4; // consecutive successes needed before giving part of the rate back
const PROBE_TIMEOUT = 5000; // a probe that does not answer within this stops holding back its bucket
const PROBE_POLL = 150; // how long a held request waits before asking again whether the probe answered
const NOT_LIMITED_MEMORY = 60000; // how long a server that failed for other reasons is left alone
const PACE_FLOOR_MEMORY = 30000; // how long the last rate a server asked for is treated as its real limit

const normalizeConfig = (config = {}) => ({
    ...DEFAULT_CONFIG,
    ...config,
    enabled: config.enabled !== false,
    baseDelay: Number.isFinite(config.baseDelay) ? config.baseDelay : DEFAULT_CONFIG.baseDelay,
    maxDelay: Number.isFinite(config.maxDelay) ? config.maxDelay : DEFAULT_CONFIG.maxDelay,
    maxRetries: config.maxRetries === null || Number.isFinite(config.maxRetries)
        ? config.maxRetries
        : DEFAULT_CONFIG.maxRetries,
    pacingBucket: config.pacingBucket || DEFAULT_CONFIG.pacingBucket,
    bucketRules: Array.isArray(config.bucketRules) ? config.bucketRules : []
});

const getWindowLocation = () => {
    if (typeof window !== 'undefined' && window.location) {
        return window.location.href;
    }
    return 'http://localhost/';
};

export const parseRetryAfter = (retryAfter, now = Date.now()) => {
    if (retryAfter === undefined || retryAfter === null) {
        return null;
    }
    const value = Array.isArray(retryAfter) ? retryAfter[0] : `${retryAfter}`;
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
        return Math.max(0, Number(trimmed) * 1000);
    }
    const retryDate = Date.parse(trimmed);
    if (Number.isNaN(retryDate)) {
        return null;
    }
    return Math.max(0, retryDate - now);
};

export const getHeaderValue = (headers, headerName) => {
    if (!headers) {
        return null;
    }
    if (typeof headers.get === 'function') {
        return headers.get(headerName);
    }
    const key = Object.keys(headers).find((name) => name.toLowerCase() === headerName.toLowerCase());
    return key ? headers[key] : null;
};

const parseUrl = (url) => {
    try {
        return new URL(url, getWindowLocation());
    } catch (e) {
        return null;
    }
};

const getParamValue = (params, paramName) => {
    if (!params) {
        return null;
    }
    if (typeof params.get === 'function') {
        return params.get(paramName) || params.get(paramName.toUpperCase()) || params.get(paramName.toLowerCase());
    }
    const key = Object.keys(params).find((name) => name.toLowerCase() === paramName.toLowerCase());
    return key ? params[key] : null;
};

const getWMSLayersValue = (parsedUrl, options = {}) => {
    const fromUrl = parsedUrl
        ? getParamValue(parsedUrl.searchParams, 'layers') || getParamValue(parsedUrl.searchParams, 'LAYERS')
        : undefined;
    const fromOptions = getParamValue(options.params, 'layers') || getParamValue(options.params, 'LAYERS');
    const value = fromUrl || fromOptions;
    return Array.isArray(value) ? value.join(',') : value;
};

const normalizeLayers = (layers) => layers
    ? `${layers}`.split(',').map((layer) => layer.trim()).filter(Boolean).join(',')
    : '';

const matchesRule = (url, rule) => {
    if (!rule || !rule.urlPattern) {
        return false;
    }
    try {
        return new RegExp(rule.urlPattern).test(url);
    } catch (e) {
        return false;
    }
};

export class RateLimitManager {
    constructor({
        getConfig = () => ConfigUtils.getConfigProp('rateLimit') || {},
        now = () => Date.now(),
        scheduler = (resolve, delay) => setTimeout(resolve, delay)
    } = {}) {
        this.getConfig = getConfig;
        this.now = now;
        this.scheduler = scheduler;
        this.buckets = {};
        this.pacers = {};
    }

    getEffectiveConfig() {
        return normalizeConfig(this.getConfig() || {});
    }

    isEnabled() {
        return this.getEffectiveConfig().enabled;
    }

    getBucketType(url, options = {}, config = this.getEffectiveConfig()) {
        if (options.msRateLimitBucket) {
            return options.msRateLimitBucket;
        }
        const rule = config.bucketRules.find((currentRule) => matchesRule(url, currentRule));
        return rule?.bucket || config.defaultBucket || DEFAULT_CONFIG.defaultBucket;
    }

    getBucketKey(url, options = {}) {
        const config = this.getEffectiveConfig();
        if (!config.enabled || !url) {
            return null;
        }
        if (options.msRateLimitKey) {
            return options.msRateLimitKey;
        }
        const bucketType = this.getBucketType(url, options, config);
        const parsedUrl = parseUrl(url);
        if (!parsedUrl) {
            return url;
        }
        if (bucketType === 'path') {
            return `${parsedUrl.origin}${parsedUrl.pathname}`;
        }
        if (bucketType === 'wmsLayer') {
            const layers = normalizeLayers(getWMSLayersValue(parsedUrl, options));
            return layers
                ? `${parsedUrl.origin}${parsedUrl.pathname}?LAYERS=${layers}`
                : null;
        }
        return parsedUrl.origin;
    }

    getBucket(url, options = {}) {
        const key = this.getBucketKey(url, options);
        if (!key) {
            return null;
        }
        if (!this.buckets[key]) {
            this.buckets[key] = {
                blockedUntil: 0,
                consecutive429: 0
            };
        }
        return this.buckets[key];
    }

    /**
     * The key the pace is kept on, which is not the key the backoff is kept on.
     * A rate limit belongs to the server, while the bucket isolates the layers from each other: two
     * layers of the same service each pacing themselves at the announced rate would together send
     * twice what the service allows. The pace therefore defaults to the origin, and `pacingBucket`
     * narrows it for the services that count per endpoint.
     * @param {string} url the request url
     * @param {object} options bucket options
     * @return {string|null} the pacing key, null when throttling is off
     */
    getPacingKey(url, options = {}) {
        const config = this.getEffectiveConfig();
        if (!config.enabled || !url) {
            return null;
        }
        if (options.msRateLimitPacingKey) {
            return options.msRateLimitPacingKey;
        }
        const pacingBucket = options.msRateLimitPacing || config.pacingBucket;
        if (pacingBucket === 'wmsLayer') {
            return this.getBucketKey(url, options);
        }
        const parsedUrl = parseUrl(url);
        if (!parsedUrl) {
            return url;
        }
        return pacingBucket === 'path'
            ? `${parsedUrl.origin}${parsedUrl.pathname}`
            : parsedUrl.origin;
    }

    getPacer(url, options = {}) {
        const key = this.getPacingKey(url, options);
        if (!key) {
            return null;
        }
        if (!this.pacers[key]) {
            this.pacers[key] = {
                spacing: 0,        // minimum interval between two requests, learnt from Retry-After
                nextAllowedAt: 0,  // instant the next request may leave, moved forward by every reservation
                deferredAt: 0,     // last time a caller was held back, i.e. last sign of a backlog
                probingUntil: 0,   // deadline of the request sent to find out why the server is failing
                notLimitedAt: 0,   // last time a probe answered that this server is failing for other reasons
                floor: 0,          // shortest interval this server has accepted so far, i.e. its known limit
                limitedAt: 0,      // last time this server refused a request
                successStreak: 0
            };
        }
        return this.pacers[key];
    }

    getWaitDelay(url, options = {}) {
        const bucket = this.getBucket(url, options);
        if (!bucket) {
            return 0;
        }
        return Math.max(0, bucket.blockedUntil - this.now());
    }

    /**
     * True while the bucket is spacing its requests, i.e. after a 429 and before it has
     * recovered. A bucket that never answered 429 is never throttled and never paced.
     * @param {string} url the request url
     * @param {object} options bucket options
     * @return {boolean} whether the requests to this bucket are being spaced
     */
    isThrottled(url, options = {}) {
        const key = this.getPacingKey(url, options);
        return !!this.pacers[key] && this.pacers[key].spacing > 0;
    }

    /**
     * How long a request would have to wait before leaving, without taking the slot.
     * Callers that only need to decide whether to hold a request back, like the tile queue, use
     * this and leave the reservation to whoever actually sends the request. Asking and being told
     * to wait counts as a backlog, and keeps the bucket from speeding up.
     * @param {string} url the request url
     * @param {object} options bucket options
     * @return {number} milliseconds to wait, 0 when the request can leave now
     */
    getSlotDelay(url, options = {}) {
        const pacer = this.pacers[this.getPacingKey(url, options)];
        if (!pacer) {
            return 0;
        }
        if (!pacer.spacing) {
            if (pacer.probingUntil > this.now()) {
                pacer.deferredAt = this.now();
                return PROBE_POLL;
            }
            return 0;
        }
        const bucket = this.getBucket(url, options);
        const gate = Math.max(pacer.nextAllowedAt, bucket ? bucket.blockedUntil : 0);
        const delay = Math.max(0, gate - this.now());
        if (delay) {
            pacer.deferredAt = this.now();
        }
        return delay;
    }

    /**
     * Declares that a request is on its way to find out why this bucket is failing.
     * Until it answers, `getSlotDelay` holds back the other requests of the bucket: they would be
     * sent against a server that has just refused a whole viewport, and the answer that is about to
     * arrive may well be that they have to wait.
     * The deadline makes the hold fail open, so a probe that never answers cannot freeze a layer.
     * @param {string} url the request url
     * @param {object} options bucket options
     */
    /**
     * Whether it is worth spending a request to find out why this server is failing.
     * A server that has just answered something other than 429 is failing for its own reasons, and
     * asking it again at every tile of a broken layer is a request every few seconds, for ever.
     * The answer is forgotten after a while and as soon as the server serves something again, so a
     * service that starts rate limiting later is still noticed.
     * @param {string} url the request url
     * @param {object} options bucket options
     * @return {boolean} true when the failure is still worth a question
     */
    shouldProbe(url, options = {}) {
        const pacer = this.pacers[this.getPacingKey(url, options)];
        if (!pacer || !pacer.notLimitedAt) {
            return true;
        }
        return this.now() - pacer.notLimitedAt >= NOT_LIMITED_MEMORY;
    }

    /**
     * Records that a probe found this server failing for reasons other than a rate limit.
     * @param {string} url the request url
     * @param {object} options bucket options
     */
    registerNotRateLimited(url, options = {}) {
        const pacer = this.getPacer(url, options);
        if (pacer) {
            pacer.notLimitedAt = this.now();
        }
    }

    beginProbe(url, options = {}) {
        const pacer = this.getPacer(url, options);
        if (pacer) {
            pacer.probingUntil = this.now() + PROBE_TIMEOUT;
        }
    }

    /**
     * Whether a request sent to find out why this server is failing is still on its way.
     * @param {string} url the request url
     * @param {object} options bucket options
     * @return {boolean} true while the answer is pending
     */
    isProbing(url, options = {}) {
        const pacer = this.pacers[this.getPacingKey(url, options)];
        return !!pacer && pacer.probingUntil > this.now();
    }

    endProbe(url, options = {}) {
        const pacer = this.pacers[this.getPacingKey(url, options)];
        if (pacer) {
            pacer.probingUntil = 0;
        }
    }

    /**
     * Books the next free slot of the bucket for the caller and returns how long it has to
     * wait for it. Reserving moves the bucket forward by one spacing interval, so concurrent
     * callers are handed consecutive slots instead of all waking up together.
     * @param {string} url the request url
     * @param {object} options bucket options
     * @return {number} milliseconds to wait before sending
     */
    reserveSlot(url, options = {}) {
        const pacer = this.getPacer(url, options);
        if (!pacer || !pacer.spacing) {
            return 0;
        }
        const bucket = this.getBucket(url, options);
        const now = this.now();
        const start = Math.max(now, pacer.nextAllowedAt, bucket ? bucket.blockedUntil : 0);
        pacer.nextAllowedAt = start + pacer.spacing;
        if (start > now) {
            pacer.deferredAt = now;
        }
        return start - now;
    }

    wait(url, options = {}) {
        return this.waitReserved(url, options, this.reserveSlot(url, options));
    }

    /**
     * The waiting half of `wait`, for callers that booked the slot themselves and can go on without
     * a promise when the slot is free. Keeping that case synchronous is what lets a request behave
     * exactly as it did before the throttling existed.
     * @param {string} url the request url
     * @param {object} options bucket options
     * @param {number} delay milliseconds returned by `reserveSlot`
     * @return {Promise} resolved when the request may leave
     */
    waitReserved(url, options = {}, delay = 0) {
        if (!delay) {
            return Promise.resolve();
        }
        // a url can be paced without having a bucket of its own: the pace is kept per server while
        // the bucket needs a layer name, which not every request carries
        const bucket = this.getBucket(url, options);
        return new Promise((resolve) => {
            // the reserved instant can be pushed further away by a 429 arriving in the meantime,
            // so the slot is re-checked against the block before letting the request through
            const sendWhenReady = () => {
                const remainingDelay = Math.max(0, (bucket ? bucket.blockedUntil : 0) - this.now());
                if (remainingDelay) {
                    this.scheduler(sendWhenReady, remainingDelay);
                    return;
                }
                resolve();
            };
            this.scheduler(sendWhenReady, delay);
        });
    }

    register429(url, headers, options = {}) {
        const config = this.getEffectiveConfig();
        if (!config.enabled || !url) {
            return {
                shouldRetry: false,
                delay: 0
            };
        }
        const bucket = this.getBucket(url, options);
        if (!bucket) {
            return {
                shouldRetry: false,
                delay: 0
            };
        }
        bucket.consecutive429 += 1;

        const retryAfter = options.retryAfter ?? getHeaderValue(headers, 'retry-after');
        const retryAfterDelay = parseRetryAfter(retryAfter, this.now());
        const exponentialDelay = Math.min(
            config.maxDelay,
            config.baseDelay * Math.pow(2, Math.max(0, bucket.consecutive429 - 1))
        );
        const delay = Math.min(
            config.maxDelay,
            Number.isFinite(retryAfterDelay) ? retryAfterDelay : exponentialDelay
        );
        bucket.blockedUntil = Math.max(bucket.blockedUntil, this.now() + delay);
        const pacer = this.getPacer(url, options);
        if (pacer) {
            // the server just told us how far apart it wants the requests: that interval becomes
            // the pace of every request towards it, not only of the one that was refused
            pacer.notLimitedAt = 0;
            pacer.spacing = delay;
            // the interval it just asked for is its limit as far as we know, and going below it
            // again only earns another refusal
            pacer.floor = Math.max(pacer.floor, delay);
            pacer.limitedAt = this.now();
            pacer.nextAllowedAt = Math.max(pacer.nextAllowedAt, bucket.blockedUntil);
            pacer.successStreak = 0;
        }

        const maxRetries = config.maxRetries;
        // the budget belongs to the single request: a viewport is dozens of concurrent tiles and a
        // shared counter would be spent before most of them had their first retry
        const attempt = Number.isFinite(options.attempt) ? options.attempt : bucket.consecutive429;
        const shouldRetry = maxRetries === null || maxRetries === undefined || attempt <= maxRetries;
        return {
            shouldRetry,
            delay,
            key: this.getBucketKey(url, options),
            status: RATE_LIMIT_STATUS
        };
    }

    registerSuccess(url, options = {}) {
        const pacingKey = this.getPacingKey(url, options);
        if (this.pacers[pacingKey]) {
            // the server is answering again, so whatever a probe found last time is out of date
            this.pacers[pacingKey].notLimitedAt = 0;
        }
        const key = this.getBucketKey(url, options);
        const bucket = key ? this.buckets[key] : null;
        if (!bucket) {
            return;
        }
        bucket.consecutive429 = Math.max(0, bucket.consecutive429 - 1);
        const pacer = this.pacers[pacingKey];
        if (!pacer || !pacer.spacing || ++pacer.successStreak < SUCCESSES_BEFORE_RELAXING) {
            return;
        }
        if (this.now() - pacer.deferredAt < pacer.spacing * 2) {
            // requests are still waiting for a slot: speeding up now would send the whole backlog
            // at once and earn a new 429 straight away
            return;
        }
        pacer.successStreak = 0;
        // a server that has been quiet for long enough may have lifted its limit, and the only way
        // to find out is to try: until then its own interval is the floor, because walking under it
        // buys nothing but another round of refusals
        const floor = this.now() - pacer.limitedAt >= PACE_FLOOR_MEMORY ? 0 : pacer.floor;
        // the rate is given back a half at a time: dropping the spacing in one go would send the
        // whole viewport again and earn a new 429
        const relaxed = Math.max(floor, Math.floor(pacer.spacing / 2));
        if (relaxed >= pacer.spacing) {
            return;
        }
        pacer.spacing = relaxed;
        if (pacer.spacing < MIN_SPACING) {
            pacer.spacing = 0;
            pacer.nextAllowedAt = 0;
        }
    }

    getRetryAttempts() {
        const config = this.getEffectiveConfig();
        if (!config.enabled) {
            return 0;
        }
        return config.maxRetries === null || config.maxRetries === undefined
            ? Number.MAX_SAFE_INTEGER
            : config.maxRetries;
    }

    reset() {
        this.buckets = {};
        this.pacers = {};
    }
}

const rateLimitManager = new RateLimitManager();

export default rateLimitManager;
