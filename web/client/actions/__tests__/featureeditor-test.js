/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/

const expect = require('expect');
const {
    GEOMETRY_CHANGED,
    geometryChanged
} = require('../featureeditor');

describe('Test correctness of featureeditor actions', () => {

    it('Test geometryChanged action creator', () => {
        const features = [{
            geometry: {
                type: "Point",
                coordinates: []
            }
        }];

        const retval = geometryChanged(features);

        expect(retval).toExist();
        expect(retval.type).toBe(GEOMETRY_CHANGED);
        expect(retval.features).toExist();
        expect(retval.features).toBe(features);
    });

});
