/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/

import {Observable} from 'rxjs';

import { changeLayerProperties, clearLayers } from '../actions/layers';

import {
    CREATION_ERROR_LAYER,
    INIT_MAP,
    ZOOM_TO_EXTENT,
    CHANGE_MAP_CRS,
    changeMapView,
    changeMapLimits
} from '../actions/map';

import {
    configuredExtentCrsSelector,
    configuredRestrictedExtentSelector,
    configuredMinZoomSelector,
    mapSelector,
    mapIdSelector
} from '../selectors/map';

import { loadMapInfo, MAP_CONFIG_LOADED } from '../actions/config';
import { LOGIN_SUCCESS } from '../actions/security';
import { currentBackgroundLayerSelector, allBackgroundLayerSelector, getLayerFromId } from '../selectors/layers';
import { mapTypeSelector } from '../selectors/maptype';
import { mapPaddingSelector } from '../selectors/maplayout';
import { setControlProperty, resetControls } from '../actions/controls';
import { isSupportedLayer } from '../utils/LayersUtils';
import MapUtils from '../utils/MapUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import { warning } from '../actions/notifications';
import { clearWarning as clearMapInfoWarning } from '../actions/mapInfo';
import { removeAllAdditionalLayers } from '../actions/additionallayers';
import { head, isArray, isObject, mapValues } from 'lodash';

export const handleCreationBackgroundError = (action$, store) =>
    action$.ofType(CREATION_ERROR_LAYER)
    // added delay because the CREATION_ERROR_LAYER needs to be initialized after MAP_CONFIG_LOADED
        .delay(500)
        .filter(a => {
            const currentBackground = currentBackgroundLayerSelector(store.value);
            return currentBackground && a.options.id === currentBackground.id && a.options.group === "background";
        })
        .switchMap((a) => {
            const maptype = mapTypeSelector(store.value);
            // consider only the supported backgrounds, removing the layer that generated an error on creation
            const firstSupportedBackgroundLayer = head(allBackgroundLayerSelector(store.value).filter(l => {
                return isSupportedLayer(l, maptype) && l.id !== a.options.id;
            }));

            return !!firstSupportedBackgroundLayer ?
                Observable.from([
                    changeLayerProperties(firstSupportedBackgroundLayer.id, {visibility: true}),
                    setControlProperty('backgroundSelector', 'currentLayer', firstSupportedBackgroundLayer),
                    setControlProperty('backgroundSelector', 'tempLayer', firstSupportedBackgroundLayer),
                    warning({
                        title: "warning",
                        message: "notification.backgroundLayerNotSupported",
                        action: {
                            label: "close"
                        },
                        position: "tc"
                    })
                ]) : Observable.of(warning({
                    title: "warning",
                    message: "notification.noBackgroundLayerSupported",
                    action: {
                        label: "close"
                    },
                    position: "tc"
                }));
        });
export const handleCreationLayerError = (action$, store) =>
    action$.ofType(CREATION_ERROR_LAYER)
    // added delay because the CREATION_ERROR_LAYER needs to be initialized after MAP_CONFIG_LOADED
        .delay(500)
        .switchMap((a) => {
            const maptype = mapTypeSelector(store.value);
            const layer = getLayerFromId(store.value, a.options.id);
            return !!layer && isSupportedLayer(layer, maptype) ? Observable.from([
                changeLayerProperties(a.options.id, {invalid: true})
            ]) : Observable.empty();
        });

export const resetLimitsOnInit = (action$, store) =>
    action$.ofType(MAP_CONFIG_LOADED, CHANGE_MAP_CRS)
        .switchMap(() => {
            const confExtentCrs = configuredExtentCrsSelector(store.value);
            const restrictedExtent = configuredRestrictedExtentSelector(store.value);
            const minZoom = configuredMinZoomSelector(store.value);
            return Observable.of(changeMapLimits({ restrictedExtent, crs: confExtentCrs, minZoom}));
        });

export const resetMapOnInit = action$ =>
    action$.ofType(INIT_MAP).switchMap(() => Observable.of(
        removeAllAdditionalLayers(),
        resetControls(),
        clearLayers(),
        clearMapInfoWarning()
    ));

