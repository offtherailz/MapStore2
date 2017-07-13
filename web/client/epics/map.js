/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/

const Rx = require('rxjs');
const {changeLayerProperties} = require('../actions/layers');
const {CREATION_ERROR_LAYER} = require('../actions/map');
const {FEATURE_EDITING} = require('../actions/featuregrid');
const {changeDrawingStatus} = require('../actions/draw');
const {currentBackgroundLayerSelector, allBackgroundLayerSelector, getLayerFromId} = require('../selectors/layers');
const {mapTypeSelector} = require('../selectors/maptype');
const {setControlProperty} = require('../actions/controls');
const {isSupportedLayer} = require('../utils/LayersUtils');
const {isSimpleGeomType, getSimpleGeomType} = require('../utils/MapUtils');
const {warning} = require('../actions/notifications');
const {head} = require('lodash');
const {reprojectGeoJson} = require('../utils/CoordinatesUtils');
const assign = require('object-assign');

const handleCreationBackgroundError = (action$, store) =>
    action$.ofType(CREATION_ERROR_LAYER)
    // added delay because the CREATION_ERROR_LAYER needs to be initialized after MAP_CONFIG_LOADED
    .delay(500)
    .filter(a => a.options.id === currentBackgroundLayerSelector(store.getState()).id && a.options.group === "background")
    .switchMap((a) => {
        const maptype = mapTypeSelector(store.getState());
        // consider only the supported backgrounds, removing the layer that generated an error on creation
        const firstSupportedBackgroundLayer = head(allBackgroundLayerSelector(store.getState()).filter(l => {
            return isSupportedLayer(l, maptype) && l.id !== a.options.id;
        }));

        return !!firstSupportedBackgroundLayer ?
        Rx.Observable.from([
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
        ]) : Rx.Observable.of(warning({
            title: "warning",
            message: "notification.noBackgroundLayerSupported",
            action: {
                label: "close"
            },
            position: "tc"
        }));
    });
const handleCreationLayerError = (action$, store) =>
    action$.ofType(CREATION_ERROR_LAYER)
    // added delay because the CREATION_ERROR_LAYER needs to be initialized after MAP_CONFIG_LOADED
    .delay(500)
    .switchMap((a) => {
        const maptype = mapTypeSelector(store.getState());
        return isSupportedLayer(getLayerFromId(store.getState(), a.options.id), maptype) ? Rx.Observable.from([
            changeLayerProperties(a.options.id, {invalid: true})
        ]) : Rx.Observable.empty();
    });

const startEditing = (action$, store) =>
    action$.ofType(FEATURE_EDITING)
    .filter(() => store.getState().featuregrid && store.getState().featuregrid.select && store.getState().featuregrid.select.length > 0)
    .switchMap(() => {
        const isLeaflet = store.getState().maptype.mapType === "leaflet";
        const defaultFeatureProj = "EPSG:4326";
        let newFeatures;
        let feature = head(store.getState().featuregrid.select); // just to be sure there is one feature selected for the editing
        let drawOptions = {
            featureProjection: defaultFeatureProj,
            stopAfterDrawing: true,
            editEnabled: true,
            drawEnabled: false
        };
        if (!isLeaflet) {
            feature = reprojectGeoJson(feature, defaultFeatureProj, store.getState().map.present.projection);
            // feature.geometry.projection = store.getState().map.present.projection;
        } else {
            if (!isSimpleGeomType(feature.geometry.type)) {
                newFeatures = feature.geometry.coordinates.map((coords, idx) => {
                    return assign({}, {
                            type: 'Feature',
                            properties: {...feature.properties},
                            id: feature.geometry.type + idx,
                            geometry: {
                                coordinates: coords,
                                type: getSimpleGeomType(feature.geometry.type)
                            }
                        });
                });
                return Rx.Observable.of(changeDrawingStatus("edit", feature.geometry.type, "featureGrid", isLeaflet ? [{type: "FeatureCollection", features: newFeatures}] : [feature.geometry], drawOptions));
            }
        }

        return Rx.Observable.of(changeDrawingStatus("edit", feature.geometry.type, "featureGrid", isLeaflet ? [feature] : [feature.geometry], drawOptions));
    });

module.exports = {
    handleCreationLayerError,
    handleCreationBackgroundError,
    startEditing
};
