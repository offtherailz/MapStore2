/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/
const expect = require('expect');
const featureeditor = require('../featureeditor');
const {GEOMETRY_CHANGED} = require('../../actions/featureeditor');

describe('Test the featureeditor reducer', () => {

    it('FeatureGrid GEOMETRY_CHANGED', () => {
        const feature = {
            geometry: {
                type: "Point",
                coordinates: []
            }
        };
        let testAction = {
            type: GEOMETRY_CHANGED,
            features: [feature]
        };
        let state = featureeditor( {}, testAction);
        expect(state.tempFeatures).toExist();
        expect(state.tempFeatures[0]).toBe(feature);
    });

});
