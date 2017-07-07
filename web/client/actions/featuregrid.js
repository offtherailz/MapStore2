/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const SELECT_FEATURES = 'SELECT_FEATURES';
const DESELECT_FEATURES = 'FEATUREGRID:DESELECT_FEATURES';
const CLEAR_SELECTION = 'FEATUREGRID:CLEAR_SELECTION';
const SET_SELECTION_OPTIONS = 'FEATUREGRID:SET_SELECTION_OPTIONS';
const TOGGLE_MODE = 'FEATUREGRID:TOGGLE_MODE';
const TOGGLE_FEATURES_SELECTION = 'FEATUREGRID:TOGGLE_FEATURES_SELECTION';
const SET_FEATURES = 'SET_FEATURES';
const SORT_BY = 'FEATUREGRID:SORT_BY';
const SET_LAYER = 'FEATUREGRID:SET_LAYER';
const CHANGE_PAGE = 'FEATUREGRID:CHANGE_PAGE';
const DOCK_SIZE_FEATURES = 'DOCK_SIZE_FEATURES';
const TOGGLE_TOOL = 'FEATUREGRID:TOGGLE_TOOL';
const CUSTOMIZE_ATTRIBUTE = 'FEATUREGRID:CUSTOMIZE_ATTRIBUTE';
const MODES = {
    EDIT: "EDIT"
};

function selectFeatures(features, append) {
    return {
        type: SELECT_FEATURES,
        features,
        append
    };
}
function deselectFeatures(features) {
    return {
        type: DESELECT_FEATURES,
        features
    };
}
function clearSelection() {
    return {
        type: CLEAR_SELECTION
    };
}
function toggleSelection(features) {
    return {
        type: TOGGLE_FEATURES_SELECTION,
        features
    };
}
function setSelectionOptions({multiselect= false} = {}) {
    return {
        type: SET_SELECTION_OPTIONS,
        multiselect
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
function setLayer(id) {
    return {
        type: SET_LAYER,
        id
    };
}
function toggleTool(tool, value) {
    return {
        type: TOGGLE_TOOL,
        tool,
        value
    };
}
function customizeAttribute(name, key, value) {
    return {
        type: CUSTOMIZE_ATTRIBUTE,
        name,
        key,
        value
    };
}
function toggleEditMode() {
    return {
        type: TOGGLE_MODE,
        mode: MODES.EDIT
    };
}
function toggleViewMode() {
    return {
        type: TOGGLE_MODE,
        mode: MODES.VIEW
    };
}

module.exports = {
    SELECT_FEATURES,
    DESELECT_FEATURES,
    CLEAR_SELECTION,
    TOGGLE_FEATURES_SELECTION,
    SET_SELECTION_OPTIONS,
    SET_FEATURES,
    DOCK_SIZE_FEATURES,
    SORT_BY,
    CHANGE_PAGE,
    SET_LAYER,
    TOGGLE_TOOL,
    CUSTOMIZE_ATTRIBUTE,
    TOGGLE_MODE,
    MODES,
    setLayer,
    selectFeatures,
    deselectFeatures,
    setSelectionOptions,
    clearSelection,
    toggleSelection,
    setFeatures,
    dockSizeFeatures,
    sort,
    changePage,
    toggleTool,
    customizeAttribute,
    toggleEditMode,
    toggleViewMode
};
