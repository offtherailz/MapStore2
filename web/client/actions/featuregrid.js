/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const SELECT_FEATURES = 'SELECT_FEATURES';
const SET_FEATURES = 'SET_FEATURES';
const SORT_BY = 'FEATUREGRID:SORT_BY';
const CHANGE_PAGE = 'FEATUREGRID:CHANGE_PAGE';
const DOCK_SIZE_FEATURES = 'DOCK_SIZE_FEATURES';

function selectFeatures(features) {
    return {
        type: SELECT_FEATURES,
        features: features
    };
}

function setFeatures(features) {
    return {
        type: SET_FEATURES,
        features: features
    };
}

function dockSizeFeatures(dockSize) {
    return {
        type: DOCK_SIZE_FEATURES,
        dockSize: dockSize
    };
}
function sort(sortBy, sortOrder) {
    return {
        type: SORT_BY,
        sortBy,
        sortOrder
    };
}
function changePage(page, size) {
    return {
        type: CHANGE_PAGE,
        page,
        size
    };
}

module.exports = {
    SELECT_FEATURES,
    SET_FEATURES,
    DOCK_SIZE_FEATURES,
    SORT_BY,
    CHANGE_PAGE,
    selectFeatures,
    setFeatures,
    dockSizeFeatures,
    sort,
    changePage
};
