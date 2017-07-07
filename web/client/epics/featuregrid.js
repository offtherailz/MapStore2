/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const Rx = require('rxjs');

const {get} = require('lodash');
const {toggleControl} = require('../actions/controls');
const {query, QUERY_CREATE, LAYER_SELECTED_FOR_SEARCH, FEATURE_CLOSE} = require('../actions/wfsquery');
const {SORT_BY, CHANGE_PAGE, setLayer, clearSelection, toggleViewMode} = require('../actions/featuregrid');

/*
// FILTER CREATION FUNCTIONS
const getLogicOperation = (builder, group) => {
    switch (group.logic) {
        case "AND":
            return builder.and;
        case "OR":
            return builder.or;
        default:
        return () => {};

    }
};
const axios = require('../libs/ajax');
const getOperations = (filterFields, group) => filterFields.filter(group.groupId);
const requestBuilder = require("../utils/ogc/WFS/RequestBuilder");
const getGroups = (gid, groups) => groups.filter( g => g.groupId === gid );
const groupToFilter = (b, fo, group) => {
    const logicOperation = getLogicOperation(b, group);
    const operations = getOperations(fo.filterFields || [], group);
    const groups = getGroups(group.id, groups);
    const groupFilters = groups.map(g => groupToFilter(b, fo, g));
    return logicOperation(operations.concat(groupFilters));
};
const objToFilter = (fo, builder) =>
    builder.filter(groupToFilter(builder, fo, fo.groupFields.filter( g => !g.groupId)));
    */
    /*
    initialWFSQuerySearch: (action$, store) => action$.ofType("QUERY_CREATE").switchMap( ({filterObj, searchUrl}) => {

        const paginationInfo = get(store.getState(), "featuregrid.pagination") || {
            startIndex: 0,
            maxFeatures: 50
        };
        const builder = requestBuilder();
        const {getFeature, query} = builder;
        const filter = objToFilter(filterObj, builder);
        Rx.defer( () => axios.post(searchUrl, getFeature(filterObj.featureTypeName, query(filter)), {
            outputFormat: "application/json",
            startIndex: store,
            ...paginationInfo
        })).map( response => querySearchResponse(response.data));
    })
     */
// pagination selector
const getPagination = (state, {page, size} = {}) => {
    let currentPagination = get(state, "featuregrid.pagination");
    let maxFeatures = size !== undefined ? size : currentPagination.maxFeatures;
    return {
        currentPagination,
        startIndex: page !== undefined ? page * maxFeatures : currentPagination.startIndex,
        maxFeatures
    };
};
const addPagination = (filterObj, pagination) => ({
    ...filterObj,
    pagination
});

module.exports = {
    featureLayerSelectionInitialization: (action$) =>
        action$.ofType(LAYER_SELECTED_FOR_SEARCH)
            .switchMap( a => Rx.Observable.of(setLayer(a.id))),
    featureGridSelectionClearOnClose: (action$) => action$.ofType(FEATURE_CLOSE).switchMap(() => Rx.Observable.of(clearSelection(), toggleViewMode())),
    featureGridStartupQuery: (action$, store) =>
        action$.ofType(QUERY_CREATE)
            .switchMap(action => Rx.Observable.of(
                toggleControl("featuregrid", "open", true),
                query(action.searchUrl,
                    addPagination(action.filterObj, getPagination(store.getState())
                ))
            )),
    featureGridSort: (action$, store) =>
        action$.ofType(SORT_BY).switchMap( ({sortBy, sortOrder}) =>
            Rx.Observable.of( query(
                    get(store.getState(), "query.searchUrl"),
                    addPagination({
                            ...get(store.getState(), "query.filterObj"),
                            sortOptions: {sortBy, sortOrder}
                        },
                        getPagination(store.getState())
                    )
            ))
        ),
    featureGridChangePage: (action$, store) =>
        action$.ofType(CHANGE_PAGE).switchMap( ({page, size} = {}) =>
            Rx.Observable.of( query(
                    get(store.getState(), "query.searchUrl"),
                    addPagination({
                            ...get(store.getState(), "query.filterObj")
                        },
                        getPagination(store.getState(), {page, size})
                    )
            ))
        )

};
