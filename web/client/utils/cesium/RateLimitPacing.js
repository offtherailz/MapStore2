/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Cesium from 'cesium';

import rateLimitManager from '../RateLimitManager';

const MIN_RENDER_DELAY = 50; // a render scheduled closer than this costs more than it gains

const scenes = new Set();
let pendingRender = null;
let pendingAt = Infinity;

const requestRenderWhenDue = (delay) => {
    const at = Date.now() + Math.max(delay, MIN_RENDER_DELAY);
    // servers due sooner win: a frame already scheduled for a long backoff must not swallow the
    // one a shorter wait needs
    if (pendingRender !== null && at >= pendingAt) {
        return;
    }
    clearTimeout(pendingRender);
    pendingAt = at;
    pendingRender = setTimeout(() => {
        pendingRender = null;
        pendingAt = Infinity;
        // the viewer runs in requestRenderMode, so without this nothing would ask the scheduler
        // again and the deferred imagery would never be requested
        scenes.forEach((scene) => scene.requestRender());
    }, at - Date.now());
};

/**
 * Spaces out the requests of a rate limited server, leaving the scheduling to Cesium.
 *
 * `Cesium.RequestScheduler` already orders the requests by priority and cancels the ones the view
 * has moved away from. What it has no notion of is time: it issues as fast as its per server slots
 * allow, and a 429 frees its slot in milliseconds, so a lower `maximumRequestsPerServer` does not
 * express `Retry-After` at all. Returning `undefined` from `request` is how the scheduler is told
 * that a request cannot start yet, and the imagery layer asks again on a later frame, which is
 * exactly the deferral this needs.
 *
 * A server that has never answered 429 has no spacing, so nothing changes for a healthy service.
 *
 * @param {object} viewer the `Cesium.Viewer`, whose scene is asked for a new frame when a slot is due
 */
export const installRequestPacing = (viewer) => {
    if (viewer?.scene) {
        scenes.add(viewer.scene);
    }
    if (Cesium.RequestScheduler.request.msRateLimitPaced) {
        return;
    }
    const issue = Cesium.RequestScheduler.request;
    const paced = function(request) {
        const delay = rateLimitManager.getSlotDelay(request?.url);
        let promise;
        if (delay > 0) {
            // leaving the promise undefined is how the scheduler is told that a request cannot
            // start yet, and the imagery layer asks again on a later frame
            requestRenderWhenDue(delay);
        } else {
            promise = issue.call(this, request);
            if (promise) {
                // the slot is taken only when the request actually starts, so the requests the
                // scheduler holds back for its own reasons do not consume the rate
                rateLimitManager.reserveSlot(request.url);
            }
        }
        return promise;
    };
    paced.msRateLimitPaced = true;
    Cesium.RequestScheduler.request = paced;
};

export const uninstallRequestPacing = (viewer) => {
    if (viewer?.scene) {
        scenes.delete(viewer.scene);
    }
    if (!scenes.size) {
        clearTimeout(pendingRender);
        pendingRender = null;
        pendingAt = Infinity;
    }
};
