/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
    LOAD_FIELDS,
    LOAD_CLASSIFICATION,
    fieldsLoaded,
    fieldsError,
    classificationLoaded,
    classificationError
} from '../actions/thematic';

import { UPDATE_NODE, changeLayerParams } from '../actions/layers';
import {Observable} from 'rxjs';
import axios from '../libs/ajax';
import { head } from 'lodash';

export default (config) => ({
    loadFieldsEpic: (action$) =>
        action$.ofType(LOAD_FIELDS)
            .switchMap((action) => {
                if (action.layer.thematic && action.layer.thematic.fields) {
                    return Observable.of(fieldsLoaded(action.layer, action.layer.thematic.fields)).delay(0);
                }
                const url = config.getFieldsService(action.layer);
                return Observable.defer(() => axios.get(url))
                    .switchMap((response) => Observable.of(fieldsLoaded(action.layer, config.readFields(response.data))))
                    .catch(e => Observable.of(fieldsError(action.layer, e)));
            }),
    loadClassificationEpic: (action$) =>
        action$.ofType(LOAD_CLASSIFICATION)
            .switchMap((action) => {
                const url = config.getStyleMetadataService(action.layer, action.params);
                const method = action.params?.method;
                return Observable.defer(() => axios.get(url))
                    .switchMap((response) => Observable.of(classificationLoaded(action.layer, config.readClassification(response.data, method))))
                    .catch(e => Observable.of(classificationError(action.layer, e)));
            }),
    removeThematicEpic: (action$, store) =>
        action$.ofType(UPDATE_NODE)
            .switchMap((action) => {
                const layer = head(store.value.layers.flat.filter(l => l.id === action.node));
                if (layer && action.options.thematic === null && config.hasThematicStyle(layer)) {
                    const newParams = config.removeThematicStyle(layer.params);
                    return Observable.of(changeLayerParams(action.node, newParams));
                }
                return Observable.empty();
            })
});
