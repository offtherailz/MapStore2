/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Layers from '../../../../utils/openlayers/Layers';
import isNil from 'lodash/isNil';
import isEqual from 'lodash/isEqual';
import union from 'lodash/union';
import isArray from 'lodash/isArray';
import axios from '../../../../libs/ajax';
import CoordinatesUtils from '../../../../utils/CoordinatesUtils';
import { getProjection } from '../../../../utils/ProjectionUtils';
import { getConfigProp } from '../../../../utils/ConfigUtils';

import {optionsToVendorParams} from '../../../../utils/VendorParamsUtils';
import {addAuthenticationToSLD, addAuthenticationParameter, getAuthenticationHeaders} from '../../../../utils/SecurityUtils';

import ImageLayer from 'ol/layer/Image';
import ImageState from 'ol/ImageState';
import ImageWMS from 'ol/source/ImageWMS';
import {get} from 'ol/proj';
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';

import VectorTileSource from 'ol/source/VectorTile';
import VectorTileLayer from 'ol/layer/VectorTile';

import { isVectorFormat } from '../../../../utils/VectorTileUtils';
import { isValidResponse } from '../../../../utils/WMSUtils';
import { OL_VECTOR_FORMATS, applyStyle } from '../../../../utils/openlayers/VectorTileUtils';

import { proxySource, getWMSURLs, wmsToOpenlayersOptions, toOLAttributions, generateTileGrid } from '../../../../utils/openlayers/WMSUtils';
import rateLimitManager from '../../../../utils/RateLimitManager';
import { registerSourceBucket } from '../../../../utils/openlayers/RateLimitPacing';

const failTiles = new Set(); // registry of fail tile urls to prevent reloading loops
const rateLimitRetries = new Map(); // tile url -> attempts already spent against a rate limited bucket
const bucketProbes = new Map(); // bucket key -> the fallback request in flight, shared by the tiles failing together
const loadingErrorRefreshState = new Map(); // layer id -> { attempts, windowStart }
const MAX_LOADING_ERROR_REFRESH_ATTEMPTS = 3; // caps refresh() retries within the cooldown window
const LOADING_ERROR_REFRESH_COOLDOWN_MS = 30000; // window resets only after this much quiet time, NOT on every transient recovery (error/success can oscillate every render during a real loop, which would otherwise reset the counter before it ever caps)

/**
 * Flags a tile/image as failed, so the source emits tileloaderror/imageloaderror
 * and stops re-requesting it.
 * Tiled layers get an `ol/ImageTile` (has `setState`), single tile layers get an
 * `ol/Image`, that exposes no setter and needs the state change to be notified manually.
 * @param {object} image the `ol/ImageTile` or `ol/Image` passed to the load function
 */
const setErrorState = (image) => {
    // `EMPTY` is the state OpenLayers assigns when the cache releases a tile that was
    // already in error; moving back to `ERROR` from there makes `Tile.setState` throw
    // `Tile load sequence violation`. Re-flagging a tile still in `ERROR` is a no-op.
    const state = typeof image.getState === 'function' ? image.getState() : image.state;
    if (state === ImageState.ERROR || state === ImageState.EMPTY) {
        return;
    }
    if (image.setState) {
        image.setState(ImageState.ERROR);
        return;
    }
    image.state = ImageState.ERROR;
    image.changed();
};

const getRateLimitOptions = (options = {}) => ({
    msRateLimitBucket: options.msRateLimitBucket,
    msRateLimitKey: options.msRateLimitKey
});

const getRateLimitRequestConfig = (options, src) => ({
    _msRateLimitUrl: src,
    ...getRateLimitOptions(options)
});

// how many times a single tile can be sent again while its bucket is rate limiting us,
// following the same `maxRetries` budget the interceptor applies to the other requests
const getTileRetryBudget = () => rateLimitManager.getRetryAttempts();

const isRateLimitError = (error) => error?.status === 429
    || error?.response?.status === 429
    || error?.originalError?.response?.status === 429;

