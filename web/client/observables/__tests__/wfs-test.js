/*
 * Copyright 2024, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { toDescribeURL, getFeatureUtilities, getLayerJSONFeature } from '../wfs';
import expect from 'expect';
import axios from '../../libs/ajax';
import MockAdapter from 'axios-mock-adapter';
let mockAxios;

describe("WFS Observables", () => {
    beforeEach(done => {
        mockAxios = new MockAdapter(axios);
        setTimeout(done);
    });
    afterEach(done => {
        mockAxios.restore();
        setTimeout(done);
    });
    it('toDescribeURL', () => {
        const _url = [
            'http://gs-stable.geosolutionsgroup.com:443/geoserver1',
            'http://gs-stable.geosolutionsgroup.com:443/geoserver2',
            'http://gs-stable.geosolutionsgroup.com:443/geoserver3'
        ];

        expect(toDescribeURL({ name: 'testName', search: { url: _url }}).split('?')[0]).toBe(_url[0]);
    });
    it('getFeatureUtilities', () => {
        const _url = [
            'http://gs-stable.geosolutionsgroup.com:443/geoserver1',
            'http://gs-stable.geosolutionsgroup.com:443/geoserver2',
            'http://gs-stable.geosolutionsgroup.com:443/geoserver3'
        ];

        expect(getFeatureUtilities(_url, 'filterObject').queryString.split('?')[0]).toBe(_url[0]);
    });
    it('getLayerJSONFeature - no wfsVersion → WFS 1.1.0 request', done => {
        let capturedBody;
        mockAxios.onPost().reply(config => { capturedBody = config.data; return [200, { features: [], totalFeatures: 0, numberMatched: 0 }]; });
        getLayerJSONFeature({ url: 'http://wfs', name: 'topp:states', search: { url: 'http://wfs', type: 'wfs' } }, null, {})
            .subscribe(() => {
                expect(capturedBody).toInclude('version="1.1.0"');
                expect(capturedBody).toInclude('typeName="topp:states"');
                expect(capturedBody).toNotInclude('version="2.0');
                done();
            }, done);
    });
    it('getLayerJSONFeature - search.wfsVersion="2.0.0" → WFS 2.0 request', done => {
        let capturedBody;
        mockAxios.onPost().reply(config => { capturedBody = config.data; return [200, { features: [], totalFeatures: 0, numberMatched: 0 }]; });
        getLayerJSONFeature({ url: 'http://wfs', name: 'topp:states', search: { url: 'http://wfs', type: 'wfs', wfsVersion: '2.0.0' } }, null, {})
            .subscribe(() => {
                expect(capturedBody).toInclude('version="2.0.0"');
                expect(capturedBody).toInclude('typeNames="topp:states"');
                expect(capturedBody).toNotInclude('version="1.1.0"');
                done();
            }, done);
    });
    it('getLayerJSONFeature - layer.wfsVersion fallback when search has no wfsVersion', done => {
        let capturedBody;
        mockAxios.onPost().reply(config => { capturedBody = config.data; return [200, { features: [], totalFeatures: 0, numberMatched: 0 }]; });
        getLayerJSONFeature({ url: 'http://wfs', name: 'topp:states', wfsVersion: '2.0.0', search: { url: 'http://wfs', type: 'wfs' } }, null, {})
            .subscribe(() => {
                expect(capturedBody).toInclude('version="2.0.0"');
                done();
            }, done);
    });
    it('getLayerJSONFeature - search.wfsVersion takes priority over layer.wfsVersion', done => {
        let capturedBody;
        mockAxios.onPost().reply(config => { capturedBody = config.data; return [200, { features: [], totalFeatures: 0, numberMatched: 0 }]; });
        getLayerJSONFeature({ url: 'http://wfs', name: 'topp:states', wfsVersion: '1.1.0', search: { url: 'http://wfs', type: 'wfs', wfsVersion: '2.0.0' } }, null, {})
            .subscribe(() => {
                expect(capturedBody).toInclude('version="2.0.0"');
                done();
            }, done);
    });
});
