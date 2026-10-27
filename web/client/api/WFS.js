/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import axios from '../libs/ajax';
import urlUtil from 'url';
import xml2js from 'xml2js';
import ConfigUtils from '../utils/ConfigUtils';
import requestBuilder from '../utils/ogc/WFS/RequestBuilder';
import {toOGCFilterParts} from '../utils/FilterUtils';
import { getDefaultUrl } from '../utils/URLUtils';
import { castArray } from 'lodash';
import { isValidGetFeatureInfoFormat } from '../utils/WMSUtils';
import { getSearchUrl, getWFSLayerName, getWFSVersion } from '../utils/LayersUtils';
import { isWFS2, toWFSRequestVersion } from '../utils/ogc/WFS/base';

const capabilitiesCache = {};

export const toDescribeURL = (url, typeName) => {
    const parsed = urlUtil.parse(getDefaultUrl(url), true);
    return urlUtil.format(
        {
            ...parsed,
            search: undefined, // this allows to merge parameters correctly
            query: {
                ...parsed.query,

                service: "WFS",
                version: "1.1.0",
                typeName,
                outputFormat: 'application/json',
                request: "DescribeFeatureType"
            }
        });
};
/**
 * Simple getFeature using http GET method with json format
 */
export const getFeatureSimple = function(baseUrl, params) {
    return axios.get(baseUrl + '?service=WFS&version=1.1.0&request=GetFeature', {
        params: Object.assign({
            outputFormat: "application/json"
        }, params)
    }).then((response) => {
        if (typeof response.data !== 'object') {
            return JSON.parse(response.data);
        }
        return response.data;
    });
};

export const getCapabilitiesURL = (url, {version = "1.1.0"} = {}) => {
    const parsed = urlUtil.parse(getDefaultUrl(url), true);
    return urlUtil.format(Object.assign({}, parsed, {
        search: undefined, // this allows to merge parameters correctly
        query: Object.assign({
            version,
            ...parsed.query,
            service: "WFS",
            request: "GetCapabilities"
        })
    }));
};

// WFS 2.0 renames these KVP parameters
const WFS2_PARAMS = {
    typename: "typeNames",
    maxfeatures: "count",
    featureid: "resourceId"
};
const toWFS2Params = (params = {}) => Object.keys(params).reduce((acc, key) => ({
    ...acc,
    [WFS2_PARAMS[key.toLowerCase()] ?? key]: params[key]
}), {});

export const getFeatureURL = (url, typeName, { version = "1.1.0", ...params } = {}) => {
    const parsed = urlUtil.parse(getDefaultUrl(url), true);
    const query = Object.assign({
        typeName,
        version: toWFSRequestVersion(version),
        ...parsed.query,
        service: "WFS",
        request: "GetFeature",
        ...params
    });
    return urlUtil.format(Object.assign({}, parsed, {
        search: undefined, // this allows to merge parameters correctly
        query: isWFS2(version) ? toWFS2Params(query) : query
    }));
};
const typeNameNamespaces = {};
/**
 * Resolves the namespace of the workspace prefix of a type name from DescribeFeatureType, cached by URL, type name and credentials; a failure is not cached.
 * Only layers with a configured WFS version resolve it, so the requests of legacy layers do not change.
 * @param {object} layer the layer
 * @param {string} url the WFS service URL
 * @param {string} typeName the prefixed type name
 * @returns {Promise} resolves with the namespaces to declare, e.g. `{topp: "http://www.openplans.org/topp"}`
 */
const getTypeNameNamespaces = (layer, url, typeName = "") => {
    const prefix = typeName.indexOf(":") > 0 ? typeName.split(":")[0] : undefined;
    if (!prefix || !getWFSVersion(layer)) {
        return Promise.resolve(undefined);
    }
    const key = `${url}|${typeName}|${layer.security?.sourceId ?? ""}`;
    if (!typeNameNamespaces[key]) {
        typeNameNamespaces[key] = axios.get(toDescribeURL(url, typeName), {_msAuthSourceId: layer.security?.sourceId})
            .then(({ data }) => data?.targetNamespace ? { [prefix]: data.targetNamespace } : undefined)
            .catch(() => {
                // a failure is not cached, so the next request tries again
                delete typeNameNamespaces[key];
                return undefined;
            });
    }
    return typeNameNamespaces[key];
};

/**
 * Performs a getFeature request (using axios POST) to a WFS service for a given MapStore layer WFS layer object.
 * @param {object} layer MapStore layer object
 * @param {object} requestOptions additional request options. Can include:
 * - `version`: WFS version. Default: the version of the layer, `1.1.0` if missing
 * - `filter`: optional array of mapstore filters. If the layer has a `layerFilter` property or filterObj, it will be added to the filter in a logic AND.
 * - `proj`: projection string
 * - `outputFormat`: output format string. Default: `application/json`
 * - `resultType`: result type string. Default: `results`
 * @param {object} config axios request config (headers, etc...)
 */
