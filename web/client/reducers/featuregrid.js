/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/
const assign = require("object-assign");
const {
    SELECT_FEATURES,
    DESELECT_FEATURES,
    TOGGLE_FEATURES_SELECTION,
    CLEAR_SELECTION,
    SET_FEATURES,
    FEATURES_MODIFIED,
    SAVING,
    SAVE_SUCCESS,
    SAVE_ERROR,
    CLEAR_CHANGES,
    DELETE_SELECTED_FEATURES_CONFIRM,
    DOCK_SIZE_FEATURES,
    SET_LAYER, TOGGLE_TOOL,
    CUSTOMIZE_ATTRIBUTE,
    SET_SELECTION_OPTIONS,
    TOGGLE_MODE,
    MODES
} = require('../actions/featuregrid');

const emptyResultsState = {
    mode: MODES.VIEW,
    changes: [],
    pagination: {
        startIndex: 0,
        maxFeatures: 20
    },
    select: [],
    multiselect: false,
    features: [],
    dockSize: 0.35
};
const isSameFeature = (f1, f2) => f2 === f1 || (f1.id !== undefined && f1.id !== null && f1.id === f2.id);
const isPresent = (f1, features = []) => features.filter( f2 => isSameFeature(f1, f2)).length > 0;
function featuregrid(state = emptyResultsState, action) {
    switch (action.type) {
    case SELECT_FEATURES:
        if (state.multiselect && action.append) {
            return assign({}, state, {select: action.append ? [...state.select, ...action.features] : action.features});
        }
        if (action.features && state.select && state.select[0] && action.features[0] && isSameFeature(action.features[0], state.select[0])) {
            return state;
        }
        return assign({}, state, {select: (action.features || []).splice(0, 1)});
    case TOGGLE_FEATURES_SELECTION:
        let newArr = state.select.filter( f => !isPresent(f, action.features)).concat( (action.features || []).filter( f => !isPresent(f, state.select)));
        return assign({}, state, {select: newArr.filter( f => isPresent(f, action.features)).splice(0, 1)});
    case DESELECT_FEATURES:
        return assign({}, state, {
            select: state.select.filter(f1 => !isPresent(f1, action.features))
            });
    case DELETE_SELECTED_FEATURES_CONFIRM: // TODO implement this reducer
        return state;
    case SET_SELECTION_OPTIONS: {
        return assign({}, state, {multiselect: action.multiselect});
    }
    case CLEAR_SELECTION:
        return assign({}, state, {select: [], changes: []});
    case SET_FEATURES:
        return assign({}, state, {features: action.features});
    case DOCK_SIZE_FEATURES:
        return assign({}, state, {dockSize: action.dockSize});
    case SET_LAYER:
        return assign({}, state, {selectedLayer: action.id});
    case TOGGLE_TOOL:
        return assign({}, state, {
            tools: {
                ...state.tools,
                [action.tool]: action.value || !(state.tools && state.tools[action.tool])
            }

        });
    case CUSTOMIZE_ATTRIBUTE:
        return assign({}, state, {
            attributes: {
                ...state.attributes,
                [action.name]: {
                    ...(state.attributes && state.attributes[action.name] || {}),
                    [action.key]: action.value || (state.attributes && state.attributes[action.name] && !state.attributes[action.name][action.key])
                }
            }
        });
    case TOGGLE_MODE: {
        return assign({}, state, {
            mode: action.mode,
            multiselect: action.mode === MODES.EDIT
        });
    }
    case FEATURES_MODIFIED: {
        return assign({}, state, {
            changes: [...(state && state.changes || []), ...(action.features.map(f => ({
                id: f.id,
                updated: action.updated
            })))]
        });
    }
    case SAVING: {
        return assign({}, state, {
            saving: true,
            loading: true
        });
    }
    case SAVE_SUCCESS: {
        return assign({}, state, {
            deleteConfirm: false,
            saved: true,
            saving: false,
            loading: false
        });
    }
    case CLEAR_CHANGES: {
        return assign({}, state, {
            saved: false,
            changes: []
        });
    }
    case SAVE_ERROR: {
        return assign({}, state, {
            deleteConfirm: false,
            saving: false,
            loading: false
        });
    }
    default:
        return state;
    }
}

module.exports = featuregrid;
