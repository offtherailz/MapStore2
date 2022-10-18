/*
 * Copyright 2018, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import moment from 'moment';

import { get } from 'lodash';

import {
    PLAY,
    PAUSE,
    STOP,
    STATUS,
    SET_FRAMES,
    SET_CURRENT_FRAME,
    TOGGLE_ANIMATION_MODE,
    ANIMATION_STEP_MOVE,
    stop,
    setFrames,
    appendFrames,
    setCurrentFrame,
    framesLoading,
    updateMetadata,
    setIntervalData,
    toggleAnimationMode
} from '../actions/playback';

import { moveTime, SET_CURRENT_TIME, MOVE_TIME } from '../actions/dimension';
import { selectLayer, onRangeChanged, timeDataLoading, SELECT_LAYER, SET_MAP_SYNC, SET_SNAP_TYPE } from '../actions/timeline';
import { changeLayerProperties, CHANGE_LAYER_PROPERTIES, REMOVE_NODE } from '../actions/layers';
import { error } from '../actions/notifications';

import {
    currentTimeSelector,
    layersWithTimeDataSelector,
    layerTimeSequenceSelectorCreator
} from '../selectors/dimension';

import { LOCATION_CHANGE } from 'connected-react-router';

import {
    currentFrameSelector,
    currentFrameValueSelector,
    lastFrameSelector,
    playbackRangeSelector,
    playbackSettingsSelector,
    frameDurationSelector,
    statusSelector,
    playbackMetadataSelector
} from '../selectors/playback';

import {
    selectedLayerSelector,
    selectedLayerName,
    selectedLayerUrl,
    selectedLayerData,
    selectedLayerTimeDimensionConfiguration,
    rangeSelector,
    snapTypeSelector,
    timelineLayersSelector,
    multidimOptionsSelectorCreator,
    isVisible
} from '../selectors/timeline';

import { getDatesInRange } from '../utils/TimeUtils';
import pausable from '../observables/pausable';
import { wrapStartStop } from '../observables/epics';
import { getTimeDomainsObservable } from '../observables/multidim';
import { getDomainValues } from '../api/MultiDim';
import {Observable} from 'rxjs';

const BUFFER_SIZE = 20;
const PRELOAD_BEFORE = 10;
const toAbsoluteInterval = (start, end) => `${start}/${end}`;

/**
 * Generates the argument to pass to the getDomainValues service.
 * @param {function} store return the state
 * @param {object} paginationOptions additional options to send to the service. (e.g. `fromValue`)
 */
const domainArgs = (store, paginationOptions = {}) => {
    const id = selectedLayerSelector(store.value);
    const layerName = selectedLayerName(store.value);
    const layerUrl = selectedLayerUrl(store.value);
    const { startPlaybackTime, endPlaybackTime } = playbackRangeSelector(store.value) || {};
    const shouldFilter = statusSelector(store.value) === STATUS.PLAY || statusSelector(store.value) === STATUS.PAUSE;
    const fromEnd = snapTypeSelector(store.value) === 'end';
    return [layerUrl, layerName, "time", {
        limit: BUFFER_SIZE, // default, can be overridden by pagination options
        time: startPlaybackTime && endPlaybackTime && shouldFilter ? toAbsoluteInterval(startPlaybackTime, endPlaybackTime) : undefined,
        fromEnd,
        ...paginationOptions
    },
    multidimOptionsSelectorCreator(id)(store.value)
    ];
};

/**
 * Emulates the getDomainValues when user wants to animate with fixed step (e.g. 1 hour)
 * Returns the stream that emits an array containing the animation steps.
 *
 * @param {function} store returns the state
 * @param {objects} param1 the options to use. May contain `fromValue`
 */
const createAnimationValues = (store, { fromValue, limit = BUFFER_SIZE, sort = "asc" } = {}) => {
    const {
        timeStep,
        stepUnit
    } = playbackSettingsSelector(store.value);
    const interval = moment.duration(timeStep, stepUnit);
    const playbackRange = playbackRangeSelector(store.value) || {};
    const startPlaybackTime = playbackRange.startPlaybackTime;
    const endPlaybackTime = playbackRange.endPlaybackTime;
    let currentTime = fromValue !== undefined ? fromValue : startPlaybackTime || currentTimeSelector(store.value) || (new Date()).toString();
    const values = [];
    if (currentTime !== fromValue) {
        values.push(moment(currentTime).toISOString());
    }
    for (let i = 0; i < limit; i++) {
        currentTime = moment(currentTime).add(sort === "asc" ? interval : -1 * interval);
        if (!endPlaybackTime || currentTime.isBefore(endPlaybackTime)) {
            values.push(currentTime.toISOString());
        } else {
            break;
        }
    }
    return Observable.of(values);
};

