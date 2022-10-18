/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {Observable} from 'rxjs';

import { NEW, INSERT, EDIT, OPEN_FILTER_EDITOR, editNewWidget, onEditorChange} from '../actions/widgets';

import {
    setEditing,
    dashboardSaved,
    dashboardLoaded,
    dashboardLoading,
    triggerSave,
    triggerSaveAs,
    loadDashboard,
    dashboardSaveError,
    SAVE_DASHBOARD,
    DASHBOARD_EXPORT,
    LOAD_DASHBOARD,
    DASHBOARD_IMPORT,
    dashboardLoadError
} from '../actions/dashboard';

import { setControlProperty, TOGGLE_CONTROL, toggleControl } from '../actions/controls';
import { featureTypeSelected } from '../actions/wfsquery';
import { show, error } from '../actions/notifications';
import { loadFilter, QUERY_FORM_SEARCH } from '../actions/queryform';
import { CHECK_LOGGED_USER, LOGIN_SUCCESS, LOGOUT } from '../actions/security';
import { isDashboardEditing, isDashboardAvailable } from '../selectors/dashboard';
import { isLoggedIn } from '../selectors/security';
import { getEditingWidgetLayer, getEditingWidgetFilter } from '../selectors/widgets';
import { pathnameSelector } from '../selectors/router';
import { download, readJson } from '../utils/FileUtils';
import { createResource, updateResource, getResource } from '../api/persistence';
import { wrapStartStop } from '../observables/epics';
import { LOCATION_CHANGE, push } from 'connected-react-router';
import { convertDependenciesMappingForCompatibility } from "../utils/WidgetsUtils";
const getFTSelectedArgs = (state) => {
    let layer = getEditingWidgetLayer(state);
    let url = layer.search && layer.search.url;
    let typeName = layer.name;
    return [url, typeName];
};

// Basic interactions with dashboard editor
export const openDashboardWidgetEditor = (action$, store = {}) => action$.ofType(NEW, EDIT)
    .filter( () => isDashboardAvailable(store.value))
    .switchMap(() => Observable.of(
        setEditing(true)
    ));
// Basic interactions with dashboard editor
export const closeDashboardWidgetEditorOnFinish = (action$, store = {}) => action$.ofType(INSERT)
    .filter( () => isDashboardAvailable(store.value))
    .switchMap(() => Observable.of(setEditing(false)));

// Basic interactions with dashboard editor
export const initDashboardEditorOnNew = (action$, store = {}) => action$.ofType(NEW)
    .filter( () => isDashboardAvailable(store.value))
    .switchMap((w) => Observable.of(editNewWidget({
        legend: false,
        mapSync: false,
        cartesian: true,
        yAxis: true,
        ...w,
        // override action's type
        type: undefined
    }, {step: 0})));
// Basic interactions with dashboard editor
export const closeDashboardEditorOnExit = (action$, store = {}) => action$.ofType(LOCATION_CHANGE)
    .filter( () => isDashboardAvailable(store.value))
    .filter( () => isDashboardEditing(store.value) )
    .switchMap(() => Observable.of(setEditing(false)));
/**
     * Manages interaction with QueryPanel and Dashboard
     */
export const handleDashboardWidgetsFilterPanel = (action$, store = {}) => action$.ofType(OPEN_FILTER_EDITOR)
    .filter(() => isDashboardAvailable(store.value))
    .switchMap(() =>
    // open and setup query form
        Observable.of(
            featureTypeSelected(...getFTSelectedArgs(store.value)),
            loadFilter(getEditingWidgetFilter(store.value)),
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
                Observable.of(// drawSupportReset(),
                    setControlProperty('queryPanel', "enabled", false)
                )
            )
    );
export const filterAnonymousUsersForDashboard = (actions$, store) => actions$
    .ofType(CHECK_LOGGED_USER, LOGOUT)
    .filter(() => pathnameSelector(store.value) === "/dashboard")
    .switchMap( ({}) => {
        return !isLoggedIn(store.value) ? Observable.of(dashboardLoadError({status: 403})) : Observable.empty();
    });

