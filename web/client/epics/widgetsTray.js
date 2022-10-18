/*
 * Copyright 2019, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {Observable} from 'rxjs';

import { get } from 'lodash';
import { setCollapsed as setTimelineCollapsed, SET_COLLAPSED } from '../actions/timeline';

import {
    TOGGLE_COLLAPSE,
    INSERT,
    TOGGLE_COLLAPSE_ALL,
    UPDATE_PROPERTY,
    toggleCollapseAll,
    DELETE
} from '../actions/widgets';

import { MAP_CONFIG_LOADED } from '../actions/config';
import { info } from '../actions/notifications';
import { getVisibleFloatingWidgets } from '../selectors/widgets';
import { CHANGE_LAYER_PROPERTIES } from '../actions/layers';
import { isVisible as isTimelineVisible, hasLayers as hasTimelineLayers } from '../selectors/timeline';


const areWidgetsExpanded = state =>
    // NOTE: pinned widgets can stay together with the timeline
    (getVisibleFloatingWidgets(state) || []).filter(w => !(get(w, 'dataGrid.static'))).length > 0;

const notifyCollapsedTimeline = (messageProps) => stream$ =>
    (stream$)
        .take(1)
        .switchMap(() => Observable.of(info({
            ...messageProps,
            autoDismiss: 8,
            position: "tr",
            uid: "timeline-collapsed" // a unique identifier (if not present, current time is used),
        }))
        ).merge(stream$);

/**
 * Epics for widgets tray. Manage automatic tray actions (like timeline/widgets mutual exclusion)
 * @name widgetsTray
 * @memberof epics
 */
/**
 * Manages mutual exclusion of visibility between timeline and widgets.
 * This collapse timeline when one widget is expanded or added to the map
 */
export const collapseTimelineOnWidgetsEvents = (action$, store = {}) =>
    Observable.merge(
        // if there are some (not pinned) widgets
        action$.ofType(TOGGLE_COLLAPSE, TOGGLE_COLLAPSE_ALL, MAP_CONFIG_LOADED, UPDATE_PROPERTY, INSERT)
            .filter(() =>
                areWidgetsExpanded(store.value) && isTimelineVisible(store.value)
            )
    )
        .switchMap(() => Observable.of(setTimelineCollapsed(true)))
        .let(notifyCollapsedTimeline({
            title: "widgets.tray.notifications.collapsed.timelineTitle",
            message: "widgets.tray.notifications.collapsed.message"
        }));
/**
 * Manages mutual exclusion of visibility between timeline and widgets.
 * This collapse widgets when timeline is expanded or added to the map
 */
export const collapseWidgetsOnTimelineEvents = (action$, store = {}) =>
    Observable.merge(
        // when expand timeline...
        action$.ofType(SET_COLLAPSED).filter(({ collapsed }) => !collapsed),
        // ... or add some dimensions ...
        action$.ofType(CHANGE_LAYER_PROPERTIES).filter(({ newProperties = {} } = {}) => newProperties.dimensions)
    )// ...if there are widgets not collapsed
        .filter(() =>
            areWidgetsExpanded(store.value)
        && hasTimelineLayers(store.value)
        && isTimelineVisible(store.value)
        )
        .switchMap(() => Observable.of(toggleCollapseAll())).let(notifyCollapsedTimeline({
            title: "widgets.tray.notifications.collapsed.widgetsTitle",
            message: "widgets.tray.notifications.collapsed.message"
        }));
/**
 * When widgets tray disappears, the timeline have to be expanded anyway.
 * Otherwise it stays in collapsed state without any possibility to expand (tray is hidden)
 */
export const expandTimelineIfCollapsedOnTrayUnmount = (action$, store = {}) =>
    // on map load or when widgets has been removed (or pinned/unpinned)...
    action$.ofType(DELETE, UPDATE_PROPERTY, MAP_CONFIG_LOADED)
        // ... if timeline is present (hasLayers) and it is collapsed...
        .filter(() => !isTimelineVisible(store.value) && hasTimelineLayers(store.value))
        // ... and the widget tray is not visible (so when there are no widget expanded anymore, pinned excluded) ...
        .filter(() => !areWidgetsExpanded(store.value))
        // ... then force expand timeline
        .switchMap(() => Observable.of(setTimelineCollapsed(false)));

export default {
    collapseTimelineOnWidgetsEvents,
    collapseWidgetsOnTimelineEvents,
    expandTimelineIfCollapsedOnTrayUnmount
};