/**
 * Gets the static list of times to animate
 */
const filterAnimationValues = (values, store, {fromValue, limit = BUFFER_SIZE} = {}) => {
    const playbackRange = playbackRangeSelector(store.value) || {};
    const startPlaybackTime = playbackRange.startPlaybackTime;
    const endPlaybackTime = playbackRange.endPlaybackTime;
    return Observable.of(values
        // remove times before out of playback range
        .filter(v => startPlaybackTime && endPlaybackTime ? moment(v).isSameOrAfter(startPlaybackTime) && moment(v).isSameOrBefore(endPlaybackTime) : true)
        // Remove values before fromValue
        .filter(v => fromValue ? moment(v).isAfter(fromValue) : true)
        // limit size to BUFFER_SIZE
        .slice(0, limit));
};

/**
 * if we have a selected layer and time occurrences are expressed as intervals
 * it will filter out those dates that won't fall within the animation frame limit
 * will also consider only the dates of interest (start or end) chosen by the user
 * @param {function} {store} returns the application state
 * @param {string[]} domainsArray the domain values array used to create the animation frames
 */
const getTimeIntervalDomains = (store, domainsArray) => {
    let intervalDomains = domainsArray;
    const playbackRange = playbackRangeSelector(store.value) || {};
    const snapTo = snapTypeSelector(store.value);
    const endPlaybackTime = playbackRange?.endPlaybackTime;
    const startPlaybackTime =  playbackRange?.startPlaybackTime;
    intervalDomains = snapTo && snapTo === 'end' ?  domainsArray.map(date => date.split('/')[1]) : domainsArray.map(date => date.split('/')[0]);
    return startPlaybackTime && endPlaybackTime ? getDatesInRange(intervalDomains, startPlaybackTime, endPlaybackTime) : intervalDomains;
};

/**
 * Returns an observable that emit an array of time frames, based of the current configuration:
 *  - If configured as fixed steps, it returns the list of next animation frame calculating them
 *  - If there is a selected layer and there is the Multidim extension, then use it (in favour of static values configured)
 *  - If there are values in the dimension configuration, and the Multidim extension is not present, use them to animate
 * @param {function} store returns the application state
 * @param {object} options the options that normally match the getDomainValues options
 */
const getAnimationFrames = (store, options) => {
    if (selectedLayerName(store.value)) {
        const values = layerTimeSequenceSelectorCreator(selectedLayerData(store.value))(store.value);
        const timeDimConfig = selectedLayerTimeDimensionConfiguration(store.value);
        // check if multidim extension is available. It has priority to local values
        if (get(timeDimConfig, "source.type") !== "multidim-extension" && values && values.length > 0) {
            return filterAnimationValues(values, store, options);
        }
        const domainValues = getDomainValues(...domainArgs(store, options));
        return domainValues.map(res => {
            const domainsArray =  res.DomainValues.Domain.split(",");
            // if there is a selected layer check for time intervals (start/end)
            // and filter-out domain dates falling outisde the start/end playBack time
            const selectedLayer = selectedLayerSelector(store.value);
            const x = selectedLayer ? getTimeIntervalDomains(store, domainsArray) : domainsArray;
            return x;
        });
    }
    return createAnimationValues(store, options);
};

/**
 * Setup animation adding some action before and after the animationEventsStream$
 * Function returns a a function that operates on the stream (aka pipe-able aka let-table operator)
 * @param {function} store returns the current state
 */
const setupAnimation = (store = () => ({})) => animationEventsStream$ => {
    const layers = layersWithTimeDataSelector(store.value);
    return Observable.from(
        layers.map(l => changeLayerProperties(l.id, {singleTile: true}))
    ).concat(animationEventsStream$)
        // restore original singleTile configuration
        .concat(Observable.from(
            layers.map(l => changeLayerProperties(l.id, { singleTile: l.singleTile }))
        ));
};
/**
 * Check if a time is in out of the defined range. If range start or end are not defined, returns false.
 * @param {string|Date} time the time to check
 * @param {Object} interval the interval where the time should stay `{start: ISODate|Date, end: ISODate|Date}
 */
const isOutOfRange = (time, { start, end } = {}) =>
    start && end && ( moment(time).isBefore(start) || moment(time).isAfter(end));


/**
 * When animation start, triggers the flow to retrieve the frames, buffering them:
 * The first setFrames will trigger the animation.
 * On any new animation frame, if the buffer is near to finish, this epic triggers
 * the retrieval of the next frames, until the animation ends.
 */