// dashboard loading from resource ID.
export const loadDashboardStream = (action$, store) => action$
    .ofType(LOAD_DASHBOARD)
    .switchMap( ({id}) =>
        getResource(id)
            .map(({ data, ...resource }) => dashboardLoaded(resource, convertDependenciesMappingForCompatibility(data)))
            .let(wrapStartStop(
                dashboardLoading(true, "loading"),
                dashboardLoading(false, "loading"),
                e => {
                    const page = window.location.href.match('dashboard-embedded')
                        ? 'dashboardEmbedded'
                        : 'dashboard';
                    let message = page + ".errors.loading.unknownError";
                    if (e.status === 403 ) {
                        message = page + ".errors.loading.pleaseLogin";
                        if ( isLoggedIn(store.value)) {
                            message = page + ".errors.loading.dashboardNotAccessible";
                        }
                    } if (e.status === 404) {
                        message = page + ".errors.loading.dashboardDoesNotExist";
                    }
                    return Observable.of(
                        error({
                            title: page + ".errors.loading.title",
                            message
                        }),
                        dashboardLoadError({...e, messageId: message})
                    );
                }
            ))
    );
export const reloadDashboardOnLoginLogout = (action$) =>
    action$.ofType(LOAD_DASHBOARD).switchMap(
        ({ id }) => action$
            .ofType(LOGIN_SUCCESS, LOGOUT)
            .switchMap(() => Observable.of(loadDashboard(id)).delay(1000))
            .takeUntil(action$.ofType(LOCATION_CHANGE))
    );
// saving dashboard flow (both creation and update)
export const saveDashboard = action$ => action$
    .ofType(SAVE_DASHBOARD)
    .exhaustMap(({resource} = {}) =>
        (!resource.id ? createResource(resource) : updateResource(resource))
            .switchMap(rid => Observable.of(
                dashboardSaved(rid),
                resource.id ? triggerSave(false) : triggerSaveAs(false),
                !resource.id
                    ? push(`/dashboard/${rid}`)
                    : loadDashboard(rid)
            ).merge(
                Observable.of(show({
                    id: "DASHBOARD_SAVE_SUCCESS",
                    title: "saveDialog.saveSuccessTitle",
                    message: "saveDialog.saveSuccessMessage"
                })).delay(!resource.id ? 1000 : 0) // delay to allow loading
            )
            )
            .let(wrapStartStop(
                dashboardLoading(true, "saving"),
                dashboardLoading(false, "saving")
            ))
            .catch(
                ({ status, statusText, data, message, ...other } = {}) => Observable.of(dashboardSaveError(status ? { status, statusText, data } : message || other), dashboardLoading(false, "saving"))
            )
    );

export const exportDashboard = action$ => action$
    .ofType(DASHBOARD_EXPORT)
    .switchMap(({data, fileName}) =>
        Observable.of([JSON.stringify({...data}), fileName, 'application/json'])
            .do((downloadArgs) => download(...downloadArgs))
            .map(() => toggleControl('export'))
    );

export const importDashboard = action$ => action$
    .ofType(DASHBOARD_IMPORT)
    .switchMap(({file, resource}) => (
        Observable.defer(() => readJson(file[0]).then((data) => data))
            .switchMap((dashboard) => Observable.of(
                dashboardLoaded(resource, dashboard),
                toggleControl('import')
            ))
            .catch((e) => Observable.of(
                error({ title: "dashboard.errors.loading.title" }),
                dashboardLoadError({...e})
            ))
    ));

export default {
    openDashboardWidgetEditor,
    closeDashboardWidgetEditorOnFinish,
    initDashboardEditorOnNew,
    closeDashboardEditorOnExit,
    handleDashboardWidgetsFilterPanel,
    filterAnonymousUsersForDashboard,
    loadDashboardStream,
    reloadDashboardOnLoginLogout,
    saveDashboard,
    exportDashboard,
    importDashboard
};