/**
 * Sends the tile again once the bucket has a slot for it.
 * The tile has to go through `ERROR` first, because that is the only state `Tile#load` accepts
 * to start over, and it is also what gives OpenLayers a fresh image to paint on: the one that
 * failed has already been replaced by the blank placeholder.
 * @param {object} image the `ol/ImageTile` or `ol/Image` passed to the load function
 * @param {string} src the tile url
 * @return {boolean} true when the tile was handed back for another attempt
 */
const retryRateLimitedTile = (image, src) => {
    const retries = rateLimitRetries.get(src) || 0;
    if (typeof image.load !== 'function' || retries >= getTileRetryBudget()) {
        return false;
    }
    rateLimitRetries.set(src, retries + 1);
    setErrorState(image);
    // no delay here: the load function reserves the slot for the request it is about to send,
    // and adding a second wait would space the same tile twice
    image.load();
    return true;
};

const handleLoadError = (image, src, options, error) => {
    const rateLimited = isRateLimitError(error) && !!rateLimitManager.getBucketKey(src, getRateLimitOptions(options));
    if (rateLimited && retryRateLimitedTile(image, src)) {
        return;
    }
    setErrorState(image);
    failTiles.add(src);
    console.error(error);
};

/**
 * Runs the axios fallback of the first tile that fails on a bucket and lets the tiles failing at
 * the same moment reuse its outcome.
 * A whole viewport fails together, and a native image tells nothing about why, so without this
 * every tile would spend a request to ask the same question to a server that is already refusing
 * them. The followers get the answer, not the image: a 429 sends them back to the queue, anything
 * else is the failure they would have found on their own.
 * @param {string} src the tile url, used to resolve the bucket
 * @param {object} options the layer options
 * @param {function} fetchTile issues the fallback request for the tile that probes
 * @return {Promise} resolved when the tile was painted, rejected with the failure to handle
 */
const probeBucket = (src, options, fetchTile) => {
    const key = rateLimitManager.getBucketKey(src, getRateLimitOptions(options));
    const running = key && bucketProbes.get(key);
    if (running) {
        return running.then((failure) => Promise.reject(failure || new Error(`Tile load failed: ${src}`)));
    }
    const rateLimitOptions = getRateLimitOptions(options);
    rateLimitManager.beginProbe(src, rateLimitOptions);
    const probe = fetchTile();
    if (key) {
        bucketProbes.set(key, probe.then(() => null, (failure) => failure).then((failure) => {
            bucketProbes.delete(key);
            rateLimitManager.endProbe(src, rateLimitOptions);
            return failure;
        }));
    }
    return probe;
};

const loadWhenRateLimitAllows = (image, src, options, load) => {
    rateLimitManager.wait(src, getRateLimitOptions(options)).then(load);
};

