/**
  * Copyright 2017, GeoSolutions Sas.
  * All rights reserved.
  *
  * This source code is licensed under the BSD-style license found in the
  * LICENSE file in the root directory of this source tree.
  */

import urlUtil from 'url';

import { isArray, castArray, isNil, isObject } from 'lodash';
import Rx from 'rxjs';
import { parseString } from 'xml2js';
import { stripPrefix } from 'xml2js/lib/processors';

import axios from '../libs/ajax';
import { createFeatureFilter, getWFSFilterData } from '../utils/FilterUtils';
import { getCapabilitiesUrl, getWFSLayerName, getWFSVersion } from '../utils/LayersUtils';
import { interceptOGCError } from '../utils/ObservableUtils';
import requestBuilder from '../utils/ogc/WFS/RequestBuilder';
import { isWFS2 } from '../utils/ogc/WFS/base';
import { getDefaultUrl } from '../utils/URLUtils';

const DEFAULT_WFS_VERSION = "1.1.0";
const requestBuilders = {
    [DEFAULT_WFS_VERSION]: requestBuilder({ wfsVersion: DEFAULT_WFS_VERSION }),
    "2.0.0": requestBuilder({ wfsVersion: "2.0.0" })
};
const getRequestBuilder = (version) => isWFS2(version) ? requestBuilders["2.0.0"] : requestBuilders[DEFAULT_WFS_VERSION];

/**
 * Returns the WFS version to use in the requests of a layer
 * @param {object} layer the layer
 * @returns {string} `2.0.0` or `1.1.0`, the legacy default
 */
export const getLayerRequestVersion = (layer) => isWFS2(getWFSVersion(layer)) ? "2.0.0" : DEFAULT_WFS_VERSION;

export const toDescribeURL = (layer = {}) => {
    const { search = {}, url, describeFeatureTypeURL } = layer;
    const typeName = getWFSLayerName(layer);
    const version = getLayerRequestVersion(layer);
    const parsed = urlUtil.parse(getDefaultUrl(describeFeatureTypeURL || search.url || url), true);
    return urlUtil.format(
        {
            ...parsed,
            search: undefined, // this allows to merge parameters correctly
            query: {
                ...parsed.query,

                service: "WFS",
                version,
                [isWFS2(version) ? "typeNames" : "typeName"]: typeName,
                outputFormat: 'application/json',
                request: "DescribeFeatureType"
            }
        });
};
export const toLayerCapabilitiesURL = (layer = {}) => {
    const { search = {}, url } = layer;
    const URL = getCapabilitiesUrl({name: getWFSLayerName(layer), url: search && search.url || url });
    const parsed = urlUtil.parse(URL, true);
    return urlUtil.format(
        {
            ...parsed,
            search: undefined, // this allows to merge parameters correctly
            query: {
                ...parsed.query,
                service: "WFS",
                version: getLayerRequestVersion(layer),
                request: "GetCapabilities"
            }
        });
};

// this is a workaround for https://osgeo-org.atlassian.net/browse/GEOS-7233. can be removed when fixed
export const workaroundGEOS7233 = ({ totalFeatures, features, ...rest } = {}, { startIndex } = {}, originalSize) => {
    if (originalSize > totalFeatures && originalSize === startIndex + features.length && totalFeatures === features.length) {
        return {
            ...rest,
            features,
            totalFeatures: originalSize
        };
    }
    return {
        ...rest,
        features,
        totalFeatures
    };

};


export const getPagination = (filterObj = {}, options = {}) =>
    filterObj.pagination
    || !isNil(options.startIndex)
        && !isNil(options.maxFeatures)
        && {
            startIndex: options.startIndex,
            maxFeatures: options.maxFeatures
        };

const createFeatureCollection = (features) => (
    {
        crs: {type: "name", properties: {name: "urn:ogc:def:crs:EPSG::4326"}},
        numberMatched: features.length,
        numberReturned: features.length,
        timeStamp: "2020-07-20T11:36:20.118Z",
        totalFeatures: features.length,
        type: 'FeatureCollection',
        features: features
    }
);

