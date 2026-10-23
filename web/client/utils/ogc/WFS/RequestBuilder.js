/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import filterBuilder from '../Filter/FilterBuilder';
import castArray from 'lodash/castArray';
import {isWFS2, toWFSRequestVersion, wfsToGmlVersion} from "./base";
const getStaticAttributesWFS1 = (ver) => 'service="WFS" version="' + ver + '" ' +
    (ver === "1.0.0" ? 'outputFormat="GML2" ' : "") +
    'xmlns:gml="http://www.opengis.net/gml" ' +
    'xmlns:wfs="http://www.opengis.net/wfs" ' +
    'xmlns:ogc="http://www.opengis.net/ogc" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
    'xsi:schemaLocation="http://www.opengis.net/wfs ' +
    (ver === "1.0.0" ? `http://schemas.opengis.net/wfs/${ver}/WFS-basic.xsd"` : `http://schemas.opengis.net/wfs/${ver}/wfs.xsd"`);
const getStaticAttributesWFS2 = (ver) => 'service="WFS" version="' + toWFSRequestVersion(ver) + '" ' +
    'xmlns:wfs="http://www.opengis.net/wfs/2.0" ' +
    'xmlns:fes="http://www.opengis.net/fes/2.0" ' +
    'xmlns:gml="http://www.opengis.net/gml/3.2" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
    'xsi:schemaLocation="http://www.opengis.net/wfs/2.0 ' +
        'http://schemas.opengis.net/wfs/2.0/wfs.xsd ' +
        'http://www.opengis.net/gml/3.2 ' +
        'http://schemas.opengis.net/gml/3.2.1/gml.xsd"';

const SORT_ORDERS = { A: "ASC", D: "DESC" };
const toSortOrder = (order) => SORT_ORDERS[order] ?? order;

// the schema of a query requires the projection (PropertyName) first, then the Filter, then SortBy
const QUERY_CONTENT_ORDER = [/^<\w+:PropertyName[ >]/, /^<\w+:Filter[ >]/, /^<\w+:SortBy[ >]/];
const queryContentRank = (element = "") => {
    const rank = QUERY_CONTENT_ORDER.findIndex(regex => regex.test(element));
    return rank < 0 ? 1 : rank;
};
const sortQueryContent = (content) => content
    .map((element, index) => ({ element, index, rank: queryContentRank(element) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ element }) => element);

const namespacesAttributes = (namespaces = {}) => Object.keys(namespaces)
    .map(prefix => ` xmlns:${prefix}="${namespaces[prefix]}"`)
    .join("");

/**
 * Returns WFS Request Builder to allow the creation of WFS requests.
 * It gets all the functionalities of `FilterBuilder`, plus adds `getFeature`, `query` ...
 * @see utils.ogc.Filter.FilterBuilder
 * @name RequestBuilder
 * @augments utils.ogc.Filter.FilterBuilder
 * @memberof utils.ogc.WFS
 * @constuctor
 * @param {Object} [options] the options to create the request builder
 * @param  {String} [options.wfsVersion="1.1.0"] the version of WFS. `2.0` and `2.0.0` produce the same WFS 2.0.0 request
 * @param  {String} [options.gmlVersion]         gml Version ()
 * @param  {String} [options.filterNS]           NameSpace to use for filters
*  @param  {String} [options.wfsNS="wfs"]        namespace to use for WFS tags
 * @return {Object} A request builder. it contains all the `FilterBuilder` methods, plus the getFeature, query... methods
 * The request builder provides all the methods to compose the request (query, filter...).
 * @example
 * import requestBuilder from '.../RequestBuilder';
 * const {getFeature, query, filter, property} = requestBuilder({wfsVersion: "1.0.0"});
 * const reqBody = getFeature(query(
 *      "workspace:layer",
 *      filter(
 *          and(
 *              property("P1").equals("v1"),
 *              property("the_geom").intersects(geoJSONGeometry)
 *          )
 *      ),
 *      {srsName="EPSG:4326"} // 3rd for query is optional
 *      )
 * {maxFeatures: 10, startIndex: 0, resultType: 'hits', outputFormat: 'application/json', namespaces: {workspace: "http://workspace"}} // 3rd  argument of getFeature is optional, and contains the options for the request.
 * );
 * @prop {function} getFeature generates the getFeatureRequest, with the contained query
 * ```
 * getFeature(query("topp:states', filter(...)))
 * ```
 * @prop {function} query returns the query element
 * ```
 * query("layerName", filter..., {options})
 * ```
 */
export default function({wfsVersion = "1.1.0", gmlVersion, filterNS, wfsNS = "wfs"} = {}) {
    const wfs2 = isWFS2(wfsVersion);
    let gmlV = gmlVersion;
    if (!gmlV && wfsVersion) {
        gmlV = wfsToGmlVersion(wfsVersion);
    } else if (!gmlV) {
        gmlV = "3.1.1";
    }
    const requestAttributes = ({
        viewParams,
        resultType,
        outputFormat,
        startIndex,
        maxFeatures,
        namespaces
    } = {}) => {
        const getMaxFeatures = (mf) => wfs2 ? `count="${mf}"` : `maxFeatures="${mf}"`;
        return (wfs2 ? getStaticAttributesWFS2(wfsVersion) : getStaticAttributesWFS1(wfsVersion))
            + namespacesAttributes(namespaces)
            + (resultType ? ` resultType="${resultType}"` : "")
            + (outputFormat ? ` outputFormat="${outputFormat}"` : ``)
            + ((startIndex || startIndex === 0) ? ` startIndex="${startIndex}"` : "")
            + ((maxFeatures || maxFeatures === 0) ? ` ${getMaxFeatures(maxFeatures)}` : "")
            + (viewParams ? ` viewParams="${viewParams}"` : "");
    };
    const filterNamespace = filterNS || (wfs2 ? "fes" : "ogc");
    const fb = filterBuilder({gmlVersion: gmlV, wfsVersion, filterNS: filterNamespace});
    /*
        The projection clause of a query is wfs:PropertyName in WFS 1.1.0 and 2.0.0, ogc:PropertyName only in WFS 1.0.0.
        https://schemas.opengis.net/wfs/2.0/wfs.xsd
        SortBy and Filters use ValueReference in FES 2.0
        https://schemas.opengis.net/filter/2.0/sort.xsd
    */
    const propertyNameNS = wfsVersion === "1.0.0" ? "ogc" : wfsNS;
    const propertyName = (property) =>
        castArray(property)
            .map(p => `<${propertyNameNS}:PropertyName>${p}</${propertyNameNS}:PropertyName>`)
            .join("");
    return {
        ...fb,
        getFeature: (content, opts) => `<${wfsNS}:GetFeature ${requestAttributes(opts)}>${Array.isArray(content) ? content.join("") : content}</${wfsNS}:GetFeature>`,
        propertyName,
        sortBy: (property, order = "ASC") =>
            `<${filterNamespace}:SortBy><${filterNamespace}:SortProperty>${fb.valueReference(property)}<${filterNamespace}:SortOrder>${toSortOrder(order)}</${filterNamespace}:SortOrder></${filterNamespace}:SortProperty></${filterNamespace}:SortBy>`,
        query: (featureName, content, {srsName = "EPSG:4326"} = {}) =>
            `<${wfsNS}:Query ${wfs2 ? "typeNames" : "typeName"}="${featureName}" ${srsName !== 'native' ? `srsName="${srsName}"` : ''}>`
            + `${Array.isArray(content) ? sortQueryContent(content).join("") : content}`
            + `</${wfsNS}:Query>`
    };

}
