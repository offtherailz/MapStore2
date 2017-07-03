/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const assign = require("object-assign");
const {SELECT_FEATURES, SET_FEATURES, DOCK_SIZE_FEATURES, SET_LAYER, TOGGLE_TOOL, CUSTOMIZE_ATTRIBUTE} = require('../actions/featuregrid');

const emptyResultsState = {
    pagination: {
        startIndex: 0,
        maxFeatures: 20
    },
    select: [],
    features: [],
    dockSize: 0.35
};

function featuregrid(state = emptyResultsState, action) {
    switch (action.type) {
    case SELECT_FEATURES:
        return assign({}, state, {select: action.features});
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
    default:
        return state;
    }
}

module.exports = featuregrid;