const loadFunction = (options, headers) => function(image, src) {

    if (failTiles.has(src)) {  // avoids custom reload in cases of tiles that have already returned exceptions
        setErrorState(image);
        return;
    }

    loadWhenRateLimitAllows(image, src, options, () => {
        // fixes #3916, see https://gis.stackexchange.com/questions/175057/openlayers-3-wms-styling-using-sld-body-and-post-request
        let img = image.getImage();
        let newSrc = proxySource(options.forceProxy, src);

        if (typeof window.btoa === 'function' && src.length >= (options.maxLengthUrl || getConfigProp('miscSettings')?.maxURLLength || Infinity)) {
            // GET ALL THE PARAMETERS OUT OF THE SOURCE URL**
            let [url, ...dataEntries] = src.split("&");
            url = proxySource(options.forceProxy, url);

            // SET THE PROPER HEADERS AND FINALLY SEND THE PARAMETERS
            axios.post(url, "&" + dataEntries.join("&"), {
                headers: {
                    "Content-type": "application/x-www-form-urlencoded;charset=utf-8",
                    ...headers
                },
                responseType: 'arraybuffer',
                ...getRateLimitRequestConfig(options, src)
            }).then(response => {
                if (response.status === 200) {
                    const uInt8Array = new Uint8Array(response.data);
                    let i = uInt8Array.length;
                    const binaryString = new Array(i);
                    while (i--) {
                        binaryString[i] = String.fromCharCode(uInt8Array[i]);
                    }
                    const dataImg = binaryString.join('');
                    const type = response.headers['content-type'];
                    if (type.indexOf('image') === 0) {
                        img.src = 'data:' + type + ';base64,' + window.btoa(dataImg);
                    }
                }
            }).catch(e => {
                handleLoadError(image, src, options, e);
            });
        } else {
            if (headers) { // case of custom headers is setted in localConfig, example requestsConfigurationRules
                axios.get(newSrc, {
                    headers,
                    responseType: 'blob',
                    ...getRateLimitRequestConfig(options, src)
                })
                    .then((response) => {
                        return response.data.type === "text/xml"
                            ? response.data.text().then(dataText => ({...response, dataText}))
                            : response;
                    })
                    .then(response => {
                        if (isValidResponse(response)) { // not contains OGC exception
                            image.getImage().src = URL.createObjectURL(response.data);
                        } else {
                            throw new Error(response.dataText);
                        }
                    }).catch(errorMessage => {
                        // a 429 is transient and the tile is sent again, any other failure is
                        // blacklisted as before to prevent reloading loops
                        handleLoadError(image, src, options, errorMessage);
                    });
            } else {
                const rateLimitOptions = getRateLimitOptions(options);
                const fetchThroughAxios = () => axios.get(newSrc, {
                    responseType: 'blob',
                    // the tile owns its retries, the interceptor must not add its own on top
                    _msRateLimitNoRetry: true,
                    ...getRateLimitRequestConfig(options, src)
                })
                    .then((response) => {
                        return response.data.type === "text/xml"
                            ? response.data.text().then(dataText => ({...response, dataText}))
                            : response;
                    })
                    .then((response) => {
                        if (isValidResponse(response)) {
                            image.getImage().src = URL.createObjectURL(response.data);
                        } else {
                            throw new Error(response.dataText);
                        }
                    });
                const onDirectImageError = () => {
                    if (rateLimitManager.isThrottled(src, rateLimitOptions)) {
                        // the bucket is already known to be rate limited: the tile goes back in the
                        // queue without spending a request to ask what it already knows
                        handleLoadError(image, src, options, { status: 429 });
                        return;
                    }
                    probeBucket(src, options, fetchThroughAxios)
                        .catch((errorMessage) => {
                            handleLoadError(image, src, options, errorMessage);
                        });
                };
                if (typeof img.addEventListener === 'function') {
                    // the native path is the only one that does not go through the interceptor, so
                    // its outcome is reported to the manager here, otherwise a bucket paced after a
                    // 429 would never see the successes that let it speed up again
                    img.addEventListener('load', () => {
                        rateLimitRetries.delete(src);
                        rateLimitManager.registerSuccess(src, rateLimitOptions);
                    }, { once: true });
                    img.addEventListener('error', onDirectImageError, { once: true });
                }
                img.src = newSrc;
            }
        }
    });
};

