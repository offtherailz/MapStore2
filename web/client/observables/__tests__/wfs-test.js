/*
 * Copyright 2024, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { parse } from 'url';
import MockAdapter from 'axios-mock-adapter';

import axios from '../../libs/ajax';
import { toDescribeURL, toLayerCapabilitiesURL, getFeatureUtilities, getLayerJSONFeature } from '../wfs';
import expect from 'expect';

describe("WFS Observables", () => {
    it('toDescribeURL', () => {
        const _url = [
            'http://gs-stable.geosolutionsgroup.com:443/geoserver1',
            'http://gs-stable.geosolutionsgroup.com:443/geoserver2',
            'http://gs-stable.geosolutionsgroup.com:443/geoserver3'
        ];

        expect(toDescribeURL({ name: 'testName', search: { url: _url }}).split('?')[0]).toBe(_url[0]);
    });
    it('uses the linked WFS type name in DescribeFeatureType requests', () => {
        const parsed = parse(toDescribeURL({
            type: 'wms',
            name: 'workspace:wms-name',
            url: 'wms-url',
            search: {url: 'wfs-url', typeName: 'workspace:wfs-name'}
        }), true);
        expect(parsed.query.typeName).toBe('workspace:wfs-name');
    });
    it('falls back to the WMS name and ignores search.typeName for native WFS', () => {
        expect(parse(toDescribeURL({
            type: 'wms',
            name: 'workspace:wms-name',
            search: {url: 'wfs-url'}
        }), true).query.typeName).toBe('workspace:wms-name');
        expect(parse(toDescribeURL({
            type: 'wfs',
            name: 'workspace:native-wfs-name',
            url: 'wfs-url',
            search: {typeName: 'workspace:ignored'}
        }), true).query.typeName).toBe('workspace:native-wfs-name');
    });
    it('uses the linked WFS type name in GetFeature requests', (done) => {
        const mockAxios = new MockAdapter(axios);
        mockAxios.onPost().reply(({data}) => {
            expect(data).toContain('typeName="workspace:linked"');
            return [200, {type: 'FeatureCollection', features: []}];
        });
        getLayerJSONFeature({
            type: 'wms',
            name: 'workspace:rendered',
            search: {url: 'wfs-url', typeName: 'workspace:linked'}
        }).subscribe(() => {
            mockAxios.restore();
            done();
        }, (error) => {
            mockAxios.restore();
            done(error);
        });
    });
    it('DescribeFeatureType and GetCapabilities use the version of the layer', () => {
        const legacy = parse(toDescribeURL({ type: 'wfs', name: 'topp:states', url: 'wfs-url' }), true).query;
        expect(legacy.version).toBe('1.1.0');
        expect(legacy.typeName).toBe('topp:states');
        expect(legacy.typeNames).toBe(undefined);
        const wfs2 = parse(toDescribeURL({ type: 'wfs', name: 'topp:states', url: 'wfs-url', search: { url: 'wfs-url', wfsVersion: '2.0.0' } }), true).query;
        expect(wfs2.version).toBe('2.0.0');
        expect(wfs2.typeNames).toBe('topp:states');
        expect(wfs2.typeName).toBe(undefined);
        expect(parse(toLayerCapabilitiesURL({ type: 'wfs', name: 'states', url: 'wfs-url' }), true).query.version).toBe('1.1.0');
        expect(parse(toLayerCapabilitiesURL({ type: 'wfs', name: 'states', url: 'wfs-url', wfsVersion: '2.0' }), true).query.version).toBe('2.0.0');
    });
    it('a layer without version sends the legacy WFS 1.1.0 request and resolves no namespace', (done) => {
        const mockAxios = new MockAdapter(axios);
        mockAxios.onGet().reply(500);
        mockAxios.onPost().reply(({ data }) => {
            expect(data).toContain('<wfs:GetFeature service="WFS" version="1.1.0"');
            expect(data).toContain('startIndex="0" maxFeatures="10"');
            expect(data).toContain('<wfs:Query typeName="topp:states" srsName="EPSG:4326">');
            expect(data).toNotContain('xmlns:topp');
            return [200, { type: 'FeatureCollection', features: [] }];
        });
        getLayerJSONFeature({ type: 'wms', name: 'topp:states', search: { url: 'legacy-url' } }, undefined, { startIndex: 0, maxFeatures: 10 })
            .subscribe(() => {
                expect(mockAxios.history.get.length).toBe(0);
                mockAxios.restore();
                done();
            }, (error) => {
                mockAxios.restore();
                done(error);
            });
    });
    it('a layer on WFS 2.0.0 declares the namespace of its type name and pages with count', (done) => {
        const mockAxios = new MockAdapter(axios);
        mockAxios.onGet().reply(({ url }) => {
            expect(parse(url, true).query.request).toBe('DescribeFeatureType');
            return [200, { targetPrefix: 'topp', targetNamespace: 'http://www.openplans.org/topp', featureTypes: [] }];
        });
        mockAxios.onPost().reply(({ data }) => {
            expect(data).toContain('<wfs:GetFeature service="WFS" version="2.0.0"');
            expect(data).toContain(' xmlns:topp="http://www.openplans.org/topp" startIndex="20" count="10">');
            expect(data).toContain('<wfs:Query typeNames="topp:states" srsName="EPSG:4326">'
                + '<wfs:PropertyName>STATE_NAME</wfs:PropertyName>'
                + '<fes:SortBy><fes:SortProperty><fes:ValueReference>STATE_NAME</fes:ValueReference><fes:SortOrder>DESC</fes:SortOrder></fes:SortProperty></fes:SortBy>'
                + '</wfs:Query>');
            return [200, { type: 'FeatureCollection', features: [] }];
        });
        getLayerJSONFeature(
            { type: 'wms', name: 'topp:states', search: { url: 'wfs2-url', wfsVersion: '2.0.0' } },
            undefined,
            { startIndex: 20, maxFeatures: 10, propertyName: ['STATE_NAME'], sortOptions: { sortBy: 'STATE_NAME', sortOrder: 'DESC' } }
        ).subscribe(() => {
            expect(mockAxios.history.get.length).toBe(1);
            expect(mockAxios.history.post.length).toBe(1);
            mockAxios.restore();
            done();
        }, (error) => {
            mockAxios.restore();
            done(error);
        });
    });
    it('getFeatureUtilities', () => {
        const _url = [
            'http://gs-stable.geosolutionsgroup.com:443/geoserver1',
            'http://gs-stable.geosolutionsgroup.com:443/geoserver2',
            'http://gs-stable.geosolutionsgroup.com:443/geoserver3'
        ];

        expect(getFeatureUtilities(_url, 'filterObject').queryString.split('?')[0]).toBe(_url[0]);
    });
});
