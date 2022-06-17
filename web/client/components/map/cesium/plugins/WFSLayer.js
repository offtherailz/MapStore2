/**
 * Copyright 2022, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Layers from '../../../../utils/cesium/Layers';
import * as Cesium from 'cesium';
import isEqual from 'lodash/isEqual';
import axios from '../../../../libs/ajax';
import { getFeature } from '../../../../api/WFS';
import { needsReload } from '../../../../utils/WFSLayerUtils';
import { optionsToVendorParams } from '../../../../utils/VendorParamsUtils';
import {
    getStyle,
    layerToGeoStylerStyle,
    applyDefaultStyleToLayer
} from '../../../../utils/VectorStyleUtils';

const requestFeatures = (options, params, cancelToken) => {
    return getFeature(options.url, options.name, {
        // ...(!params?.CQL_FILTER && { bbox: [minx, miny, maxx, maxy, projection].join(',') }),
        outputFormat: 'application/json',
        srsname: 'EPSG:4326',
        ...params
    }, {
        cancelToken
    });
};

const createLayer = (options, map) => {

    let dataSource = new Cesium.GeoJsonDataSource();

    const params = optionsToVendorParams(options);

    const cancelToken = axios.CancelToken;
    const source = cancelToken.source();

    if (options.visibility) {
        requestFeatures(options, params, source.token)
            .then(({ data: collection }) => {
                dataSource.load(collection, {
                    // ensure default style is not applied
                    stroke: new Cesium.Color(0, 0, 0, 0),
                    fill: new Cesium.Color(0, 0, 0, 0),
                    markerColor: new Cesium.Color(0, 0, 0, 0),
                    strokeWidth: 0,
                    markerSize: 0
                }).then(() => {
                    map.dataSources.add(dataSource);
                    layerToGeoStylerStyle(options)
                        .then((style) => {
                            getStyle(applyDefaultStyleToLayer({ ...options, style }), 'cesium')
                                .then((styleFunc) => {
                                    if (styleFunc) {
                                        styleFunc({
                                            entities: dataSource?.entities?.values,
                                            map,
                                            opacity: options.opacity ?? 1
                                        });
                                        map.scene.requestRender();
                                    }
                                });
                        });
                });
            });
    }

    dataSource.show = !!options.visibility;

    return {
        detached: true,
        dataSource,
        remove: () => {
            if (source?.cancel) {
                source.cancel();
            }
            if (dataSource && map) {
                map.dataSources.remove(dataSource);
                dataSource = undefined;
            }
        },
        setVisible: () => {}
    };
};

Layers.registerType('wfs', {
    create: createLayer,
    update: (layer, newOptions, oldOptions, map) => {
        if (needsReload(oldOptions, newOptions)
        || newOptions.visibility !== oldOptions.visibility) {
            return createLayer(newOptions, map);
        }
        if (layer?.dataSource?.entities?.values
            && (
                !isEqual(newOptions.style, oldOptions.style)
                || newOptions.opacity !== oldOptions.opacity
            )
        ) {
            layerToGeoStylerStyle(newOptions)
                .then((style) => {
                    getStyle(applyDefaultStyleToLayer({ ...newOptions, style }), 'cesium')
                        .then((styleFunc) => {
                            if (styleFunc) {
                                styleFunc({
                                    entities: layer.dataSource.entities.values,
                                    map,
                                    opacity: newOptions.opacity ?? 1
                                });
                                map.scene.requestRender();
                            }
                        });
                });
        }
        return null;
    }
});