const getFeaturesFiltered = (features, filterObj) => {
    if (filterObj.filterFields && filterObj.filterFields.length !== 0) {
        const featuresFiltered = features.features.filter(createFeatureFilter(filterObj));

        features.features = featuresFiltered;
        features.numberMatched = featuresFiltered.length;
        features.numberReturned = featuresFiltered.length;
        features.totalFeatures = featuresFiltered.length;
    }
    if (filterObj.sortOptions && filterObj.sortOptions.sortBy && filterObj.sortOptions.sortOrder &&
        filterObj.sortOptions.sortOrder !== "NONE") {
        features.features.sort((a, b) => {
            const avalue = a.properties[filterObj.sortOptions.sortBy];
            const bvalue = b.properties[filterObj.sortOptions.sortBy];
            const diff = avalue.toLowerCase().localeCompare(bvalue.toLowerCase());
            if (filterObj.sortOptions.sortOrder === "ASC") {
                return diff;
            }

            return -1 * diff;
        });
    }
    return features;

};

/**
 * Get data and query string for WFS query for either JSON or XML formats
 * @param {string} searchUrl URL of WFS service
 * @param {object} filterObj FilterObject
 * @param {*} downloadOption selected format for query
 * @returns {Object} The data and query string
 */
export const getFeatureUtilities = (searchUrl, filterObj, options = {}, downloadOption = 'json') => {
    const data = getWFSFilterData(filterObj, options);

    const urlParsedObj = urlUtil.parse(getDefaultUrl(searchUrl), true);
    let params = isObject(urlParsedObj.query) ? urlParsedObj.query : {};
    params.service = 'WFS';
    params.outputFormat = downloadOption;
    const queryString = urlUtil.format({
        protocol: urlParsedObj.protocol,
        host: urlParsedObj.host,
        pathname: urlParsedObj.pathname,
        query: params
    });

    if (options.layer && options.layer.type === 'vector') {
        return Rx.Observable.defer(() => new Promise((resolve) => {
            let features = createFeatureCollection(options.layer.features);
            let featuresFiltered = getFeaturesFiltered(features, filterObj);
            resolve(featuresFiltered);
        }));
    }

    return {
        data,
        queryString
    };
};

/**
 * Get Features in xml format.
 * @param {string} searchUrl URL of WFS service
 * @param {object} filterObj FilterObject
 * @param {*} downloadOption selected format for download
 * @returns {Observable} a stream that emits the XML
 */
export const getXMLFeature = (searchUrl, filterObj, options = {}, downloadOption) => {

    if (options.layer && options.layer.type === 'vector') {
        return getFeatureUtilities(searchUrl, filterObj, options, downloadOption);
    }

    const { data, queryString } = getFeatureUtilities(searchUrl, filterObj, options, downloadOption);

    return Rx.Observable.defer(() =>
        axios.post(queryString, data, {
            timeout: 60000,
            responseType: 'arraybuffer',
            headers: {
                'Accept': `application/xml`,
                'Content-Type': `application/xml`
            },
            _msAuthSourceId: options.layer?.security?.sourceId || options.security?.sourceId
        }));
};

/**
 * Get Features in json format. Intercepts request with 200 errors and workarounds GEOS-7233 if `totalFeatures` is passed
 * @param {string} searchUrl URL of WFS service
 * @param {object} filterObj FilterObject
 * @param {number} totalFeatures optional number to use in case of a previews request, needed to workaround GEOS-7233.
 * @return {Observable} a stream that emits the GeoJSON or an error.
 */
export const getJSONFeature = (searchUrl, filterObj, options = {}) => {

    if (options.layer && options.layer.type === 'vector') {
        return getFeatureUtilities(searchUrl, filterObj, options);
    }

    const { data, queryString } = getFeatureUtilities(searchUrl, filterObj, options);

    return Rx.Observable.defer(() =>
        axios.post(queryString, data, {
            timeout: 60000,
            headers: { 'Accept': 'application/json', 'Content-Type': `application/xml` },
            ...options?.requestOptions
        }))
        .let(interceptOGCError)
        .map((response) => workaroundGEOS7233(response.data, getPagination(filterObj, options), options.totalFeatures));
};

/**
 * Same of `getJSONFeature` but auto-retries possible errors due to no-primary-key issues
 * (when you are using pagination vendor parameters for GeoServer and the primary-key of the table was not set).
 * When this kind of error occurs, auto-retry using the sortOptions passed.
 * present. .
 * @param {string} searchUrl URL of WFS service
 * @param {object} filterObj Filter object
 * @param {object} options params that can contain `totalFeatures` and sort options
 * @return {Observable} a stream that emits the GeoJSON or an error.
 */
export const getJSONFeatureWA = (searchUrl, filterObj, { sortOptions = {}, ...options } = {}) =>
    getJSONFeature(searchUrl, filterObj, options)
        .catch(error => {
            if (error.name === "OGCError" && error.code === 'NoApplicableCode') {
                return getJSONFeature(searchUrl, {
                    ...filterObj,
                    sortOptions
                }, options);
            }
            throw error;
        });

