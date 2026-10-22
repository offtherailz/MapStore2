/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import expect from 'expect';
import {
    RANGE_ENDS,
    RANGE_STEP_UNITS,
    getRangeStops,
    getRangeCQL,
    getRangeDimensionValue,
    getRangeSelection,
    toRangeSelections,
    isRangeSelectionComplete,
    isRangeAttributeType
} from '../FilterRangeUtils';

const dateFilter = (layout = {}) => ({
    id: 'f1',
    data: { dataSource: 'features', valuesFrom: 'range', valueAttribute: 'day', valueAttributeType: 'date' },
    layout: { stepUnit: RANGE_STEP_UNITS.MONTH, ...layout }
});
const numberFilter = (layout = {}) => ({
    id: 'f2',
    data: { dataSource: 'features', valuesFrom: 'range', valueAttribute: 'pm10', valueAttributeType: 'number' },
    layout
});

describe('FilterRangeUtils', () => {
    it('getRangeStops moves dates by the step unit', () => {
        expect(getRangeStops({ type: 'date', min: '2025-01-15Z', max: '2025-04-02Z', stepUnit: RANGE_STEP_UNITS.MONTH })).toEqual([
            '2025-01-01T00:00:00.000Z',
            '2025-02-01T00:00:00.000Z',
            '2025-03-01T00:00:00.000Z',
            '2025-04-01T00:00:00.000Z'
        ]);
        expect(getRangeStops({ type: 'date-time', min: '2020-06-01T10:00:00Z', max: '2022-01-01T00:00:00Z', stepUnit: RANGE_STEP_UNITS.YEAR })).toEqual([
            '2020-01-01T00:00:00.000Z',
            '2021-01-01T00:00:00.000Z',
            '2022-01-01T00:00:00.000Z'
        ]);
    });
    it('getRangeStops moves numbers by the step and keeps the maximum', () => {
        expect(getRangeStops({ type: 'number', min: 0, max: 2, step: 0.5 })).toEqual([0, 0.5, 1, 1.5, 2]);
        expect(getRangeStops({ type: 'int', min: 0, max: 10, step: 4 })).toEqual([0, 4, 8, 10]);
    });
    it('getRangeStops returns no stops for invalid bounds', () => {
        expect(getRangeStops({ type: 'number', min: 5, max: 1, step: 1 })).toEqual([]);
        expect(getRangeStops({ type: 'date', min: null, max: '2025-01-01Z', stepUnit: RANGE_STEP_UNITS.DAY })).toEqual([]);
    });
    it('getRangeStops spaces date stops when there are too many steps, keeping the maximum', () => {
        const stops = getRangeStops({ type: 'date', min: '1583-01-01Z', max: '2013-06-30Z', stepUnit: RANGE_STEP_UNITS.DAY });
        // 157,236 days in at most 2000 stops: one stop every 79 days, plus the last day.
        expect(stops.length).toBe(1992);
        expect(stops[1]).toBe('1583-03-21T00:00:00.000Z');
        expect(stops[0]).toBe('1583-01-01T00:00:00.000Z');
        expect(stops[stops.length - 1]).toBe('2013-06-30T00:00:00.000Z');
    });
    it('getRangeStops caps the number of stops', () => {
        const stops = getRangeStops({ type: 'number', min: 0, max: 1000000, step: 1 });
        expect(stops.length).toBe(2000);
        expect(stops[0]).toBe(0);
        expect(stops[stops.length - 1]).toBe(1000000);
    });
    it('getRangeCQL includes the whole last step for dates', () => {
        const selections = [{ start: '2025-01-01T00:00:00.000Z', end: '2025-03-01T00:00:00.000Z' }];
        expect(getRangeCQL(dateFilter(), selections)).toBe(`"day" >= '2025-01-01T00:00:00.000Z' AND "day" < '2025-04-01T00:00:00.000Z'`);
    });
    it('getRangeCQL omits the condition of an open end', () => {
        expect(getRangeCQL(dateFilter(), [{ start: '2025-02-01T00:00:00.000Z', end: null }])).toBe(`"day" >= '2025-02-01T00:00:00.000Z'`);
        expect(getRangeCQL(numberFilter(), [{ start: null, end: 40.5 }])).toBe(`"pm10" <= 40.5`);
        expect(getRangeCQL(numberFilter(), [{ start: 10, end: 40.5 }])).toBe(`"pm10" >= 10 AND "pm10" <= 40.5`);
    });
    it('getRangeDimensionValue includes both ends and the whole last step for dates', () => {
        const selections = [{ start: '2025-01-15T00:00:00.000Z', end: '2025-03-01T00:00:00.000Z' }];
        expect(getRangeDimensionValue(dateFilter(), selections)).toBe('2025-01-01T00:00:00.000Z/2025-03-31T23:59:59.999Z');
    });
    it('getRangeDimensionValue replaces the open ends of dates with far dates', () => {
        expect(getRangeDimensionValue(dateFilter(), [{ start: '2025-02-01T00:00:00.000Z', end: null }])).toBe('2025-02-01T00:00:00.000Z/9999-12-31T23:59:59.999Z');
        expect(getRangeDimensionValue(dateFilter({ stepUnit: RANGE_STEP_UNITS.YEAR }), [{ start: null, end: '1990-06-01T00:00:00.000Z' }])).toBe('0001-01-01T00:00:00.000Z/1990-12-31T23:59:59.999Z');
    });
    it('getRangeDimensionValue needs both ends for numbers', () => {
        expect(getRangeDimensionValue(numberFilter(), [{ start: 10, end: 40.5 }])).toBe('10/40.5');
        expect(getRangeDimensionValue(numberFilter(), [{ start: 10, end: null }])).toBe(null);
        expect(getRangeDimensionValue(numberFilter(), [])).toBe(null);
    });
    it('getRangeCQL returns null without a selection', () => {
        expect(getRangeCQL(numberFilter(), [])).toBe(null);
        expect(getRangeCQL(numberFilter(), [{ start: null, end: null }])).toBe(null);
    });
    it('toRangeSelections and getRangeSelection round trip', () => {
        expect(toRangeSelections(null, null)).toEqual([]);
        expect(toRangeSelections(1, null)).toEqual([{ start: 1, end: null }]);
        expect(getRangeSelection(toRangeSelections(null, 5))).toEqual({ start: null, end: 5 });
        expect(getRangeSelection([])).toBe(null);
        expect(getRangeSelection(['a value'])).toBe(null);
    });
    it('isRangeSelectionComplete checks the ends shown', () => {
        expect(isRangeSelectionComplete(numberFilter(), [{ start: 1, end: null }])).toBe(false);
        expect(isRangeSelectionComplete(numberFilter(), [{ start: 1, end: 2 }])).toBe(true);
        expect(isRangeSelectionComplete(numberFilter({ rangeEnds: RANGE_ENDS.MIN }), [{ start: 1, end: null }])).toBe(true);
        expect(isRangeSelectionComplete(numberFilter({ rangeEnds: RANGE_ENDS.MAX }), [{ start: 1, end: null }])).toBe(false);
        expect(isRangeSelectionComplete(numberFilter(), [])).toBe(false);
    });
    it('isRangeAttributeType', () => {
        expect(['int', 'number', 'date', 'date-time', 'time', 'string', 'boolean'].map(isRangeAttributeType))
            .toEqual([true, true, true, true, false, false, false]);
    });
});
