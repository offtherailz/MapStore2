/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import expect from 'expect';
import { aggregateXML } from '../aggregate';

describe('WPS aggregate', () => {
    const options = { featureType: 'topp:states', aggregationAttribute: 'PERSONS', aggregateFunction: 'Sum' };
    it('wraps an OGC filter in a WFS 1.0.0 request', () => {
        const xml = aggregateXML({ ...options, filter: '<ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>A</ogc:PropertyName><ogc:Literal>1</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>' });
        expect(xml).toContain('<wfs:GetFeature  outputFormat="GML2" service="WFS" version="1.0.0"><wfs:Query typeName="topp:states"><ogc:Filter>');
    });
    it('wraps a FES 2.0 filter in a WFS 2.0.0 request that declares its namespaces', () => {
        const xml = aggregateXML({ ...options, filter: '<fes:Filter><fes:PropertyIsEqualTo><fes:ValueReference>A</fes:ValueReference><fes:Literal>1</fes:Literal></fes:PropertyIsEqualTo></fes:Filter>' });
        expect(xml).toContain('<wfs:GetFeature  service="WFS" version="2.0.0" xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:fes="http://www.opengis.net/fes/2.0" xmlns:gml="http://www.opengis.net/gml/3.2"><wfs:Query typeNames="topp:states"><fes:Filter>');
        expect(xml).toNotContain('version="1.0.0"><wfs:Query');
    });
});
