/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/

const GEOMETRY_CHANGED = 'GEOMETRY_CHANGED';


function geometryChanged(features) {
    return {
        type: GEOMETRY_CHANGED,
        features
    };
}

module.exports = {
    GEOMETRY_CHANGED,
    geometryChanged
};
