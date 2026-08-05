/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import rateLimitManager from './RateLimitManager';

const probes = new Map();

export const isRateLimitError = (error) => error?.status === 429
    || error?.statusCode === 429
    || error?.response?.status === 429
    || error?.originalError?.response?.status === 429;

/**
 * Sends one request to find out why a server started failing, and shares its answer.
 *
 * Both engines load their tiles with a native image, which exposes no status: the only way to tell
 * a 429 from a broken layer is to ask again through the request stack. A viewport fails as a whole,
 * so asking once per tile would throw a second wave of requests at a server that has just refused
 * the first. The tiles that fail while the answer is on its way reuse it.
 *
 * The manager is told a probe is running, so the requests it paces are held back meanwhile.
 *
 * @param {string} url the url that failed, used to resolve the server
 * @param {object} options bucket options of the layer
 * @param {function} fetchOnce issues the request, only called for the first caller
 * @return {Promise} resolved when the probe request succeeded, rejected with the failure to handle
 */
export const probeBucket = (url, options = {}, fetchOnce) => {
    const key = rateLimitManager.getPacingKey(url, options);
    const running = key && probes.get(key);
    if (running) {
        return running.then((failure) => Promise.reject(failure || new Error(`Request failed: ${url}`)));
    }
    rateLimitManager.beginProbe(url, options);
    const probe = fetchOnce();
    if (key) {
        probes.set(key, probe.then(() => null, (failure) => failure).then((failure) => {
            probes.delete(key);
            rateLimitManager.endProbe(url, options);
            return failure;
        }));
    }
    return probe;
};

export const resetProbes = () => probes.clear();
