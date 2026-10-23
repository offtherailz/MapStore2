/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { castArray } from 'lodash';
import {
    processParameter,
    processData,
    literalData,
    processReference,
    responseForm,
    rawDataOutput
} from './common';
import { executeProcessXML, executeProcess } from './execute';

export const aggregateXML = ({featureType, aggregationAttribute, classificationAttribute = [], groupByAttributes = [], aggregateFunction, viewParams, filter = ""}) => {
    // a FES 2.0 filter, from a layer on WFS 2.0.0, needs a WFS 2.0.0 request that declares its namespaces
    const getFeature = filter.indexOf('<fes:') >= 0
        ? `<wfs:GetFeature ${viewParams ? `viewParams="${viewParams}"` : ""} service="WFS" version="2.0.0" xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:fes="http://www.opengis.net/fes/2.0" xmlns:gml="http://www.opengis.net/gml/3.2">` +
            `<wfs:Query typeNames="${featureType}">${filter}</wfs:Query></wfs:GetFeature>`
        : `<wfs:GetFeature ${viewParams ? `viewParams="${viewParams}"` : ""} outputFormat="GML2" service="WFS" version="1.0.0">` +
            `<wfs:Query typeName="${featureType}">${filter}</wfs:Query></wfs:GetFeature>`;

    return executeProcessXML(
        'gs:Aggregate',
        [
            processParameter('features', processReference('text/xml', 'http://geoserver/wfs', 'POST', getFeature)),
            processParameter('aggregationAttribute', processData(literalData(aggregationAttribute))),
            ...castArray(aggregateFunction).map(fun => processParameter('function', processData(literalData(fun)))),
            processParameter('singlePass', processData(literalData('false'))),
            ...castArray(groupByAttributes).map(attribute => processParameter('groupByAttributes', processData(literalData(attribute)))),
            ...castArray(classificationAttribute).map(attribute => processParameter('groupByAttributes', processData(literalData(attribute))))
        ],
        responseForm(rawDataOutput('result', 'application/json'))
    );
};

const aggregate = (url, options, requestOptions = {}, layer) => executeProcess(url, aggregateXML(options), {}, requestOptions, layer);

export default aggregate;
