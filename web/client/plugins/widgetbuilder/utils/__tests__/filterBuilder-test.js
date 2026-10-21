/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import expect from 'expect';
import { isFilterSelectionValid } from '../filterBuilder';

describe('filterBuilder', () => {
    it('isFilterSelectionValid requires the ends shown by an interval with force selection', () => {
        const filter = {
            data: { valuesFrom: 'range', valueAttributeType: 'number' },
            layout: { forceSelection: true, rangeEnds: 'both' }
        };
        expect(isFilterSelectionValid(filter, [])).toBe(false);
        expect(isFilterSelectionValid(filter, [{ start: 1, end: null }])).toBe(false);
        expect(isFilterSelectionValid(filter, [{ start: 1, end: 2 }])).toBe(true);
        expect(isFilterSelectionValid({ ...filter, layout: { forceSelection: false } }, [])).toBe(true);
    });
    it('isFilterSelectionValid keeps the list behavior', () => {
        const filter = { data: { valuesFrom: 'grouped' }, layout: { forceSelection: true } };
        expect(isFilterSelectionValid(filter, [])).toBe(false);
        expect(isFilterSelectionValid(filter, ['a'])).toBe(true);
    });
});