const createLayer = (options, map, mapId) => {
    // the useForElevation in wms types will be deprecated
    // as support for existing configuration
    // we can use this fallback
    if (options.useForElevation) {
        return Layers.createLayer('elevation', {
            ...options,
            provider: 'wms'
        }, map, mapId);
    }
    const urls = getWMSURLs(isArray(options.url) ? options.url : [options.url]);
    let queryParameters = wmsToOpenlayersOptions(options) || {};
    queryParameters = addAuthenticationParameter(urls[0] || '', queryParameters, options.securityToken, options.security?.sourceId);
    const headers = getAuthenticationHeaders(urls[0], options.securityToken, options.security);
    const vectorFormat = isVectorFormat(options.format);
    if (options.singleTile && !vectorFormat) {
        return new ImageLayer({
            msId: options.id,
            opacity: options.opacity !== undefined ? options.opacity : 1,
            visible: options.visibility !== false,
            zIndex: options.zIndex,
            minResolution: options.minResolution,
            maxResolution: options.maxResolution,
            source: new ImageWMS({
                url: urls[0],
                crossOrigin: options.crossOrigin,
                attributions: toOLAttributions(options.credits),
                params: queryParameters,
                ratio: options.ratio || 1,
                imageLoadFunction: loadFunction(options, headers)
            })
        });
    }
    const sourceOptions = {
        attributions: toOLAttributions(options.credits),
        urls: urls,
        crossOrigin: options.crossOrigin,
        params: queryParameters,
        tileGrid: generateTileGrid(options, map),
        tileLoadFunction: loadFunction(options, headers)
    };

    const wmsSource = new TileWMS({ ...sourceOptions });
    registerSourceBucket(wmsSource, options);
    const layerConfig = {
        msId: options.id,
        opacity: options.opacity !== undefined ? options.opacity : 1,
        visible: options.visibility !== false,
        zIndex: options.zIndex,
        minResolution: options.minResolution,
        maxResolution: options.maxResolution
    };
    let layer;
    if (vectorFormat) {
        layer = new VectorTileLayer({
            ...layerConfig,
            source: new VectorTileSource({
                ...sourceOptions,
                format: new OL_VECTOR_FORMATS[options.format]({
                    layerName: '_layer_'
                }),
                tileUrlFunction: (tileCoord, pixelRatio, projection) => wmsSource.tileUrlFunction(tileCoord, pixelRatio, projection)
            })
        });
    } else {

        layer = new TileLayer({
            ...layerConfig,
            source: wmsSource
        });
    }
    layer.set('map', map);
    if (vectorFormat) {
        layer.set('wmsSource', wmsSource);
        if (options.vectorStyle) {
            applyStyle(options.vectorStyle, layer, map);
        }
    }
    return layer;
};

const mustCreateNewLayer = (oldOptions, newOptions) => {
    return (oldOptions.singleTile !== newOptions.singleTile
        || oldOptions.cropToProjectionExtent !== newOptions.cropToProjectionExtent
        || oldOptions.securityToken !== newOptions.securityToken
        || oldOptions.ratio !== newOptions.ratio
        // no way to remove attribution when credits are removed, so have re-create the layer is needed. Seems to be solved in OL v5.3.0, due to the ol commit 9b8232f65b391d5d381d7a99a7cd070fc36696e9 (https://github.com/openlayers/openlayers/pull/7329)
        || oldOptions.credits !== newOptions.credits && !newOptions.credits
        || isVectorFormat(oldOptions.format) !== isVectorFormat(newOptions.format)
        || isVectorFormat(oldOptions.format) && isVectorFormat(newOptions.format) && oldOptions.format !== newOptions.format
        || oldOptions.localizedLayerStyles !== newOptions.localizedLayerStyles
        || oldOptions.tileSize !== newOptions.tileSize
        || oldOptions.forceProxy !== newOptions.forceProxy
        || oldOptions.tileGridStrategy !== newOptions.tileGridStrategy
        || !isEqual(oldOptions.tileGrids, newOptions.tileGrids)
        || !isEqual(oldOptions.security, newOptions.security)
        || !isEqual(oldOptions.requestRuleRefreshHash, newOptions.requestRuleRefreshHash)
    );
};

