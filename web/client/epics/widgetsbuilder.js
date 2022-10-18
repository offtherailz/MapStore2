/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {Observable} from 'rxjs';

import {
    NEW,
    INSERT,
    EDIT,
    OPEN_FILTER_EDITOR,
    NEW_CHART,
    editNewWidget,
    onEditorChange
} from '../actions/widgets';

import { closeFeatureGrid } from '../actions/featuregrid';
import { drawSupportReset } from '../actions/draw';
import { QUERY_FORM_SEARCH, loadFilter } from '../actions/queryform';
import { setControlProperty, TOGGLE_CONTROL } from '../actions/controls';
import { ADD_LAYER } from '../actions/layers';
import { LOCATION_CHANGE } from 'connected-react-router';
import { featureTypeSelected } from '../actions/wfsquery';
import { getWidgetLayer, getEditingWidgetFilter } from '../selectors/widgets';
import { wfsFilter } from '../selectors/query';
import { widgetBuilderAvailable } from '../selectors/controls';
const getFTSelectedArgs = (state) => {
    let layer = getWidgetLayer(state);
    let url = layer.search && layer.search.url;
    let typeName = layer.name;
    return [url, typeName];
};

export const openWidgetEditor = (action$, store = {}) => action$.ofType(NEW, EDIT, NEW_CHART)
    .filter(() => widgetBuilderAvailable(store.value))
    .switchMap(() => Observable.of(
        setControlProperty("widgetBuilder", "enabled", true),
        setControlProperty("metadataexplorer", "enabled", false)
    ));
export const closeWidgetEditorOnFinish = (action$, store = {}) => action$.ofType(INSERT, ADD_LAYER)
    .filter(() => widgetBuilderAvailable(store.value))
    .switchMap(() => Observable.of(setControlProperty("widgetBuilder", "enabled", false)));
export const initEditorOnNew = (action$, store = {}) => action$.ofType(NEW)
    .filter(() => widgetBuilderAvailable(store.value))
    .switchMap((w) => Observable.of(editNewWidget({
        legend: false,
        mapSync: true,
        cartesian: true,
        yAxis: true,
        ...w,
        // override action's type
        type: undefined
    }, {step: 0})));
export const initEditorOnNewChart = (action$, store = {}) => action$.ofType(NEW_CHART)
    .filter(() => widgetBuilderAvailable(store.value))
    .switchMap((w) => Observable.of(closeFeatureGrid(), editNewWidget({
        legend: false,
        mapSync: true,
        cartesian: true,
        yAxis: true,
        widgetType: "chart",
        filter: wfsFilter(store.value),
        ...w,
        // override action's type
        type: undefined
    }, {step: 0}), onEditorChange("returnToFeatureGrid", true)));
/**
 * Manages interaction with QueryPanel and widgetBuilder
 */
export const handleWidgetsFilterPanel = (action$, store = {}) =>
    action$.ofType(OPEN_FILTER_EDITOR)
        .filter(() => widgetBuilderAvailable(store.value))
        .switchMap(() =>
            // open and setup query form
            Observable.of(
                featureTypeSelected(...getFTSelectedArgs(store.value)),
                loadFilter(getEditingWidgetFilter(store.value)),
                setControlProperty("widgetBuilder", "enabled", false),
                setControlProperty('queryPanel', "enabled", true)

            // wait for any filter update(search) or query form close event
            ).concat(
                Observable.race(
                    action$.ofType(QUERY_FORM_SEARCH).take(1),
                    action$.ofType(TOGGLE_CONTROL).filter(({control, property} = {}) => control === "queryPanel" && (!property || property === "enabled")).take(1)
                )
                // then close the query panel, open widget form and update the current filter for the widget in editing
                    .switchMap( action =>
                        (action.filterObj
                            ? Observable.of(onEditorChange("filter", action.filterObj))
                            : Observable.empty()
                        )
                            .merge(Observable.of(
                                setControlProperty("widgetBuilder", "enabled", true)
                            ))
                    )
                // if the widgetBuilder is closed or the page is changed, do not listen anymore
            ).takeUntil(
                action$.ofType(LOCATION_CHANGE, EDIT)
                    .merge(action$.ofType(TOGGLE_CONTROL).filter(({control, property} = {}) => control === "widgetBuilder" && (!property === false))))
                .concat(
                    Observable.of(drawSupportReset(),
                        setControlProperty('queryPanel', "enabled", false)
                    )
                )
        );


export default {
    openWidgetEditor,
    closeWidgetEditorOnFinish,
    initEditorOnNew,
    initEditorOnNewChart,
    handleWidgetsFilterPanel
};
