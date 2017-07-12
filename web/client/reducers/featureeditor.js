/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/
const assign = require("object-assign");
const {GEOMETRY_CHANGED} = require('../actions/featureeditor');

const emptyState = {
    tempFeatures: null
};

function featureeditor(state = emptyState, action) {
    switch (action.type) {
        case GEOMETRY_CHANGED:
            return assign({}, state, {tempFeatures: action.features});
        default:
            return state;
    }
}

module.exports = featureeditor;
