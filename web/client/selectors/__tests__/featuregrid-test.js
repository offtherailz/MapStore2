/**
* Copyright 2016, GeoSolutions Sas.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const expect = require('expect');
const {
    hasGeometrySelector,
    selectedFeatureSelector,
    selectedFeaturesSelector,
    modeSelector,
    selectedFeaturesCount,
    changesSelector
} = require('../featuregrid');

const idFt1 = "idFt1";
const idFt2 = "idFt2";
const modeEdit = "edit";
let feature1 = {
    type: "Feature",
    geometry: {
        type: "Point",
        coordinates: [1, 2]
    },
    id: idFt1,
    properties: {
        someProp: "someValue"
    }
};
let feature2 = {
    type: "Feature",
    geometry: {
        type: "Point",
        coordinates: [1, 2]
    },
    id: idFt2,
    properties: {
        someProp: "someValue"
    }
};
const initialState = {
    featuregrid: {
        mode: modeEdit,
        select: [feature1, feature2],
        changes: [feature2]
    }
};

describe('Test featuregrid selectors', () => {
    it('test if the feature has some geometry (true)', () => {
        const bool = hasGeometrySelector(initialState);
        expect(bool).toExist();
        expect(bool).toBe(true);
    });
    it('test if the feature has not geometry (false)', () => {
        feature1.geometry = null;
        const bool = hasGeometrySelector(initialState);
        expect(bool).toBe(false);
    });
    it('test selectedFeatureSelector ', () => {
        const feature = selectedFeatureSelector(initialState);
        expect(feature).toExist();
        expect(feature.id).toBe(idFt1);
    });
    it('test selectedFeaturesSelector ', () => {
        const features = selectedFeaturesSelector(initialState);
        expect(features).toExist();
        expect(features.length).toBe(2);
    });
    it('test modeSelector ', () => {
        const mode = modeSelector(initialState);
        expect(mode).toExist();
        expect(mode).toBe(modeEdit);
    });
    it('test selectedFeaturesCount ', () => {
        const count = selectedFeaturesCount(initialState);
        expect(count).toExist();
        expect(count).toBe(2);
    });
    it('test changesSelector ', () => {
        const ftChanged = changesSelector(initialState);
        expect(ftChanged).toExist();
        expect(ftChanged.length).toBe(1);
    });

});