export const retrieveFramesForPlayback = (action$, { store = () => { } } = {}) =>
    action$.ofType(PLAY).exhaustMap(() =>
        getAnimationFrames(store, {
            fromValue:
                // if animation range is set, don't set from value on startup...
                (playbackRangeSelector(store.value)
                    && playbackRangeSelector(store.value).startPlaybackTime
                    && playbackRangeSelector(store.value).endPlaybackTime)
                    ? undefined
                // ...otherwise, start from the current time (start animation from cursor position)
                    : currentTimeSelector(store.value),
            ...(snapTypeSelector(store.value) === 'end' ? {fromEnd: true} : {})
        })
            .map((frames) => setFrames(frames))
            .let(wrapStartStop(framesLoading(true), framesLoading(false)), () => Observable.of(
                error({
                    title: "There was an error retrieving animation", // TODO: localize
                    message: "Please contact the administrator" // TODO: localize
                }),
                stop()
            ))
            // show loading mask
            .let(wrapStartStop(timeDataLoading(false, true), timeDataLoading(false, false)))
            .concat(
                action$
                    .ofType(SET_CURRENT_FRAME)
                    .filter(({ frame }) => frame % BUFFER_SIZE === ((BUFFER_SIZE - PRELOAD_BEFORE)))
                    .switchMap(() => {
                        return getAnimationFrames(store, {
                            fromValue: lastFrameSelector(store.value),
                            ...(snapTypeSelector(store.value) === 'end' ? {fromEnd: true} : {})
                        })
                            .map(appendFrames)
                            .let(wrapStartStop(framesLoading(true), framesLoading(false)));
                    })
            )
            .takeUntil(action$.ofType(STOP, LOCATION_CHANGE))
            // this removes loading mask even if the STOP action is triggered before frame end (empty result)
            .concat(Observable.of(timeDataLoading(false, false)))
            .let(setupAnimation(store))
    );
/**
 * When the new animation frame is triggered, changes the current time, if the next frame is available. Otherwise stops.
 * NOTE: we don't have a count of next animation steps, so we suppose that the selector has already pre-loaded next animation steps.
 */
export const updateCurrentTimeFromAnimation = (action$, { store = () => { } } = {}) =>
    action$.ofType(SET_CURRENT_FRAME)
        .map(() => currentFrameValueSelector(store.value))
        .map(t => t ? moveTime(t) : stop());
/**
 * When a new frame sequence is set, the animation starts.
 */
export const timeDimensionPlayback = (action$, { store = () => { } } = {}) =>
    action$.ofType(SET_FRAMES)
        .exhaustMap(() =>
            Observable.interval(frameDurationSelector(store.value) * 1000)
                .startWith(0) // start immediately
                .let(pausable(
                    action$
                        .ofType(PLAY, PAUSE)
                        .map(a => a.type === PLAY)
                ))
                // pause is with loss, so the count of timer is not correct.
                // the following scan emit a for every event emitted effectively, with correct count
                // TODO: in case of loop, we can reset to 0 on load end.
                .map(() => setCurrentFrame(currentFrameSelector(store.value) + 1))
                .merge( action$.ofType(ANIMATION_STEP_MOVE)
                    .map(({direction}) =>
                        setCurrentFrame(
                            Math.max(0, currentFrameSelector(store.value) + direction)))
                )
                .concat(Observable.of(stop()))
                .takeUntil(action$.ofType(STOP, LOCATION_CHANGE))
        );
/**
 * Synchronizes the fixed animation step toggle with guide layer on timeline
 */
export const playbackToggleGuideLayerToFixedStep = (action$, { store = () => { } } = {}) =>
    action$
        .ofType(TOGGLE_ANIMATION_MODE)
        .exhaustMap(() =>
            selectedLayerName(store.value)
                // need to deselect
                ? Observable.of(selectLayer(undefined))
                // need to select first
                : Observable.of(
                    selectLayer(
                        get(timelineLayersSelector(store.value), "[0].id")
                    )
                )
        );
/**
 * Allow to move time 1 single step. TODO: evaluate to move this in timeline controls
 */
export const playbackMoveStep = (action$, { store = () => { } } = {}) =>
    action$
        .ofType(ANIMATION_STEP_MOVE)
        .filter(() => statusSelector(store.value) !== STATUS.PLAY /* && statusSelector(store.value) !== STATUS.PAUSE*/) // if is playing, the animation manages this event
        .switchMap(({ direction = 1 }) => {
            const md = playbackMetadataSelector(store.value) || {};
            const currentTime = currentTimeSelector(store.value);
            // check if the next/prev value is present in the state (by `playbackCacheNextPreviousTimes`)
            if (currentTime && md.forTime === currentTime) {
                return Observable.of(direction > 0 ? md.next : md.previous);
            }
            // if not downloaded yet, download it
            return getAnimationFrames(store, { limit: 1, sort: direction > 0 ? "asc" : "desc", fromValue: currentTimeSelector(store.value), ...(snapTypeSelector(store.value) === 'end' ? {fromEnd: true} : {}) })
                .map(([t] = []) => t);
        }).filter(t => !!t)
        .map(t => {
            const time = (snapTypeSelector(store.value) === 'end' ? t.split('/')[1] : t.split('/')[0]) ?? t;
            return moveTime(time);
        });
