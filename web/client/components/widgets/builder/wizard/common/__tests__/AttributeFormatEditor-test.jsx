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
import AttributeFormatEditor, { AttributeFormatButton } from '../AttributeFormatEditor';
import { DATE_FORMAT_TYPES } from '../../../../../../utils/AttributeFormatUtils';

describe('AttributeFormatEditor', () => {
    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        setTimeout(done);
    });
    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(document.getElementById("container"));
        document.body.innerHTML = '';
        setTimeout(done);
    });
    it('shows the date example in the language format and no pattern input by default', () => {
        ReactDOM.render(<AttributeFormatEditor type="date" locale="it-IT" />, document.getElementById("container"));
        expect(document.querySelector('.ms-attribute-format-example').textContent).toBe('21/03/2025 14:30:00');
        expect(document.querySelectorAll('.ms-attribute-format-editor input.form-control[type="text"]').length).toBe(0);
        expect(document.querySelectorAll('.ms-attribute-format-reset').length).toBe(0);
    });
    it('edits the custom date pattern', () => {
        const actions = { onChange: () => {} };
        const spy = expect.spyOn(actions, 'onChange');
        ReactDOM.render(<AttributeFormatEditor type="date" locale="it-IT" value={{ type: DATE_FORMAT_TYPES.CUSTOM, pattern: 'YYYY' }} onChange={actions.onChange} />, document.getElementById("container"));
        const inputs = document.querySelectorAll('.ms-attribute-format-editor input.form-control[type="text"]');
        expect(inputs.length).toBe(1);
        expect(document.querySelector('.ms-attribute-format-example').textContent).toBe('2025');
        Simulate.change(inputs[0], { target: { value: 'DD/MM/YYYY' } });
        expect(spy.calls[0].arguments[0]).toEqual({ type: DATE_FORMAT_TYPES.CUSTOM, pattern: 'DD/MM/YYYY' });
    });
    it('edits the chart value options of numbers, and restores the default', () => {
        const actions = { onChange: () => {} };
        const spy = expect.spyOn(actions, 'onChange');
        const value = { format: ',.2f', tickPrefix: '~', tickSuffix: ' kg' };
        ReactDOM.render(<AttributeFormatEditor type="number" locale="en-US" value={value} onChange={actions.onChange} />, document.getElementById("container"));
        expect(document.querySelector('.ms-attribute-format-example').textContent).toBe('~1,234,567.89 kg');
        const inputs = document.querySelectorAll('.ms-attribute-format-editor input[type="text"]');
        // prefix, format, suffix, formula
        expect([...inputs].map(input => input.value)).toEqual(['~', ',.2f', ' kg', '']);
        Simulate.change(inputs[3], { target: { value: 'value / 1000' } });
        expect(spy.calls[0].arguments[0]).toEqual({ ...value, formula: 'value / 1000' });
        Simulate.click(document.querySelector('.ms-attribute-format-reset'));
        expect(spy.calls[1].arguments[0]).toBe(undefined);
    });
    it('AttributeFormatButton is shown only for dates and numbers', () => {
        ReactDOM.render(<div><AttributeFormatButton id="a" type="string" /><AttributeFormatButton id="b" type="date" /><AttributeFormatButton id="c" type="int" value={{ format: 'd' }} /></div>, document.getElementById("container"));
        const buttons = document.querySelectorAll('.ms-attribute-format-button');
        expect(buttons.length).toBe(2);
        expect(buttons[0].querySelector('.glyphicon-calendar')).toExist();
        expect(buttons[0].className).toNotContain('active');
        expect(buttons[1].querySelector('.glyphicon-counter')).toExist();
        expect(buttons[1].className).toContain('active');
    });
});
