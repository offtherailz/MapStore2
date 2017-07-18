/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const Rx = require('rxjs');
const {get} = require('lodash');
const axios = require('../libs/ajax');
const {fidFilter} = require('../utils/ogc/Filter/filter');
const {getDefaultFeatureProjection} = require('../utils/FeatureGridUtils');
const {changeDrawingStatus, GEOMETRY_CHANGED} = require('../actions/draw');
const requestBuilder = require('../utils/ogc/WFST/RequestBuilder');
const {toggleControl} = require('../actions/controls');
const {query, QUERY_CREATE, QUERY_RESULT, LAYER_SELECTED_FOR_SEARCH, FEATURE_CLOSE} = require('../actions/wfsquery');
const {parseString} = require('xml2js');
const {stripPrefix} = require('xml2js/lib/processors');

const {SORT_BY, CHANGE_PAGE, SAVE_CHANGES, SAVE_SUCCESS, DELETE_SELECTED_FEATURES, featureSaving,
    saveSuccess, saveError, clearChanges, setLayer, clearSelection, toggleViewMode, toggleTool,
    CLEAR_CHANGES, START_EDITING_FEATURE, TOGGLE_MODE, MODES, geometryChanged} = require('../actions/featuregrid');
const {error} = require('../actions/notifications');
const {selectedFeaturesSelector, changesMapSelector, newFeaturesSelector, selectedFeatureSelector} = require('../selectors/featuregrid');
const {describeSelector} = require('../selectors/query');
const drawSupportReset = () => changeDrawingStatus("clean", "", "featureeditor", [], {});
/**
 * Intercept OGC Exception (200 response with exceptionReport) to throw error in the stream
 * @param  {observable} observable The observable that emits the server response
 * @return {observable}            The observable that returns the response or throws the error.
 */
const interceptOGCError = (observable) => observable.switchMap(response => {
    if (typeof response.data === "string") {
        if (response.data.indexOf("ExceptionReport") > 0) {
            return Rx.Observable.bindNodeCallback( (data, callback) => parseString(data, {
                 tagNameProcessors: [stripPrefix],
                 explicitArray: false,
                 mergeAttrs: true
            }, callback))(response.data).map(data => {
                throw get(data, "ExceptionReport.Exception.ExceptionText") || "Undefined OGC Service Error";
            });

        }
    }
    return Rx.Observable.of(response);
});

// pagination selector
const getPagination = (state, {page, size} = {}) => {
    let currentPagination = get(state, "featuregrid.pagination");
    let maxFeatures = size !== undefined ? size : currentPagination.maxFeatures;
    return {
        ...currentPagination,
        startIndex: page !== undefined ? page * maxFeatures : currentPagination.startIndex,
        maxFeatures
    };
};
const addPagination = (filterObj, pagination) => ({
    ...filterObj,
    pagination
});

const createChangesTransaction = (changes, newFeatures, {insert, update, propertyChange, transaction})=>
    transaction(
        newFeatures.map(f => insert(f)),
        Object.keys(changes).map( id =>
            Object.keys(changes[id]).map(name =>
                update([propertyChange(name, changes[id][name]), fidFilter("ogc", id)])
            )
        )
    );
const createDeleteTransaction = (features, {transaction, deleteFeature}) => transaction(
    features.map(deleteFeature)
);
const save = (url, body) => Rx.Observable.defer(() => axios.post(url, body, {headers: { 'Content-Type': 'application/xml'}}))
    .let(interceptOGCError);

const createSaveChangesFlow = (changes = {}, newFeatures = [], describeFeatureType, url) => save(
    url,
    createChangesTransaction(changes, newFeatures, requestBuilder(describeFeatureType))
);

const createDeleteFlow = (features, describeFeatureType, url) => save(
    url,
    createDeleteTransaction(features, requestBuilder(describeFeatureType))
);
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
        ),
    featureGridReloadPageOnSaveSuccess: (action$, store) =>
        action$.ofType(SAVE_SUCCESS).switchMap( ({page, size} = {}) =>
            Rx.Observable.of( query(
                    get(store.getState(), "query.searchUrl"),
                    addPagination({
                            ...get(store.getState(), "query.filterObj")
                        },
                        getPagination(store.getState(), {page, size})
                    )
            )).merge(
                action$.ofType(QUERY_RESULT).map(() => clearChanges())
            )
        ),
    savePendingFeatureGridChanges: (action$, store) =>
        action$.ofType(SAVE_CHANGES).switchMap( () =>
            Rx.Observable.of(featureSaving())
                .concat(
                    createSaveChangesFlow(
                        changesMapSelector(store.getState()),
                        newFeaturesSelector(store.getState()),
                        describeSelector(store.getState()),
                        get(store.getState(), "query.searchUrl")
                    ).map(() => saveSuccess())
                    .catch((e) => Rx.Observable.of(saveError(), error({
                        title: "featuregrid.errorSaving",
                        message: e,
                        uid: "saveError"
                      })))
                )


        ),
    deleteSelectedFeatureGridFeatures: (action$, store) =>
        action$.ofType(DELETE_SELECTED_FEATURES).switchMap( () =>
            Rx.Observable.of(featureSaving())
                .concat(
                    createDeleteFlow(
                        selectedFeaturesSelector(store.getState()),
                        describeSelector(store.getState()),
                        get(store.getState(), "query.searchUrl")
                    ).map(() => saveSuccess())
                    // close window
                    .catch((e) => Rx.Observable.of(saveError(), error({
                        title: "featuregrid.errorSaving",
                        message: e,
                        uid: "saveError"
                      }))).concat(Rx.Observable.of(
                          toggleTool("deleteConfirm"),
                          clearSelection()
                      ))
                )
        ),
    handlEditFeature: (action$, store) => action$.ofType(START_EDITING_FEATURE)
        .switchMap( () => {
            const state = store.getState();
            const defaultFeatureProj = getDefaultFeatureProjection();
            const feature = selectedFeatureSelector(state);
            const drawOptions = {
                featureProjection: defaultFeatureProj,
                stopAfterDrawing: false,
                editEnabled: true,
                drawEnabled: false
            };
            return Rx.Observable.concat(
                Rx.Observable.of(changeDrawingStatus("drawOrEdit", feature.geometry.type, "featureGrid", [feature], drawOptions)),
                action$.ofType(TOGGLE_MODE, CLEAR_CHANGES, SAVE_SUCCESS)
                    .filter(a => a.type === TOGGLE_MODE ? a.mode === MODES.VIEW : true )
                    .switchMap( () => {
                        return Rx.Observable.of(drawSupportReset());
                    })
            );
        }),
        saveChangedGeometries: (action$) => action$.ofType(GEOMETRY_CHANGED)
        .filter(a => a.owner === "featureGrid")
        .switchMap( (a) => {
            return Rx.Observable.of(geometryChanged(a.features));
        })
        /*,
        doSomethingWhenDrawStops: (action$) => action$.ofType(DRAW_SUPPORT_STOPPED)
        .switchMap( () => {
            return Rx.Observable.of(anyAction()));
        })*/
};
