/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
var React = require('react');
var ReactDOM = require('react-dom');
var FeatureGrid = require('../FeatureGrid');
var expect = require('expect');
const spyOn = expect.spyOn;
const museam = require('json-loader!../../../../test-resources/wfs/museam.json');
const describePois = require('json-loader!../../../../test-resources/wfs/describe-pois.json');

describe('Test for FeatureGrid component', () => {
    beforeEach((done) => {
        document.body.innerHTML = '<div id="container" style="height:500px"></div>';
        setTimeout(done);
    });

    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(document.getElementById("container"));
        document.body.innerHTML = '';
        setTimeout(done);
    });
    it('render with defaults', () => {
        const cmp = ReactDOM.render(<FeatureGrid/>, document.getElementById("container"));
        expect(cmp).toExist();
    });
    it('render sample features', () => {
        const cmp = ReactDOM.render(<FeatureGrid describeFeatureType={describePois} features={museam.features}/>, document.getElementById("container"));
        expect(cmp).toExist();
        expect(document.getElementsByClassName('react-grid-HeaderCell').length).toBe(3);
        expect(document.getElementsByClassName('react-grid-Row').length).toBe(1);
    });
    it('render sample features with a tool', () => {
        const tool = {
            key: "test_tool",
            name: '',
            width: 35,
            locked: true
        };
        const cmp = ReactDOM.render(<FeatureGrid describeFeatureType={describePois} features={museam.features} tools={[tool]}/>, document.getElementById("container"));
        expect(cmp).toExist();
        expect(document.getElementsByClassName('react-grid-HeaderCell').length).toBe(4);
        expect(document.getElementsByClassName('react-grid-Row').length).toBe(1);
    });
    it('hide columns features', () => {
        const cmp = ReactDOM.render(<FeatureGrid describeFeatureType={describePois} features={museam.features} columnSettings={{NAME: {hide: true}}}/>, document.getElementById("container"));
        expect(cmp).toExist();
        expect(document.getElementsByClassName('react-grid-HeaderCell').length).toBe(2);
    });

    it('sort event', () => {
        const events = {
            onSort: () => {}
        };
        spyOn(events, "onSort");
        const cmp = ReactDOM.render(<FeatureGrid gridEvents={{onGridSort: events.onSort}} describeFeatureType={describePois} features={museam.features}/>, document.getElementById("container"));
        expect(cmp).toExist();
        document.getElementsByClassName('react-grid-HeaderCell-sortable')[0].click();
        expect(events.onSort).toHaveBeenCalled();
    });
});
