/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import Rx from 'rxjs';
import url from 'url';
import * as TestUtils from 'react-dom/test-utils';

import Legend from '../Legend';

describe("test the Layer legend", () => {
    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        setTimeout(done);
    });

    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(document.getElementById("container"));
        document.body.innerHTML = '';
        setTimeout(done);
    });

    it('test component creation', () => {
        let layer = {
            "type": "osm",
            "title": "Open Street Map",
            "name": "mapnik",
            "group": "background",
            "visibility": true
        };
        const tb = ReactDOM.render(<Legend layer={layer}/>, document.getElementById("container"));
        expect(tb).toBeTruthy();

    });

    it('create component without layer', () => {

        const tb = ReactDOM.render(<Legend />, document.getElementById("container"));
        expect(tb).toBeTruthy();

    });
    it('test legend content', () => {
        let layer = {
            "type": "wms",
            "url": "http://test2/reflector/open/service",
            "visibility": true,
            "title": "test layer 3 (no group)",
            "name": "layer3",
            "format": "image/png"
        };
        var tb = ReactDOM.render(<Legend layer={layer} />, document.getElementById("container"));
        let thumbs = TestUtils.scryRenderedDOMComponentsWithTag(tb, "img");
        expect(thumbs.length).toBe(1);
    });
    it('test legend img error content', (done) => {
        let layer = {
            "type": "wms",
            "url": "base/web/client/test-resources/legendImgError.xml",
            "visibility": true,
            "title": "test layer 3 (no group)",
            "name": "layer3",
            "format": "image/png"
        };
        var tb = ReactDOM.render(<Legend layer={layer} />, document.getElementById("container"));
        const sub = Rx.Observable.interval(100)
            .filter(() => tb && tb.state.error)
            .subscribe(() => {
                let thumbs = TestUtils.scryRenderedDOMComponentsWithTag(tb, "img");
                expect(thumbs.length).toBe(0);
                sub.unsubscribe();
                done();
            });
    });
    it('test legend img error reload', (done) => {
        let layer = {
            "type": "wms",
            "url": "base/web/client/test-resources/legendImgError.xml",
            "visibility": true,
            "title": "test layer 3 (no group)",
            "name": "layer3",
            "format": "image/png"
        };
        var tb = ReactDOM.render(<Legend layer={layer} />, document.getElementById("container"));
        const sub = Rx.Observable.interval(100)
            .filter(() => tb && tb.state.error)
            .subscribe(() => {
                let thumbs = TestUtils.scryRenderedDOMComponentsWithTag(tb, "img");
                expect(thumbs.length).toBe(0);
                const newLayer = {...layer, url: "http://test2/reflector/open/service"};
                tb = ReactDOM.render(<Legend layer={newLayer} />, document.getElementById("container"));
                thumbs = TestUtils.scryRenderedDOMComponentsWithTag(tb, "img");
                expect(thumbs.length).toBe(1);
                sub.unsubscribe();
                done();
            });
    });
    it('test legend with small 1px x 2px img error reload', (done) => {
        let layer = {
            "type": "wms",
            "url": "base/web/client/test-resources/img/geoserver-GetLegendGraphic.image",
            "visibility": true,
            "title": "test layer 3 (no group)",
            "name": "layer3",
            "format": "image/png"
        };
        var tb = ReactDOM.render(<Legend layer={layer} />, document.getElementById("container"));
        const sub = Rx.Observable.interval(100)
            .filter(() => tb && tb.state.error)
            .subscribe(() => {
                let thumbs = TestUtils.scryRenderedDOMComponentsWithTag(tb, "img");
                let spans = TestUtils.scryRenderedDOMComponentsWithTag(tb, "span");

                expect(spans[0].innerText).toBe("layerProperties.legenderror");
                expect(thumbs.length).toBe(0);
                sub.unsubscribe();
                done();
            });
    });
    it('test legend scaleDependent and legendOptions default props', () => {
        const layer = {
            "type": "wms",
            "url": "http://test2/reflector/open/service",
            "visibility": true,
            "title": "test layer 3 (no group)",
            "name": "layer3",
            "format": "image/png"
        };
        const legendComponent = ReactDOM.render(<Legend layer={layer} />, document.getElementById("container"));
        expect(legendComponent.props.legendOptions).toBe('forceLabels:on');
        expect(legendComponent.props.legendWidth).toBe(12);
        expect(legendComponent.props.legendHeight).toBe(12);
        expect(legendComponent.props.scaleDependent).toBe(true);
    });
    it('test legend scaleDependent and legendOptions custom props', () => {
        const layer = {
            "type": "wms",
            "url": "http://test2/reflector/open/service",
            "visibility": true,
            "title": "test layer 3 (no group)",
            "name": "layer3",
            "format": "image/png"
        };
        const legendOptionsCustom = {
            WMSLegendOptions: 'forceLabels:on;fontSize:50',
            legendWidth: 20,
            legendHeight: 30
        };
        const scaleDependentCustom = false;
        const legendComponent = ReactDOM.render(
            <Legend
                layer={layer}
                legendOptions={legendOptionsCustom.WMSLegendOptions}
                legendWidth={legendOptionsCustom.legendWidth}
                legendHeight={legendOptionsCustom.legendHeight}
                scaleDependent={scaleDependentCustom}/>,
            document.getElementById("container"));
        expect(legendComponent.props.legendOptions).toBe('forceLabels:on;fontSize:50');
        expect(legendComponent.props.legendWidth).toBe(20);
        expect(legendComponent.props.legendHeight).toBe(30);
        expect(legendComponent.props.scaleDependent).toBe(scaleDependentCustom);
    });
    it('should apply the scale correctly even for zoom with decimal values', () => {
        const layer = {
            "type": "wms",
            "url": "http://test2/reflector/open/service",
            "visibility": true,
            "title": "test layer 3 (no group)",
            "name": "layer3",
            "format": "image/png"
        };
        TestUtils.act(() => {
            ReactDOM.render(
                <Legend
                    layer={layer}
                    currentZoomLvl={2.3456}
                    scales={[10000, 5000, 2000, 1000]}
                />,
                document.getElementById("container"));
        });
        const legendImage = document.querySelector("img");
        expect(legendImage).toBeTruthy();
        const { query } = url.parse(legendImage.getAttribute('src'), true);
        expect(query.SCALE).toBe('2000');
    });
    it('should apply the scale correctly even for zoom exceed the maximum scales index', () => {
        const layer = {
            "type": "wms",
            "url": "http://test2/reflector/open/service",
            "visibility": true,
            "title": "test layer 3 (no group)",
            "name": "layer3",
            "format": "image/png"
        };
        TestUtils.act(() => {
            ReactDOM.render(
                <Legend
                    layer={layer}
                    currentZoomLvl={10}
                    scales={[10000, 5000, 2000, 1000]}
                />,
                document.getElementById("container"));
        });
        const legendImage = document.querySelector("img");
        expect(legendImage).toBeTruthy();
        const { query } = url.parse(legendImage.getAttribute('src'), true);
        expect(query.SCALE).toBe('1000');
    });
});