export const getFeatureLayer = (layer, {version = getWFSVersion(layer) ?? "1.1.0", filters, proj, outputFormat = 'application/json', resultType = 'results'} = {}, config) => {
    const {params } = layer;
    const url = layer.type === 'wms' ? getSearchUrl(layer) : layer.url;
    const typeName = getWFSLayerName(layer);
    const {layerFilter, filterObj: featureGridFilter} = layer; // TODO: add
    const {getFeature: wfsGetFeature, query, filter, and} = requestBuilder({wfsVersion: version});
    const allFilters = []
        .concat(filters ?? [])
        .concat(layerFilter ? layerFilter : [])
        .concat(featureGridFilter ? featureGridFilter : []);
    const filterParts = allFilters.flatMap(f => toOGCFilterParts(f, version, isWFS2(version) ? "fes" : "ogc"));
    return getTypeNameNamespaces(layer, url, typeName).then((namespaces) => axios.post(url, wfsGetFeature(query(
        typeName,
        // TODO: insert propertyName before filter to limit attributes to return
        filterParts.length > 0
            // And needs at least two operands in the filter schema
            ? filter(filterParts.length === 1 ? filterParts[0] : and(filterParts))
            : "",
        {srsName: proj} // 3rd for query is optional
    ),
    {outputFormat, resultType, namespaces}
    ), {
        ...config,
        params,
        headers: {
            ...config?.headers,
            'Content-Type': 'application/xml'
        }
    }));
};

/**
 * Performs a WFS GetFeature request (using axios GET) with the given parameters.
 * @param {string} url URL of the WFS service
 * @param {string} typeName layer name
 * @param {object} params the params to add to the request
 * @param {object} config axios request config (headers, etc...)
 * @returns {Promise} the axios promise
 */
export const getFeature = (url, typeName, params, config) => {
    return axios.get(getFeatureURL(url, typeName, params), config);
};

export const getCapabilities = function(url, info) {
    const cached = capabilitiesCache[url];
    if (cached && new Date().getTime() < cached.timestamp + (ConfigUtils.getConfigProp('cacheExpire') || 60) * 1000) {
        return Promise.resolve(cached.data);
    }
    const protectedId = info?.options?.service?.protectedId;
    return axios.get(getCapabilitiesURL(url), {_msAuthSourceId: protectedId})
        .then((response) => {
            let json;
            xml2js.parseString(response.data, { explicitArray: false, stripPrefix: true }, (ignore, result) => {
                json = { ...result, url };
            });
            capabilitiesCache[url] = {
                timestamp: new Date().getTime(),
                data: json
            };
            return json;
        });
};

const versionsCache = {};
/**
 * Detects the highest WFS version supported by a service, between 2.0.0 and 1.1.0.
 * The request asks only the service identification, so the response is small.
 * The result is cached by URL and credentials; a failed detection is not cached.
 * @param {string} url the WFS service URL
 * @param {object} [options]
 * @param {string} [options.protectedId] the id of the credentials of the service
 * @returns {Promise} resolves with `2.0.0`, `1.1.0` or undefined when the version cannot be detected
 */
export const detectWFSVersion = (url, { protectedId } = {}) => {
    const key = `${url}|${protectedId ?? ""}`;
    if (!versionsCache[key]) {
        const parsed = urlUtil.parse(getDefaultUrl(url), true);
        const capabilitiesURL = urlUtil.format({
            ...parsed,
            search: undefined, // this allows to merge parameters correctly
            query: {
                ...parsed.query,
                service: "WFS",
                request: "GetCapabilities",
                AcceptVersions: "2.0.0,1.1.0",
                Sections: "ServiceIdentification"
            }
        });
        versionsCache[key] = axios.get(capabilitiesURL, {_msAuthSourceId: protectedId})
            .then(({ data }) => {
                const version = `${data}`.match(/WFS_Capabilities[^>]*\sversion="([^"]+)"/)?.[1];
                return isWFS2(version) ? "2.0.0" : ["1.1.0"].find(supported => supported === version);
            })
            .catch(() => {
                delete versionsCache[key];
                return undefined;
            });
    }
    return versionsCache[key];
};

export const describeFeatureType = function(url, typeName) {
    return axios.get(toDescribeURL(url, typeName)).then(({data}) => data);
};

/**
 * Fetch the supported formats of the WFS service
 * @param {string} url WFS endpoint
 * @returns {Promise} resolves with { infoFormats }
 */
export const getSupportedFormat = (url) => {
    return getCapabilities(url)
        .then((response) => {
            const operations = castArray(response?.['wfs:WFS_Capabilities']?.['ows:OperationsMetadata']?.['ows:Operation'] || []);
            const getFeatureOperation = operations.find(operation => operation?.$?.name === 'GetFeature');
            const parameters = castArray(getFeatureOperation?.['ows:Parameter'] || []);
            const outputFormats = castArray(parameters.find((parameter) => parameter?.$?.name === 'outputFormat')?.['ows:Value'] || []);
            const infoFormats = outputFormats.filter(isValidGetFeatureInfoFormat);
            return {
                infoFormats: infoFormats?.length ? infoFormats : ['application/json']
            };
        });
};
