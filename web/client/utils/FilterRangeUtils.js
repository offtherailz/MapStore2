/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import moment from 'moment';
import isNil from 'lodash/isNil';

export const RANGE_VALUES_FROM = 'range';
export const RANGE_SELECTION_MODE = 'range';

export const RANGE_VARIANTS = {
    FIELDS: 'rangeFields',
    SLIDER: 'rangeSlider'
};

export const RANGE_ENDS = {
    BOTH: 'both',
    MIN: 'min',
    MAX: 'max'
};

export const RANGE_STEP_UNITS = {
    DAY: 'day',
    MONTH: 'month',
    YEAR: 'year'
};

// Services do not accept open intervals, so an empty end of a date interval becomes a far date.
const DIMENSION_OPEN_START = '0001-01-01T00:00:00.000Z';
const DIMENSION_OPEN_END = '9999-12-31T23:59:59.999Z';
const NUMBER_TYPES = ['int', 'number'];
const DATE_TYPES = ['date', 'date-time'];
// Keeps the slider usable when a small step meets a large interval.
const MAX_STOPS = 2000;

export const isRangeFilter = (filter) => filter?.data?.valuesFrom === RANGE_VALUES_FROM;
export const isRangeNumberType = (type) => NUMBER_TYPES.includes(type);
export const isRangeDateType = (type) => DATE_TYPES.includes(type);
export const isRangeAttributeType = (type) => isRangeNumberType(type) || isRangeDateType(type);

/**
 * Returns the interval selected in a filter, or `null` when nothing is selected.
 * @param {array} selections selections of the filter
 * @returns {object|null} `{ start, end }`, where a `null` end means no limit on that side
 */
export const getRangeSelection = (selections = []) => {
    const selection = selections?.[0];
    if (!selection || typeof selection !== 'object') {
        return null;
    }
    const { start = null, end = null } = selection;
    return isNil(start) && isNil(end) ? null : { start, end };
};

/**
 * Builds the selections of a filter from an interval, so an empty interval clears the selection.
 * @param {*} start start of the interval, `null` for no limit
 * @param {*} end end of the interval, `null` for no limit
 * @returns {array} selections
 */
export const toRangeSelections = (start, end) =>
    isNil(start) && isNil(end) ? [] : [{ start: start ?? null, end: end ?? null }];

/**
 * Rounds a date down to the start of its step unit, in UTC.
 * @param {string} value ISO date
 * @param {string} unit one of `RANGE_STEP_UNITS`
 * @returns {string} ISO date
 */
export const startOfStep = (value, unit = RANGE_STEP_UNITS.DAY) => moment.utc(value).startOf(unit).toISOString();

/**
 * Returns the start of the step that follows the one of a date, in UTC.
 * @param {string} value ISO date
 * @param {string} unit one of `RANGE_STEP_UNITS`
 * @returns {string} ISO date
 */
export const nextStep = (value, unit = RANGE_STEP_UNITS.DAY) => moment.utc(value).startOf(unit).add(1, unit).toISOString();

/**
 * Returns the values a range slider can take between the bounds.
 * Dates move by the step unit, numbers by the step.
 * @param {object} options `{ type, min, max, step, stepUnit }`
 * @returns {array} ordered values; empty when the bounds are not valid
 */