export const describeFeatureType = ({layer}) => {
    const url = toDescribeURL(layer);
    return Rx.Observable.defer(() =>
        axios.get(url, {_msAuthSourceId: layer?.security?.sourceId})).let(interceptOGCError);
};

const typeNameNamespaces = {};
/**
 * Resolves the namespace of the workspace prefix of the layer type name (e.g. `topp` of `topp:states`).
 * Strict servers reject a request that uses a prefix not declared in the XML.
 * Only layers with a configured WFS version resolve it, so the requests of legacy layers do not change.
 * The namespace comes from DescribeFeatureType and it is cached by service URL and type name.
 * @param {object} layer the layer
 * @returns {Observable} a stream that emits the namespaces to declare, e.g. `{topp: "http://www.openplans.org/topp"}`
 */
export const getTypeNameNamespaces = (layer = {}) => {
    const typeName = getWFSLayerName(layer) ?? "";
    const prefix = typeName.indexOf(":") > 0 ? typeName.split(":")[0] : undefined;
    if (!prefix || !getWFSVersion(layer)) {
        return Rx.Observable.of(undefined);
    }
    const key = `${layer.search?.url ?? layer.url}|${typeName}`;
    if (!typeNameNamespaces[key]) {
        typeNameNamespaces[key] = describeFeatureType({ layer })
            .map(({ data } = {}) => data?.targetNamespace ? { [prefix]: data.targetNamespace } : undefined)
            .catch(() => Rx.Observable.of(undefined))
            .toPromise();
    }
    return Rx.Observable.defer(() => typeNameNamespaces[key]);
};

/**
 * Same of `getJSONFeatureWA` but accepts the layer as first parameter.
 * Accepts filter as a string or object. In case of string filter manages pagination and
 * sort options from 3rd parameter. This is a little different from normal getJSONFeature,
 * anyway this version is more rational, separating pagination, sorting etc... from filter.
 * TODO: make this more flexible to manage also object filter with a clear default rule.
 * @param {object} layer the layer to search
 * @param {object|string} filter the filter object or string of the filter. To maintain
 * retro compatibility the filter object can contain pagination info, typeName and so on.
 * @param {object} options the options (pagination, totalFeatures and so on ...)
 */
export const getLayerJSONFeature = (layer = {}, filter, {sortOptions, propertyName: pn, ...options} = {}) => {
    const { search = {}, url, security } = layer;
    const typeName = getWFSLayerName(layer);
    const wfsVersion = getWFSVersion(layer);
    const {getFeature, query, sortBy, propertyName} = getRequestBuilder(wfsVersion);
    const toRequest = (namespaces, sortContent) => filter && typeof filter === 'object' ? {
        ...filter,
        ...(wfsVersion && { ogcVersion: getLayerRequestVersion(layer) }),
        typeName: typeName || filter.typeName
    } : getFeature(
        query(typeName,
            [
                ...sortContent,
                ...(pn ? [propertyName(pn)] : []),
                ...(filter ? castArray(filter) : [])
            ]),
        {...options, namespaces}); // options contains startIndex, maxFeatures and it can be passed as it is
    // TODO: Apply sort workaround for no primary keys
    return getTypeNameNamespaces(layer)
        .switchMap(namespaces => getJSONFeature(search.url || url,
            toRequest(namespaces, sortOptions?.sortBy ? [sortBy(sortOptions.sortBy, sortOptions.sortOrder)] : []),
            {security, ...options, namespaces})
            // retry using 1st propertyNames property, if present, to workaround primary-key issues
            .catch(error => {
                if (error.name === "OGCError" && error.code === 'NoApplicableCode' && !sortOptions && pn && pn[0]) {
                    return getJSONFeature(search.url || url,
                        toRequest(namespaces, [sortBy(isArray(pn) ? pn[0] : pn)]),
                        {...options, namespaces});
                }
                throw error;
            }));
};

export const getLayerWFSCapabilities = ({layer}) => {
    const url = toLayerCapabilitiesURL(layer);
    return Rx.Observable.defer( () => axios.get(url, {_msAuthSourceId: layer?.security?.sourceId}))
        .let(interceptOGCError)
        .switchMap( response => Rx.Observable.bindNodeCallback( (data, callback) => parseString(data, {
            tagNameProcessors: [stripPrefix],
            explicitArray: false,
            mergeAttrs: true
        }, callback))(response.data)
        );
};

export default {
    getJSONFeature,
    getLayerJSONFeature,
    getJSONFeatureWA,
    describeFeatureType,
    getLayerWFSCapabilities
};