Layers.registerType('wms', {
    create: createLayer,
    update: (layer, newOptions, oldOptions, map) => {
        const newIsVector = isVectorFormat(newOptions.format);

        if (mustCreateNewLayer(oldOptions, newOptions)) {
            // TODO: do we need to clean anything before re-creating stuff from scratch?
            return createLayer(newOptions, map);
        }
        let needsRefresh = false;
        if (newIsVector && newOptions.vectorStyle && !isEqual(newOptions.vectorStyle, oldOptions.vectorStyle || {})) {
            applyStyle(newOptions.vectorStyle, layer, map);
            needsRefresh = true;
        }

        const wmsSource = layer.get('wmsSource') || layer.getSource();
        const vectorSource = newIsVector ? layer.getSource() : null;

        if (oldOptions.srs !== newOptions.srs) {
            const normalizedSrs = CoordinatesUtils.normalizeSRS(newOptions.srs, newOptions.allowedSRS);
            const extent = get(normalizedSrs).getExtent() || getProjection(normalizedSrs).extent;
            if (newOptions.singleTile && !newIsVector) {
                layer.setExtent(extent);
            } else {
                const tileGrid = generateTileGrid(newOptions, map);
                wmsSource.tileGrid = tileGrid;
                if (vectorSource) {
                    vectorSource.tileGrid = tileGrid;
                }
            }
            needsRefresh = true;
        }

        if (oldOptions.credits !== newOptions.credits && newOptions.credits) {
            wmsSource.setAttributions(toOLAttributions(newOptions.credits));
            needsRefresh = true;
        }

        let changed = false;
        let oldParams;
        let newParams;
        if (oldOptions && wmsSource && wmsSource.updateParams) {
            if (oldOptions.params && newOptions.params) {
                changed = union(
                    Object.keys(oldOptions.params),
                    Object.keys(newOptions.params)
                ).reduce((found, param) => {
                    if (newOptions.params[param] !== oldOptions.params[param]) {
                        return true;
                    }
                    return found;
                }, false);
            } else if ((!oldOptions.params && newOptions.params) || (oldOptions.params && !newOptions.params)) {
                changed = true;
            }
            oldParams = wmsToOpenlayersOptions(oldOptions);
            newParams = wmsToOpenlayersOptions(newOptions);
            changed = changed || ["LAYERS", "STYLES", "FORMAT", "TRANSPARENT", "TILED", "VERSION", "_v_", "CQL_FILTER", "SLD", "VIEWPARAMS", "SRS", "CRS"].reduce((found, param) => {
                if (oldParams[param] !== newParams[param]) {
                    return true;
                }
                return found;
            }, false);

            needsRefresh = needsRefresh || changed;
        }
        // refresh/update wms layer if there is error in loading tiles like: incorrect time dimension date filter, ..etc
        if (oldOptions.loadingError !== "Error" && newOptions.loadingError === "Error") {
            const now = Date.now();
            const prev = loadingErrorRefreshState.get(newOptions.id);
            // only start a new cooldown window if the previous one has fully expired;
            // do NOT reset on every transient recovery, or a fast error/success oscillation
            // (a real reload loop) would clear the counter before it ever caps
            const windowExpired = !prev || (now - prev.windowStart) > LOADING_ERROR_REFRESH_COOLDOWN_MS;
            const attempts = windowExpired ? 1 : prev.attempts + 1;
            loadingErrorRefreshState.set(newOptions.id, { attempts, windowStart: windowExpired ? now : prev.windowStart });
            if (attempts <= MAX_LOADING_ERROR_REFRESH_ATTEMPTS) {
                // Clear tile cache before refresh to avoid showing old broken tiles
                wmsSource?.tileCache?.pruneExceptNewestZ?.();
                wmsSource?.refresh();
            }
        }
        if (oldOptions.minResolution !== newOptions.minResolution) {
            layer.setMinResolution(newOptions.minResolution === undefined ? 0 : newOptions.minResolution);
        }
        if (oldOptions.maxResolution !== newOptions.maxResolution) {
            layer.setMaxResolution(newOptions.maxResolution === undefined ? Infinity : newOptions.maxResolution);
        }
        if (needsRefresh) {
            // forces tile cache drop
            // this prevents old cached tiles at lower zoom levels to be
            // rendered during new params load
            wmsSource?.tileCache?.pruneExceptNewestZ?.();
            if (vectorSource) {
                vectorSource.clear();
                vectorSource.refresh();
            }

            if (changed) {
                const params = Object.assign(newParams, addAuthenticationToSLD(optionsToVendorParams(newOptions) || {}, newOptions));

                wmsSource.updateParams(Object.assign(params, Object.keys(oldParams || {}).reduce((previous, key) => {
                    return !isNil(params[key]) ? previous : Object.assign(previous, {
                        [key]: undefined
                    });
                }, {})));
            }
        }
        return null;
    }
});
