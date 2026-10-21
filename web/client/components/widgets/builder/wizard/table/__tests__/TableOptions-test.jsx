/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';
import { get } from 'lodash';
import React from 'react';
import ReactDOM from 'react-dom';
import ReactTestUtils from 'react-dom/test-utils';

import describeStates from '../../../../../../test-resources/wfs/describe-states.json';
import TableOptions from '../TableOptions';

describe('TableOptions component', () => {
    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        setTimeout(done);
    });
    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(document.getElementById("container"));
        document.body.innerHTML = '';
        setTimeout(done);
    });
    it('TableOptions rendering with defaults', () => {
        ReactDOM.render(<TableOptions />, document.getElementById("container"));
        const container = document.getElementById('container');
        const el = container.querySelector('.chart-options-form');
        expect(el).toExist();
        const resetButton = document.querySelector('.btn');
        expect(resetButton).toNotExist();
        expect(document.querySelector('.empty-state-container')).toExist();
    });
    it('Test TableOptions tools visibility', () => {

        ReactDOM.render(<TableOptions
            data={{ options: { columnSettings: { test: {} } } }}
            featureTypeProperties={get(describeStates, "featureTypes[0].properties")}
            dependencies={{ viewport: {} }} />, document.getElementById("container"));
        const resetButton = document.querySelector('.btn');
        expect(resetButton).toExist();

    });
    it('Test TableOptions onChange', () => {
        const actions = {
            onChange: () => { }
        };
        const spyonChange = expect.spyOn(actions, 'onChange');
        ReactDOM.render(<TableOptions
            data={{options: { columnSettings: {test: {}}}}}
            featureTypeProperties={get(describeStates, "featureTypes[0].properties")}
            onChange={actions.onChange}
            dependencies={{ viewport: {} }} />, document.getElementById("container"));
        const inputs = document.querySelectorAll('input');
        expect(inputs.length).toBe(10);
        // the grid renders only the visible rows: each one has the format button only for numbers and dates
        const formattable = get(describeStates, "featureTypes[0].properties")
            .filter(p => ['int', 'number', 'date', 'date-time', 'time'].includes(p.localType))
            .map(p => p.name);
        const rows = [...document.querySelectorAll('.react-grid-Row')];
        expect(rows.length).toBe(9);
        rows.forEach(row => {
            const name = row.querySelectorAll('.react-grid-Cell')[1].textContent.trim();
            expect(!!row.querySelector('.ms-attribute-format-button')).toBe(formattable.includes(name));
        });
        const resetButton = [...document.querySelectorAll('.btn')].find(b => b.textContent === 'widgets.builder.wizard.resetColumnsSizes');
        expect(resetButton).toExist();
        ReactTestUtils.Simulate.click(resetButton);
        expect(spyonChange.calls[0].arguments[0]).toBe("options.columnSettings");
        expect(spyonChange.calls[0].arguments[1]).toBe(undefined);
    });
});
