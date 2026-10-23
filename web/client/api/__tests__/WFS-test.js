import expect from 'expect';


import MockAdapter from 'axios-mock-adapter';
import axios from '../../libs/ajax';
import {
    getFeatureLayer,
    toDescribeURL,
    getCapabilitiesURL,
    getFeatureURL,
    getSupportedFormat,
    detectWFSVersion
} from '../WFS';

let mockAxios;

describe('Test WFS ogc API functions', () => {
    beforeEach(done => {
        mockAxios = new MockAdapter(axios);
        setTimeout(done);
    });

    afterEach(done => {
        mockAxios.restore();
        setTimeout(done);
    });

    const schemaString = 'xmlns:gml="http://www.opengis.net/gml" '
        + 'xmlns:wfs="http://www.opengis.net/wfs" '
        + 'xmlns:ogc="http://www.opengis.net/ogc" '
        + 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
        + 'xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd" ';
    it('getFeatureLayer', (done) => {
        mockAxios.onPost().reply(({ url, data, headers }) => {
            expect(url).toContain('test');
            expect(data).toEqual(
                `<wfs:GetFeature service="WFS" version="1.1.0" `
                + schemaString
                + `resultType="results" outputFormat="application/json">`
                + `<wfs:Query typeName="layer1" srsName="EPSG:4326"></wfs:Query></wfs:GetFeature>`);
            // check headers passed
            expect(headers.Authentication).toBe('Basic token');
            return [200, {
                featureTypes: [{
                    name: 'layer1'
                }]
            }];
        });
        getFeatureLayer({
            type: 'wfs',
            url: 'test',
            name: 'layer1',
            search: {
                url: 'linked-wfs',
                typeName: 'linked-layer'
            }
        }, {}, {
            headers: {
                'Authentication': 'Basic token'
            }
        }).then((data) => {
            expect(data).toExist();
            done();
        });
    });
    it('getFeatureLayer uses the linked WFS URL and type name', (done) => {
        mockAxios.onPost().reply(({ url, data }) => {
            expect(url).toBe('linked-wfs');
            expect(data).toContain('typeName="workspace:linked"');
            return [200, {type: 'FeatureCollection', features: []}];
        });
        getFeatureLayer({
            type: 'wms',
            url: 'wms-url',
            name: 'workspace:rendered',
            search: {
                type: 'wfs',
                url: 'linked-wfs',
                typeName: 'workspace:linked'
            }
        }).then(() => done()).catch(done);
    });
    it('getFeatureLayer with layerFilter', (done) => {
        mockAxios.onPost().reply(({ url, data }) => {
            expect(url).toContain('test');
            // some checks on the filter presence
            expect(data).toContain('<ogc:Filter>');
            expect(data).toContain('<ogc:PropertyIsEqualTo><ogc:PropertyName>prop</ogc:PropertyName><ogc:Literal>value</ogc:Literal></ogc:PropertyIsEqualTo>');
            return [200, {
                featureTypes: [{
                    name: 'layer1'
                }]
            }];
        });
        getFeatureLayer({
            type: 'wfs',
            url: 'test',
            name: 'layer1',
            layerFilter: {
                filters: [{
                    format: 'cql',
                    body: "prop = 'value'"
                }]
            }
        }).then((data) => {
            expect(data).toExist();
            done();
        });
    });
    it('getFeatureLayer with layer filter and filter passed', (done) => {
        mockAxios.onPost().reply(({ url, data }) => {
            expect(url).toContain('test');
            // some checks on the filter presence
            expect(data).toContain('<ogc:Filter><ogc:And>');
            expect(data).toContain('<ogc:PropertyIsEqualTo><ogc:PropertyName>prop</ogc:PropertyName><ogc:Literal>value</ogc:Literal></ogc:PropertyIsEqualTo>');
            expect(data).toContain('<ogc:PropertyIsEqualTo><ogc:PropertyName>prop2</ogc:PropertyName><ogc:Literal>value</ogc:Literal></ogc:PropertyIsEqualTo>');

            return [200, {
                featureTypes: [{
                    name: 'layer1'
                }]
            }];
        });
        getFeatureLayer({
            type: 'wfs',
            url: 'test',
            name: 'layer1',
            layerFilter: {
                filters: [{
                    format: 'cql',
                    body: "prop = 'value'"
                }]
            }
        }, {
            filters: [{
                // a mapstore filter
                filters: [{
                    format: 'cql',
                    body: "prop2 = 'value'"
                }]
            }]
        }).then((data) => {
            expect(data).toExist();
            done();
        });
    });

    it('getSupportedFormat without text/html format', (done) => {
        mockAxios.onGet().reply(200, `
            <wfs:WFS_Capabilities>
            <ows:OperationsMetadata>
            <ows:Operation name="GetFeature">
                <ows:Parameter name="outputFormat">
                    <ows:Value>text/xml; subtype=gml/3.1.1</ows:Value>
                    <ows:Value>GML2</ows:Value>
                    <ows:Value>KML</ows:Value>
                    <ows:Value>SHAPE-ZIP</ows:Value>
                    <ows:Value>application/geopackage+sqlite3</ows:Value>
                    <ows:Value>application/gml+xml; version=3.2</ows:Value>
                    <ows:Value>application/json</ows:Value>
                    <ows:Value>application/vnd.google-earth.kml xml</ows:Value>
                    <ows:Value>application/vnd.google-earth.kml+xml</ows:Value>
                    <ows:Value>application/x-gpkg</ows:Value>
                    <ows:Value>csv</ows:Value>
                    <ows:Value>geopackage</ows:Value>
                    <ows:Value>geopkg</ows:Value>
                    <ows:Value>gml3</ows:Value>
                    <ows:Value>gml32</ows:Value>
                    <ows:Value>gpkg</ows:Value>
                    <ows:Value>json</ows:Value>
                    <ows:Value>text/csv</ows:Value>
                    <ows:Value>text/xml; subtype=gml/2.1.2</ows:Value>
                    <ows:Value>text/xml; subtype=gml/3.2</ows:Value>
                </ows:Parameter>
            </ows:Operation>
            </ows:OperationsMetadata>
            </wfs:WFS_Capabilities>
            `);
        getSupportedFormat('/geoserver-without-text-html/wfs').then((data) => {
            expect(data).toEqual({ infoFormats: ['application/json'] });
            done();
        }).catch(done);
    });
    it('getSupportedFormat with text/html format', (done) => {
        mockAxios.onGet().reply(200, `
            <wfs:WFS_Capabilities>
            <ows:OperationsMetadata>
            <ows:Operation name="GetFeature">
                <ows:Parameter name="outputFormat">
                    <ows:Value>text/xml; subtype=gml/3.1.1</ows:Value>
                    <ows:Value>GML2</ows:Value>
                    <ows:Value>KML</ows:Value>
                    <ows:Value>SHAPE-ZIP</ows:Value>
                    <ows:Value>application/geopackage+sqlite3</ows:Value>
                    <ows:Value>application/gml+xml; version=3.2</ows:Value>
                    <ows:Value>application/json</ows:Value>
                    <ows:Value>application/vnd.google-earth.kml xml</ows:Value>
                    <ows:Value>application/vnd.google-earth.kml+xml</ows:Value>
                    <ows:Value>application/x-gpkg</ows:Value>
                    <ows:Value>csv</ows:Value>
                    <ows:Value>geopackage</ows:Value>
                    <ows:Value>geopkg</ows:Value>
                    <ows:Value>gml3</ows:Value>
                    <ows:Value>gml32</ows:Value>
                    <ows:Value>gpkg</ows:Value>
                    <ows:Value>json</ows:Value>
                    <ows:Value>text/csv</ows:Value>
                    <ows:Value>text/html</ows:Value>
                    <ows:Value>text/xml; subtype=gml/2.1.2</ows:Value>
                    <ows:Value>text/xml; subtype=gml/3.2</ows:Value>
                </ows:Parameter>
            </ows:Operation>
            </ows:OperationsMetadata>
            </wfs:WFS_Capabilities>
            `);
        getSupportedFormat('/geoserver-with-text-html/wfs').then((data) => {
            expect(data).toEqual({ infoFormats: ['application/json', 'text/html'] });
            done();
        }).catch(done);
    });

    it('getSupportedFormat with layer-specific URL', (done) => {
        mockAxios.onGet().reply((config) => {
            try {
                expect(config.url).toBe('/geoserver/workspace/layer_name/wfs?version=1.1.0&service=WFS&request=GetCapabilities');
            } catch (e) {
                done(e);
            }
            return [200, `
            <wfs:WFS_Capabilities>
            <ows:OperationsMetadata>
            <ows:Operation name="GetFeature">
                <ows:Parameter name="outputFormat">
                    <ows:Value>application/json</ows:Value>
                    <ows:Value>text/html</ows:Value>
                </ows:Parameter>
            </ows:Operation>
            </ows:OperationsMetadata>
            </wfs:WFS_Capabilities>
            `];
        });
        getSupportedFormat('/geoserver/workspace/layer_name/wfs').then((data) => {
            expect(data).toEqual({ infoFormats: ['application/json', 'text/html'] });
            done();
        }).catch(done);
    });

    it('toDescribeURL with URL array', () => {
        const _url = [
            'http://gs-stable.geosolutionsgroup.com:443/geoserver1',
            'http://gs-stable.geosolutionsgroup.com:443/geoserver2',
            'http://gs-stable.geosolutionsgroup.com:443/geoserver3'
        ];

        expect(toDescribeURL(_url, 'testName').split('?')[0]).toBe(_url[0]);
    });
    it('getCapabilitiesURL with URL array', () => {
        const _url = [
            'http://gs-stable.geosolutionsgroup.com:443/geoserver1',
            'http://gs-stable.geosolutionsgroup.com:443/geoserver2',
            'http://gs-stable.geosolutionsgroup.com:443/geoserver3'
        ];

        expect(getCapabilitiesURL(_url).split('?')[0]).toBe(_url[0]);
    });
    it('getFeatureURL with URL array', () => {
        const _url = [
            'http://gs-stable.geosolutionsgroup.com:443/geoserver1',
            'http://gs-stable.geosolutionsgroup.com:443/geoserver2',
            'http://gs-stable.geosolutionsgroup.com:443/geoserver3'
        ];

        expect(getFeatureURL(_url).split('?')[0]).toBe(_url[0]);
    });

    it('getFeatureURL if it includes getCapabilites request', () => {
        const _url = 'http://gs-stable.geosolutionsgroup.com:443/geoserver3/wfs?service=WFS&version=1.1.0&request=GetCapabilities';
        const featureURL = getFeatureURL(_url, "layerName");
        expect(featureURL.includes("request=GetFeature")).toBeTruthy();
        expect(featureURL.split('?')[1]).toEqual('typeName=layerName&version=1.1.0&service=WFS&request=GetFeature');
    });

    it('getFeatureURL if it includes normal getFeature request with version different than the default one', () => {
        const _url = 'http://gs-stable.geosolutionsgroup.com:443/geoserver3/wfs?service=WFS&version=1.1.1&request=GetFeature';
        const featureURL = getFeatureURL(_url, "layerName");
        expect(featureURL.split('?')[1]).toEqual('typeName=layerName&version=1.1.1&service=WFS&request=GetFeature');
    });
    it('getFeatureURL renames the KVP parameters for WFS 2.0.0', () => {
        const featureURL = getFeatureURL('http://wfs.example/ows', 'topp:states', { version: '2.0', maxFeatures: 10, featureId: 'states.1', outputFormat: 'application/json' });
        const params = Object.fromEntries(new URL(featureURL).searchParams.entries());
        expect(params).toEqual({
            typeNames: 'topp:states',
            version: '2.0.0',
            service: 'WFS',
            request: 'GetFeature',
            count: '10',
            resourceId: 'states.1',
            outputFormat: 'application/json'
        });
    });
    it('getFeatureURL keeps the WFS 1.1.0 parameters', () => {
        const featureURL = getFeatureURL('http://wfs.example/ows', 'topp:states', { maxFeatures: 10, featureId: 'states.1' });
        const params = Object.fromEntries(new URL(featureURL).searchParams.entries());
        expect(params).toEqual({
            typeName: 'topp:states',
            version: '1.1.0',
            service: 'WFS',
            request: 'GetFeature',
            maxFeatures: '10',
            featureId: 'states.1'
        });
    });
    it('getFeatureLayer sends a FES 2.0 filter for a layer on WFS 2.0.0', (done) => {
        mockAxios.onPost().reply(({ data }) => {
            expect(data).toContain('<wfs:GetFeature service="WFS" version="2.0.0"');
            expect(data).toContain('<wfs:Query typeNames="topp:states" srsName="EPSG:4326">'
                + '<fes:Filter><fes:PropertyIsEqualTo><fes:ValueReference>STATE_NAME</fes:ValueReference><fes:Literal>Arizona</fes:Literal></fes:PropertyIsEqualTo></fes:Filter>'
                + '</wfs:Query>');
            return [200, {}];
        });
        const layerFilter = {
            groupFields: [{ id: 1, logic: 'OR', index: 0 }],
            filterFields: [{ attribute: 'STATE_NAME', groupId: 1, operator: '=', type: 'string', value: 'Arizona', rowId: '1' }]
        };
        getFeatureLayer({ type: 'wfs', url: 'http://wfs.example/ows', name: 'topp:states', search: { type: 'wfs', url: 'http://wfs.example/ows', wfsVersion: '2.0.0' }, layerFilter })
            .then(() => done())
            .catch(done);
    });
    describe('detectWFSVersion', () => {
        const capabilities = (version) => `<?xml version="1.0" encoding="UTF-8"?><wfs:WFS_Capabilities version="${version}" xmlns:wfs="http://www.opengis.net/wfs/2.0"><ows:ServiceIdentification/></wfs:WFS_Capabilities>`;
        it('asks the service the highest version with a small request', (done) => {
            mockAxios.onGet().reply(({ url }) => {
                const params = Object.fromEntries(new URL(url).searchParams.entries());
                expect(params).toEqual({
                    map: 'wfs',
                    service: 'WFS',
                    request: 'GetCapabilities',
                    AcceptVersions: '2.0.0,1.1.0',
                    Sections: 'ServiceIdentification'
                });
                return [200, capabilities('2.0.0')];
            });
            detectWFSVersion('http://detect.example/wfs-2?map=wfs')
                .then((version) => {
                    expect(version).toBe('2.0.0');
                    done();
                })
                .catch(done);
        });
        it('returns 1.1.0 for a WFS 1.1.0 service', (done) => {
            mockAxios.onGet().reply(200, capabilities('1.1.0'));
            detectWFSVersion('http://detect.example/wfs-1').then((version) => {
                expect(version).toBe('1.1.0');
                done();
            }).catch(done);
        });
        it('returns undefined for an unsupported version or an error', (done) => {
            mockAxios.onGet(/wfs-old/).reply(200, capabilities('1.0.0'));
            mockAxios.onGet(/wfs-down/).reply(500);
            Promise.all([detectWFSVersion('http://detect.example/wfs-old'), detectWFSVersion('http://detect.example/wfs-down')])
                .then(([old, down]) => {
                    expect(old).toBe(undefined);
                    expect(down).toBe(undefined);
                    done();
                })
                .catch(done);
        });
    });
});
