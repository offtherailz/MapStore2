/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';
import requestBuilder from '../RequestBuilder';

const TEST_REQUEST_V2 = '<wfs:GetFeature service="WFS" version="2.0.0" xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:fes="http://www.opengis.net/fes/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.opengis.net/wfs/2.0 http://schemas.opengis.net/wfs/2.0/wfs.xsd http://www.opengis.net/gml/3.2 http://schemas.opengis.net/gml/3.2.1/gml.xsd"><wfs:Query typeNames="ft_name_test" srsName="EPSG:4326"><fes:Filter><fes:And><fes:Or><fes:PropertyIsEqualTo><fes:ValueReference>highway_system</fes:ValueReference><fes:Literal>state</fes:Literal></fes:PropertyIsEqualTo></fes:Or></fes:And></fes:Filter></wfs:Query></wfs:GetFeature>';

const TEST_REQUEST_V1_POLY = '<wfs:GetFeature service="WFS" version="1.0.0" outputFormat="GML2" xmlns:gml="http://www.opengis.net/gml" xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.0.0/WFS-basic.xsd"><wfs:Query typeName="ft_name_test" srsName="EPSG:4326"><ogc:Filter><ogc:Intersects><ogc:PropertyName>geometry</ogc:PropertyName><gml:Polygon srsName="EPSG:4326"><gml:outerBoundaryIs><gml:LinearRing><gml:coordinates>1,1 1,2 2,2 2,1 1,1</gml:coordinates></gml:LinearRing></gml:outerBoundaryIs></gml:Polygon></ogc:Intersects></ogc:Filter></wfs:Query></wfs:GetFeature>';
describe('RequestBuilder Operators', () => {
    it('RequestBuilder WFS 2.0', () => {
        const {filter, and, or, getFeature, property, query} = requestBuilder({wfsVersion: "2.0"});
        expect(
            getFeature(query("ft_name_test",
                filter(and(or(property("highway_system").equalTo("state"))))
            ))
        ).toBe(TEST_REQUEST_V2);
    });
    it('RequestBuilder WFS 1.0.0', () => {
        const geom = {
            "type": "Polygon",
            "projection": "EPSG:4326",
            "coordinates": [[[1, 1], [1, 2], [2, 2], [2, 1], [1, 1]]]
        };
        const {filter, getFeature, property, query} = requestBuilder({wfsVersion: "1.0.0"});
        expect(
            getFeature(query("ft_name_test",
                filter(property("geometry").intersects(geom))
            ))
        ).toBe(TEST_REQUEST_V1_POLY);
    });
    it('RequestBuilder WFS - 1.1.0 Polygon', () => {
        let geom = {
            "type": "Polygon",
            "projection": "EPSG:4326",
            "coordinates": [[[1, 1], [1, 2], [2, 2], [2, 1], [1, 1]]]
        };
        const {filter, getFeature, property, query} = requestBuilder({wfsVersion: "1.1.0"});
        let expected = '<wfs:GetFeature service="WFS" version="1.1.0" xmlns:gml="http://www.opengis.net/gml" xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd"><wfs:Query typeName="ft_name_test" srsName="EPSG:4326"><ogc:Filter><ogc:Intersects><ogc:PropertyName>geometry</ogc:PropertyName><gml:Polygon srsName="EPSG:4326"><gml:exterior><gml:LinearRing><gml:posList>1 1 1 2 2 2 2 1 1 1</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon></ogc:Intersects></ogc:Filter></wfs:Query></wfs:GetFeature>';
        expect(
            getFeature(query("ft_name_test",
                filter(property("geometry").intersects(geom))
            ))
        ).toBe(expected);

        // test change srsName
        let geom2 = {
            "type": "Polygon",
            "projection": "EPSG:3857",
            "coordinates": [[[1, 1], [1, 2], [2, 2], [2, 1], [1, 1]]]
        };
        let expected2 = '<wfs:GetFeature service="WFS" version="1.1.0" xmlns:gml="http://www.opengis.net/gml" xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd"><wfs:Query typeName="ft_name_test" srsName="EPSG:3857"><ogc:Filter><ogc:Intersects><ogc:PropertyName>geometry</ogc:PropertyName><gml:Polygon srsName="EPSG:3857"><gml:exterior><gml:LinearRing><gml:posList>1 1 1 2 2 2 2 1 1 1</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon></ogc:Intersects></ogc:Filter></wfs:Query></wfs:GetFeature>';
        expect(
            getFeature(query("ft_name_test",
                filter(property("geometry").intersects(geom2)),
                {srsName: "EPSG:3857"}
            ))
        ).toBe(expected2);

        // params
        let geom3 = {
            "type": "Polygon",
            "projection": "EPSG:3857",
            "coordinates": [[[1, 1], [1, 2], [2, 2], [2, 1], [1, 1]]]
        };
        let expected3 = '<wfs:GetFeature service="WFS" version="1.1.0" xmlns:gml="http://www.opengis.net/gml" xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd" outputFormat="application/json"><wfs:Query typeName="ft_name_test" srsName="EPSG:3857"><ogc:Filter><ogc:Intersects><ogc:PropertyName>geometry</ogc:PropertyName><gml:Polygon srsName="EPSG:3857"><gml:exterior><gml:LinearRing><gml:posList>1 1 1 2 2 2 2 1 1 1</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon></ogc:Intersects></ogc:Filter></wfs:Query></wfs:GetFeature>';
        expect(
            getFeature(query("ft_name_test",
                filter(property("geometry").intersects(geom3)),
                {srsName: "EPSG:3857"}
            ), {outputFormat: "application/json"})
        ).toBe(expected3);
    });
    it('test PropertyName and sortBy usage WFS 1.1.0', () => {
        const {filter, getFeature, property, query, propertyName, sortBy} = requestBuilder({wfsVersion: "1.1.0"});
        const expected = '<wfs:GetFeature service="WFS" version="1.1.0"'
            + ' xmlns:gml="http://www.opengis.net/gml"'
            + ' xmlns:wfs="http://www.opengis.net/wfs"'
            + ' xmlns:ogc="http://www.opengis.net/ogc"'
            + ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">'
            + '<wfs:Query typeName="ft_name_test" srsName="EPSG:4326">'
                + '<ogc:SortBy>'
                    + '<ogc:SortProperty>'
                        + '<ogc:PropertyName>highway_system</ogc:PropertyName>'
                        + '<ogc:SortOrder>A</ogc:SortOrder>'
                    + '</ogc:SortProperty>'
                + '</ogc:SortBy>'
                + '<ogc:PropertyName>highway_system</ogc:PropertyName>'
                + '<ogc:PropertyName>name</ogc:PropertyName>'
                + '<ogc:Filter>'
                    + '<ogc:PropertyIsEqualTo>'
                        + '<ogc:PropertyName>highway_system</ogc:PropertyName>'
                        + '<ogc:Literal>state</ogc:Literal>'
                    + '</ogc:PropertyIsEqualTo>'
                + '</ogc:Filter>'
            + '</wfs:Query>'
        + '</wfs:GetFeature>';
        expect(
            getFeature(query("ft_name_test",
                [
                    sortBy("highway_system", "A"),
                    propertyName(["highway_system", "name"]),
                    filter(property("highway_system").equalTo("state"))
                ]

            ))
        ).toBe(
            expected
        );

    });
    it('WFS 2.0.0 - version string normalized from "2.0" to "2.0.0"', () => {
        const {getFeature, query} = requestBuilder({wfsVersion: "2.0"});
        const xml = getFeature(query("ft_name_test", []));
        expect(xml).toInclude('version="2.0.0"');
        expect(xml).toNotInclude('version="2.0"');
    });
    it('WFS 2.0.0 - version "2.0.0" passes through unchanged', () => {
        const {getFeature, query} = requestBuilder({wfsVersion: "2.0.0"});
        const xml = getFeature(query("ft_name_test", []));
        expect(xml).toInclude('version="2.0.0"');
    });
    it('WFS 2.0 - uses count not maxFeatures for pagination', () => {
        const {getFeature, query} = requestBuilder({wfsVersion: "2.0"});
        const xml = getFeature(query("ft_name_test", []), {maxFeatures: 20, startIndex: 0});
        expect(xml).toInclude('count="20"');
        expect(xml).toNotInclude('maxFeatures');
        expect(xml).toInclude('startIndex="0"');
    });
    it('WFS 1.1.0 - uses maxFeatures not count for pagination', () => {
        const {getFeature, query} = requestBuilder({wfsVersion: "1.1.0"});
        const xml = getFeature(query("ft_name_test", []), {maxFeatures: 20, startIndex: 0});
        expect(xml).toInclude('maxFeatures="20"');
        expect(xml).toNotInclude('"count"');
        expect(xml).toInclude('startIndex="0"');
    });
    it('WFS 2.0 - uses typeNames attribute', () => {
        const {getFeature, query} = requestBuilder({wfsVersion: "2.0"});
        const xml = getFeature(query("topp:states", []));
        expect(xml).toInclude('typeNames="topp:states"');
        expect(xml).toNotInclude('typeName=');
    });
    it('WFS 1.1.0 - uses typeName attribute', () => {
        const {getFeature, query} = requestBuilder({wfsVersion: "1.1.0"});
        const xml = getFeature(query("topp:states", []));
        expect(xml).toInclude('typeName="topp:states"');
        expect(xml).toNotInclude('typeNames=');
    });
    it('extraNamespaces injected into GetFeature root element', () => {
        const {getFeature, query} = requestBuilder({wfsVersion: "1.1.0"});
        const xml = getFeature(query("topp:states", []), {extraNamespaces: 'xmlns:topp="http://www.openplans.org/topp"'});
        expect(xml).toInclude('xmlns:topp="http://www.openplans.org/topp"');
    });
    it('WFS 2.0 - sortBy uses fes: prefix with ASC order', () => {
        const {sortBy} = requestBuilder({wfsVersion: "2.0"});
        const xml = sortBy("my_prop", "ASC");
        expect(xml).toInclude('<fes:SortBy>');
        expect(xml).toInclude('<fes:SortOrder>ASC</fes:SortOrder>');
        expect(xml).toNotInclude('<wfs:SortBy>');
        expect(xml).toNotInclude('<ogc:SortBy>');
    });
    it('WFS 2.0 - sortBy uses fes: prefix with DESC order', () => {
        const {sortBy} = requestBuilder({wfsVersion: "2.0"});
        const xml = sortBy("my_prop", "DESC");
        expect(xml).toInclude('<fes:SortOrder>DESC</fes:SortOrder>');
    });
    it('WFS 1.1.0 - sortBy uses ogc: prefix', () => {
        const {sortBy} = requestBuilder({wfsVersion: "1.1.0"});
        const xml = sortBy("my_prop", "ASC");
        expect(xml).toInclude('<ogc:SortBy>');
        expect(xml).toNotInclude('<wfs:SortBy>');
        expect(xml).toNotInclude('<fes:SortBy>');
    });
    it('WFS 2.0 - fes: namespace in filter, no ogc:', () => {
        const {filter, getFeature, property, query} = requestBuilder({wfsVersion: "2.0"});
        const xml = getFeature(query("ft_name_test", [filter(property("prop").equalTo("val"))]));
        expect(xml).toInclude('<fes:Filter>');
        expect(xml).toInclude('<fes:ValueReference>');
        expect(xml).toNotInclude('<ogc:Filter>');
        expect(xml).toNotInclude('<ogc:PropertyName>');
    });
    it('WFS 1.1.0 - ogc: namespace in filter, no fes:', () => {
        const {filter, getFeature, property, query} = requestBuilder({wfsVersion: "1.1.0"});
        const xml = getFeature(query("ft_name_test", [filter(property("prop").equalTo("val"))]));
        expect(xml).toInclude('<ogc:Filter>');
        expect(xml).toInclude('<ogc:PropertyName>');
        expect(xml).toNotInclude('<fes:Filter>');
        expect(xml).toNotInclude('<fes:ValueReference>');
    });
    it('test PropertyName and sortBy usage WFS 2.0', () => {
        const {filter, getFeature, property, query, propertyName, sortBy} = requestBuilder({wfsVersion: "2.0"});
        const expected = '<wfs:GetFeature service="WFS" version="2.0.0"'
            + ' xmlns:wfs="http://www.opengis.net/wfs/2.0"'
            + ' xmlns:fes="http://www.opengis.net/fes/2.0"'
            + ' xmlns:gml="http://www.opengis.net/gml/3.2"'
            + ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.opengis.net/wfs/2.0 http://schemas.opengis.net/wfs/2.0/wfs.xsd http://www.opengis.net/gml/3.2 http://schemas.opengis.net/gml/3.2.1/gml.xsd">'
            + '<wfs:Query typeNames="ft_name_test" srsName="EPSG:4326">'
                + '<fes:SortBy>'
                    + '<fes:SortProperty>'
                        + '<fes:ValueReference>highway_system</fes:ValueReference>'
                        + '<fes:SortOrder>A</fes:SortOrder>'
                    + '</fes:SortProperty>'
                + '</fes:SortBy>'
                + '<fes:PropertyName>highway_system</fes:PropertyName>'
                + '<fes:PropertyName>name</fes:PropertyName>'
                + '<fes:Filter>'
                    + '<fes:PropertyIsEqualTo>'
                        + '<fes:ValueReference>highway_system</fes:ValueReference>'
                        + '<fes:Literal>state</fes:Literal>'
                    + '</fes:PropertyIsEqualTo>'
                + '</fes:Filter>'
            + '</wfs:Query>'
        + '</wfs:GetFeature>';
        expect(
            getFeature(query("ft_name_test",
                [
                    sortBy("highway_system", "A"),
                    propertyName(["highway_system", "name"]),
                    filter(property("highway_system").equalTo("state"))
                ]

            ))
        ).toBe(
            expected
        );
    });
});
