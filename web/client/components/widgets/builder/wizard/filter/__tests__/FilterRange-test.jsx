/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { Simulate } from 'react-dom/test-utils';
import expect from 'expect';
import FilterRange from '../FilterRange';
import { RANGE_VARIANTS, RANGE_ENDS } from '../../../../../../utils/FilterRangeUtils';

const numberFilter = (layout = {}) => ({
    id: 'f1',
    data: { dataSource: 'features', valuesFrom: 'range', valueAttribute: 'pm10', valueAttributeType: 'number' },
    layout: { variant: RANGE_VARIANTS.FIELDS, step: 10, ...layout }
});

describe('FilterRange', () => {
    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        setTimeout(done);
    });
    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(document.getElementById("container"));
        document.body.innerHTML = '';
        setTimeout(done);
    });
    it('shows a message when the bounds are not available', () => {
        ReactDOM.render(<FilterRange filterData={numberFilter()} bounds={{ min: null, max: null }} />, document.getElementById("container"));
        expect(document.querySelector('.ms-filter-range-empty').textContent).toBe('widgets.filterWidget.rangeNoBounds');
        expect(document.querySelectorAll('.ms-filter-range').length).toBe(0);
    });
    it('commits a number field, snapped to the nearest step', () => {
        const actions = { onSelectionChange: () => {} };
        const spy = expect.spyOn(actions, 'onSelectionChange');
        ReactDOM.render(<FilterRange filterData={numberFilter()} bounds={{ min: 0, max: 100 }} onSelectionChange={actions.onSelectionChange} />, document.getElementById("container"));
        const inputs = document.querySelectorAll('.ms-filter-range-fields input[type="number"]');
        expect(inputs.length).toBe(2);
        Simulate.change(inputs[0], { target: { value: '23' } });
        Simulate.blur(inputs[0]);
        expect(spy.calls.length).toBe(1);
        expect(spy.calls[0].arguments[0]).toEqual([{ start: 20, end: null }]);
    });
    it('moves the start when the end goes below it', () => {
        const actions = { onSelectionChange: () => {} };
        const spy = expect.spyOn(actions, 'onSelectionChange');
        ReactDOM.render(<FilterRange filterData={numberFilter()} bounds={{ min: 0, max: 100 }} selections={[{ start: 50, end: null }]} onSelectionChange={actions.onSelectionChange} />, document.getElementById("container"));
        const end = document.querySelectorAll('.ms-filter-range-fields input[type="number"]')[1];
        Simulate.change(end, { target: { value: '30' } });
        Simulate.blur(end);
        expect(spy.calls[0].arguments[0]).toEqual([{ start: 30, end: 30 }]);
    });
    it('shows only the end field and no clear buttons with force selection', () => {
        ReactDOM.render(<FilterRange filterData={numberFilter({ rangeEnds: RANGE_ENDS.MAX, forceSelection: true })} bounds={{ min: 0, max: 100 }} selections={[{ start: null, end: 40 }]} />, document.getElementById("container"));
        const inputs = document.querySelectorAll('.ms-filter-range-fields input[type="number"]');
        expect(inputs.length).toBe(1);
        expect(inputs[0].value).toBe('40');
        expect(document.querySelectorAll('.ms-filter-range-fields .glyphicon-remove').length).toBe(0);
    });
    it('shows the clear button of each end only when it has a value', () => {
        ReactDOM.render(<FilterRange filterData={numberFilter()} bounds={{ min: 0, max: 100 }} selections={[{ start: 10, end: null }]} />, document.getElementById("container"));
        expect(document.querySelectorAll('.ms-filter-range-fields .glyphicon-remove').length).toBe(1);
    });
    it('formats numbers with the format of the attribute', () => {
        const filter = numberFilter({ variant: RANGE_VARIANTS.SLIDER });
        const formatted = { ...filter, data: { ...filter.data, attributeFormats: { pm10: { format: '.1f' } } } };
        ReactDOM.render(<FilterRange filterData={formatted} bounds={{ min: 0, max: 100 }} locale="en-US" />, document.getElementById("container"));
        const bounds = [...document.querySelectorAll('.ms-filter-range-bounds > span')].map(span => span.textContent);
        expect(bounds).toEqual(['0.0', '100.0']);
    });
    it('shows the slider with the selected values and the bounds', () => {
        ReactDOM.render(<FilterRange filterData={numberFilter({ variant: RANGE_VARIANTS.SLIDER })} bounds={{ min: 0, max: 100 }} selections={[{ start: 10, end: null }]} locale="en-US" />, document.getElementById("container"));
        expect(document.querySelectorAll('.ms-filter-range-slider .noUi-handle').length).toBe(2);
        const values = [...document.querySelectorAll('.ms-filter-range-values > span')].map(span => span.textContent);
        expect(values).toEqual(['widgets.filterWidget.rangeFrom: 10', 'widgets.filterWidget.rangeTo: widgets.filterWidget.rangeAny']);
        const bounds = [...document.querySelectorAll('.ms-filter-range-bounds > span')].map(span => span.textContent);
        expect(bounds).toEqual(['0', '100']);
        expect(document.querySelectorAll('.ms-filter-range-fields').length).toBe(0);
    });
});