/**
 * Convert and normalize the extent into an array `minx,miny,maxx, maxy`
 * @param {object|array} extent extent object to normalize
 */
export const toBoundsArray = extent => {
    // clean up extent
    if (isArray(extent)) {
        return extent.map((val) => {
            // MapUtils.getCenterForExtent returns an array of strings sometimes (catalog)
            if (typeof val === 'string' || val instanceof String) {
                return Number(val);
            }
            return val;
        });
    }
    if (isObject(extent)) {
        const numericExtent = mapValues(extent, v => {
            if (typeof v === 'string' || v instanceof String) {
                return Number(v);
            }
            return v;
        });
        return [
            numericExtent.minx,
            numericExtent.miny,
            numericExtent.maxx,
            numericExtent.maxy
        ];
    }
    return null;
};
/**
 * Base implementation of zoom To Extent that becomes a changeMapView operation.
 * It doesn't take into account padding or any other operation
 * @param {object} action
 * @param {object} mapState the map object in state
 */
export const legacyZoomToExtent = (action, mapState) => {
    let zoom = 0;
    let {extent = []} = action;
    let bounds = CoordinatesUtils.reprojectBbox(extent, action.crs, mapState.bbox && mapState.bbox.crs || "EPSG:4326");
    if (bounds) {
        // center by the max. extent defined in the map's config
        let center = CoordinatesUtils.reproject(MapUtils.getCenterForExtent(extent, action.crs), action.crs, 'EPSG:4326');
        // workaround to get zoom 0 for -180 -90... - TODO do it better
        let full = action.crs === "EPSG:4326" && extent && extent[0] <= -180 && extent[1] <= -90 && extent[2] >= 180 && extent[3] >= 90;
        if (full) {
            zoom = 1;
        } else {
            let mapBBounds = CoordinatesUtils.reprojectBbox(extent, action.crs, mapState.projection || "EPSG:4326");
            // NOTE: mapState should contain size !!!
            zoom = MapUtils.getZoomForExtent(mapBBounds, mapState.size, 0, 21, null);
        }
        if (action.maxZoom && zoom > action.maxZoom) {
            zoom = action.maxZoom;
        }
        let newBounds = { minx: bounds[0], miny: bounds[1], maxx: bounds[2], maxy: bounds[3] };
        let newBbox = { ...mapState.bbox, bounds: newBounds };
        return Observable.of(changeMapView(
            center,
            zoom,
            newBbox,
            mapState.size,
            action.mapStateSource,
            mapState.projection,
            mapState.viewerOptions
        ));
    }
    return Observable.empty();
};


/**
 * Implement ZOOM_TO_EXTENT action. If mapHooks are present, it uses ZOOM_TO_EXTENT_HOOK to make the map zoom on it's own
 * (mapping libraries have maxZoom and padding support). Otherwise, triggers a changeMapView to emulate the same operation.
 * @memberof epics.map
 */
export const zoomToExtentEpic = (action$, store) =>
    action$.ofType(ZOOM_TO_EXTENT).switchMap(( action ) => {
        const extent = toBoundsArray(action.extent);
        if (!extent) {
            return Observable.empty();
        }
        const hook = MapUtils.getHook(MapUtils.ZOOM_TO_EXTENT_HOOK);
        const padding = mapPaddingSelector(store.value);
        if (hook) {
            const { crs, maxZoom, options = {} } = action;
            hook(extent, {
                crs,
                padding,
                maxZoom,
                ...options
            });
            return Observable.empty();
        }
        return legacyZoomToExtent({...action, extent}, mapSelector(store.value) );
    });
/**
 * It checks user's permissions on current map on LOGIN_SUCCESS event
 * @memberof epics.map
 * @param {object} action$
 */
export const checkMapPermissions = (action$, store) =>
    action$.ofType(LOGIN_SUCCESS)
        .filter(() => {
            const mapId = mapIdSelector(store.value);
            return mapId; // sometimes mapId is null
        })
        .map(() => {
            const mapId = mapIdSelector(store.value);
            return loadMapInfo(mapId);
        });


export default {
    checkMapPermissions,
    handleCreationLayerError,
    handleCreationBackgroundError,
    resetMapOnInit,
    resetLimitsOnInit,
    zoomToExtentEpic
};