export const getRangeStops = ({ type, min, max, step, stepUnit } = {}) => {
    if (isNil(min) || isNil(max)) {
        return [];
    }
    if (isRangeDateType(type)) {
        const first = moment.utc(startOfStep(min, stepUnit));
        const last = moment.utc(max);
        if (!first.isValid() || !last.isValid() || first.isAfter(last)) {
            return [];
        }
        // Too many steps for a slider: move by several units at a time, keeping the last step that holds the maximum.
        const unitsPerStop = Math.ceil((last.diff(first, stepUnit) + 1) / MAX_STOPS);
        const lastStop = startOfStep(max, stepUnit);
        const stops = [];
        for (const current = first; !current.isAfter(last); current.add(unitsPerStop, stepUnit)) {
            stops.push(current.toISOString());
        }
        if (stops[stops.length - 1] !== lastStop) {
            stops.push(lastStop);
        }
        return stops;
    }
    const minValue = Number(min);
    const maxValue = Number(max);
    if (isNaN(minValue) || isNaN(maxValue) || minValue > maxValue) {
        return [];
    }
    const count = Math.floor((maxValue - minValue) / (step > 0 ? step : 1)) + 1;
    const actualStep = count > MAX_STOPS ? (maxValue - minValue) / (MAX_STOPS - 1) : (step > 0 ? step : 1);
    const stops = [];
    for (let i = 0; i < Math.min(count, MAX_STOPS); i++) {
        stops.push(Number((minValue + i * actualStep).toFixed(10)));
    }
    if (stops[stops.length - 1] < maxValue) {
        stops.push(maxValue);
    }
    return stops;
};

/**
 * Builds the CQL condition of an interval filter.
 * For dates the end is exclusive and moves to the start of the next step, so the whole last step is included.
 * @param {object} filter filter configuration
 * @param {array} selections selections of the filter
 * @returns {string|null} CQL condition, or `null` when nothing is selected
 */
export const getRangeCQL = (filter, selections) => {
    const selection = getRangeSelection(selections);
    const { valueAttribute, valueAttributeType } = filter?.data || {};
    if (!selection || !valueAttribute) {
        return null;
    }
    const attribute = `"${valueAttribute}"`;
    const conditions = [];
    if (isRangeDateType(valueAttributeType)) {
        const unit = filter?.layout?.stepUnit ?? RANGE_STEP_UNITS.DAY;
        if (!isNil(selection.start)) {
            conditions.push(`${attribute} >= '${startOfStep(selection.start, unit)}'`);
        }
        if (!isNil(selection.end)) {
            conditions.push(`${attribute} < '${nextStep(selection.end, unit)}'`);
        }
    } else {
        if (!isNil(selection.start)) {
            conditions.push(`${attribute} >= ${Number(selection.start)}`);
        }
        if (!isNil(selection.end)) {
            conditions.push(`${attribute} <= ${Number(selection.end)}`);
        }
    }
    return conditions.join(' AND ');
};

/**
 * Builds the value an interval filter applies to a layer dimension, e.g. the WMS `TIME` parameter.
 * Dates give `start/end` with both ends included: the end is the last instant of its step.
 * Numbers need both ends.
 * @param {object} filter filter configuration
 * @param {array} selections selections of the filter
 * @returns {string|null} the dimension value, or `null` when nothing can be applied
 */
export const getRangeDimensionValue = (filter, selections) => {
    const selection = getRangeSelection(selections);
    if (!selection) {
        return null;
    }
    if (isRangeDateType(filter?.data?.valueAttributeType)) {
        const unit = filter?.layout?.stepUnit ?? RANGE_STEP_UNITS.DAY;
        const start = isNil(selection.start) ? DIMENSION_OPEN_START : startOfStep(selection.start, unit);
        const end = isNil(selection.end) ? DIMENSION_OPEN_END : moment.utc(selection.end).endOf(unit).toISOString();
        return `${start}/${end}`;
    }
    return isNil(selection.start) || isNil(selection.end) ? null : `${Number(selection.start)}/${Number(selection.end)}`;
};

/**
 * Checks that the ends shown by an interval filter are set, as Force selection requires.
 * @param {object} filter filter configuration
 * @param {array} selections selections of the filter
 * @returns {boolean}
 */
export const isRangeSelectionComplete = (filter, selections) => {
    const selection = getRangeSelection(selections);
    if (!selection) {
        return false;
    }
    const ends = filter?.layout?.rangeEnds ?? RANGE_ENDS.BOTH;
    const hasStart = !isNil(selection.start);
    const hasEnd = !isNil(selection.end);
    if (ends === RANGE_ENDS.MIN) {
        return hasStart;
    }
    if (ends === RANGE_ENDS.MAX) {
        return hasEnd;
    }
    return hasStart && hasEnd;
};
