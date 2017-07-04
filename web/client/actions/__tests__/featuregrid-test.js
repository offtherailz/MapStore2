/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const expect = require('expect');
const {
    SELECT_FEATURES,
    selectFeatures,
    changePage,
    CHANGE_PAGE,
    sort,
    SORT_BY
} = require('../featuregrid');

describe('Test correctness of featurgrid actions', () => {

    it('Test selectFeature action creator', () => {
        const features = [1, 2];

        const retval = selectFeatures(features);

        expect(retval).toExist();
        expect(retval.type).toBe(SELECT_FEATURES);
        expect(retval.features).toExist();
        expect(retval.features).toBe(features);
    });
    it('Test changePage action creator', () => {
        const retval = changePage(1, 2);
        expect(retval).toExist();
        expect(retval.type).toBe(CHANGE_PAGE);
        expect(retval.page).toBe(1);
        expect(retval.size).toBe(2);
    });
    it('Test sort action creator', () => {
        const retval = sort("attr", "ASC");
        expect(retval).toExist();
        expect(retval.type).toBe(SORT_BY);
        expect(retval.sortBy).toBe("attr");
        expect(retval.sortOrder).toBe("ASC");
    });

});