/**
 * Pre-loads next and previous values for the current time, when change.
 * This is useful to enable/disable playback buttons in guide-layer mode. The state updated by this
 * epic is also used as a cache to load next/previous button (only when the animation is not active)
 */
export const playbackCacheNextPreviousTimes = (action$, { store = () => { } } = {}) =>
    action$
        .ofType(SET_CURRENT_TIME, MOVE_TIME, SELECT_LAYER, STOP, SET_MAP_SYNC, SET_SNAP_TYPE)
        .filter(() => statusSelector(store.value) !== STATUS.PLAY && statusSelector(store.value) !== STATUS.PAUSE)
        .filter(() => selectedLayerSelector(store.value))
        .filter( t => !!t )
        .switchMap(({time: actionTime}) => {
            // get current time in case of SELECT_LAYER
            const time = actionTime || currentTimeSelector(store.value);
            const snapType = snapTypeSelector(store.value);
            return getTimeDomainsObservable(domainArgs, false, store, snapType, time).map(([next, previous]) => {
                return updateMetadata({
                    forTime: time,
                    next,
                    previous
                });
            });
        });

/**
 * Get domains with a slight buffer to detect whether the layer consists of
 * instants/point or intervals/bars time value. The results is used to
 * disable/enable the radio buttons to snap to start/end of time interval
 */
export const setIsIntervalData = (action$, { store = () => { } } = {}) =>
    action$.ofType(SELECT_LAYER, SET_CURRENT_TIME)
        .filter(({layerId}) => layerId || selectedLayerSelector(store.value))
        .switchMap(({time: actionTime}) => {
            const time = actionTime || currentTimeSelector(store.value);
            const snapType = snapTypeSelector(store.value);
            return getTimeDomainsObservable(domainArgs, true, store, snapType, time)
                .map(([next, previous]) => {
                    const isTimeIntervalData = next.indexOf('/') !== -1 || previous.indexOf('/') !== -1;
                    return setIntervalData(isTimeIntervalData);
                });
        });

/**
 * In case a layer in the timeline is unselected from the TOC the timeline
 * settings for snapping for layers are toggled off, this is to avoid persistence
 * of selection of a non-visible layer on the timeline state, causing inconsistencies
 * in case of mixed (point/interval) time based layers
 */
export const switchOffSnapToLayer = (action$, { store = () => { } } = {}) =>
    action$.ofType(CHANGE_LAYER_PROPERTIES)
        .filter(({newProperties, layer}) => {
            const selectedLayer = selectedLayerSelector(store.value);
            return (newProperties?.visibility !== undefined &&
                    selectedLayer === layer &&
                    // check if timeline component is visible
                    isVisible(store.value));
        })
        .switchMap(() => Observable.of(toggleAnimationMode()));

/**
 * During animation, on every current time change event, if the current time is out of the current range window, the timeline will shift to
 * current start-end values
 */
export const playbackFollowCursor = (action$, { store = () => { } } = {}) =>
    action$
        .ofType(MOVE_TIME)
        .filter(({type}) =>
            (type === MOVE_TIME || statusSelector(store.value) === STATUS.PLAY )
            && isOutOfRange(currentTimeSelector(store.value), rangeSelector(store.value)))
        .filter(() => get(playbackSettingsSelector(store.value), "following") )
        .switchMap(() => Observable.of(
            onRangeChanged(
                (() => {
                    const currentTime = currentTimeSelector(store.value);
                    const {start, end} = rangeSelector(store.value);
                    const difference = moment(end).diff(moment(start));
                    const nextEnd = moment(currentTime).add(difference).toISOString();
                    return {
                        start: currentTime,
                        end: nextEnd
                    };
                })()
            )
        ));

export const playbackStopWhenDeleteLayer = (action$, { store = () => {} } = {}) =>
    action$
        .ofType(REMOVE_NODE)
        .filter( () =>
            !selectedLayerSelector(store.value)
            && statusSelector(store.value) === "PLAY"
        )
        .switchMap( () => Observable.of(stop()));


export default {
    retrieveFramesForPlayback,
    updateCurrentTimeFromAnimation,
    timeDimensionPlayback,
    playbackToggleGuideLayerToFixedStep,
    playbackMoveStep,
    playbackCacheNextPreviousTimes,
    playbackFollowCursor,
    playbackStopWhenDeleteLayer,
    setIsIntervalData,
    switchOffSnapToLayer
};
