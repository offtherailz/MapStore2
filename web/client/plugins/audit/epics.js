import {
    recordAudit,
    auditConfigLoaded,
    flushAuditBuffer,
    auditSendSuccess,
    RECORD_AUDIT,
    AUDIT_SEND_SUCCESS,
    AUDIT_CONFIG_LOADED,
    FLUSH_AUDIT_BUFFER
} from './actions';
import { LOCAL_CONFIG_LOADED } from '../../actions/localConfig';
import { checkAuditActive, sendAuditData } from './api/auditApi';
import { enrichAuditData, generateStandardAuditFields } from './utils/auditDataHelper';
import { shouldSend } from './utils/auditFilter';
import {
    isAuditEnabled,
    getPendingEvents,
    getFlushInterval,
    getMaxAuditSize,
    isAuditDevtoolEnabled,
    getFilterRules,
    getGa4Config
} from './selectors';
import { loadGa4, sendToGa4 } from './transports/ga4Transport';
import Rx from 'rxjs';
import { AUDIT_ACTIONS_REGISTRY } from './registry/auditActionsRegistry';

/**
 * Default audit configuration values
 */
const DEFAULT_AUDIT_CONFIG = {
    enabled: false,
    maxAuditSizeToSave: 50,
    flushInterval: 3, // in seconds
    auditDevToolEnabled: false
};


/**
 * Utility function to check if auditing is enabled
 * Returns an RxJS operator that filters actions based on audit config
 */
const filterByAuditEnabled = (store) => (source) =>
    source.filter(() => {
        const state = store.getState();
        return isAuditEnabled(state);
    });

/**
 * Helper function to process a single audit action
 * Processors return array of additional data objects
 * This function generates standard fields and merges with additional data
 *
 * Supports multiple registry entries for the same action type.
 * Each entry is processed independently and all events are merged.
 *
 * @param {Object} action - Redux action to process
 * @param {Array} registry - Audit actions registry
 * @param {Object} store - Redux store
 * @returns {Observable} Observable of recordAudit actions
 */
const processAuditAction = (action, registry, store) => {
    const state = store.getState();
    const filterRules = getFilterRules(state);

    // Find ALL registry entries that match this action type
    const matchingEntries = registry.filter(entry => entry.actionToWatch === action.type);

    if (matchingEntries.length === 0) {
        return Rx.Observable.empty();
    }

    try {
        // Process all matching registry entries and collect all events
        const allAuditEvents = matchingEntries.flatMap(registryEntry => {
            // Check condition if exists
            if (registryEntry.condition && !registryEntry.condition(action, state)) {
                return [];
            }

            // Call processor to get array of additional data
            const additionalDataArray = registryEntry.processor(action, state);

            // Generate audit events with standard fields + additional data
            return additionalDataArray.map(additionalData => {
                const eventType = registryEntry.eventType;
                const standardFields = generateStandardAuditFields(state, eventType);
                const enrichedData = enrichAuditData(standardFields, additionalData);

                // Apply filter rules - reduce recordAudit action noise
                if (!shouldSend(enrichedData, filterRules)) {
                    return null;
                }

                return recordAudit(eventType, enrichedData);
            }).filter(event => event !== null); // Remove filtered events
        });

        // Emit all recordAudit actions
        return Rx.Observable.from(allAuditEvents);

    } catch (error) {
        console.error(`Audit processing error for ${action.type}:`, error);
        return Rx.Observable.empty();
    }
};

/**
 * Generic epic that watches all registered actions and processes them for auditing
 * Supports:
 * - Debouncing per action type (takes only the latest action after inactivity period)
 * - Multiple audit records per action (via array return from processor)
 * - Multiple registry entries for same action type (each processed independently)
 */
export const genericAuditEpic = (action$, store) => {
    const watchedActions = [...new Set(AUDIT_ACTIONS_REGISTRY.map(entry => entry.actionToWatch))];

    return action$.ofType(...watchedActions)
        .let(filterByAuditEnabled(store))
        .groupBy(action => action.type)
        .mergeMap(group$ => {
            const actionType = group$.key;
            const matchingEntries = AUDIT_ACTIONS_REGISTRY.filter(entry => entry.actionToWatch === actionType);

            // Apply debounce if ANY matching entry has it configured
            // Use the first debounce value found (all entries for same action should use same debounce)
            const debounceTime = matchingEntries.find(entry => entry.debounce)?.debounce;

            const stream = debounceTime
                ? group$.debounceTime(debounceTime)
                : group$;

            return stream.switchMap((action) =>
                processAuditAction(action, AUDIT_ACTIONS_REGISTRY, store)
            );
        });
};

/**
 * Epic for loading audit configuration
 * Extracts audit config from localConfig.json and applies defaults
 */
export const auditConfigEpic = (action$) =>
    action$.ofType(LOCAL_CONFIG_LOADED)
        .take(1)
        .switchMap((action) => {
            const auditConfig = action.config?.auditing || {};
            const restDisabled = auditConfig.transports?.rest?.enabled === false;

            // Skip REST backend check when REST transport is explicitly disabled
            // (e.g. GA4-only mode). Enable auditing based on local config alone.
            const backendCheck$ = restDisabled
                ? Rx.Observable.of({ active: auditConfig.enabled ?? true, reason: 'rest-transport-disabled' })
                : Rx.Observable.defer(() => checkAuditActive());

            const locallyEnabled = auditConfig.enabled ?? true;
            return backendCheck$.map(({active, reason}) => {
                auditConfig.auditAPIActive = active;
                auditConfig.localConfigEnabled = auditConfig.enabled;
                auditConfig.reason = reason;
                if (!restDisabled) {
                    if (locallyEnabled && !active) {
                        console.warn('Auditing is enabled in configuration but the audit service API is not active. Disabling auditing.');
                        auditConfig.enabled = false;
                    } else if (!locallyEnabled && active) {
                        console.warn('Auditing is disabled in configuration but the audit service API is active. Disabling auditing.');
                        auditConfig.enabled = false;
                    } else {
                        auditConfig.enabled = active;
                    }
                }
                const mergedConfig = {
                    ...DEFAULT_AUDIT_CONFIG,
                    ...auditConfig,
                    flushInterval: (auditConfig.flushInterval ?? DEFAULT_AUDIT_CONFIG.flushInterval) * 1000
                };

                const ga4Config = mergedConfig.transports?.ga4;
                if (ga4Config?.enabled && ga4Config?.measurementId) {
                    loadGa4(ga4Config.measurementId)
                        .then(() => console.info('Audit GA4 transport ready'))
                        .catch(e => console.error('Audit GA4 transport failed to load:', e));
                }

                return auditConfigLoaded(mergedConfig);
            });
        });


/**
 * Epic for timer-based audit flushing
 * Flushes pending events every flushInterval milliseconds
 * Timer resets after any flush (timer-based or size-based)
 */
export const auditFlushEpic = (action$, store) =>
    action$.ofType(AUDIT_CONFIG_LOADED, AUDIT_SEND_SUCCESS)
        .let(filterByAuditEnabled(store))
        .switchMap(() => {
            const state = store.getState();
            const flushInterval = getFlushInterval(state);

            if (!flushInterval) {
                return Rx.Observable.empty();
            }


            return Rx.Observable.interval(flushInterval)
                .mergeMap(() => {
                    const currentState = store.getState();
                    const pendingEvents = getPendingEvents(currentState);

                    if (pendingEvents.length > 0) {
                        return Rx.Observable.of(flushAuditBuffer(pendingEvents));
                    }

                    return Rx.Observable.empty();

                });
        });

/**
 * Epic for size-based audit flushing
 * Flushes when pending events exceed maxAuditSizeToSave
 */
export const auditSizeCheckEpic = (action$, store) =>
    action$.ofType(RECORD_AUDIT)
        .let(filterByAuditEnabled(store))
        .mergeMap(() => {
            const state = store.getState();
            const maxAuditSize = getMaxAuditSize(state);
            const pendingEvents = getPendingEvents(state);

            if (!maxAuditSize) {
                return Rx.Observable.empty();
            }

            if (pendingEvents.length >= maxAuditSize) {
                return Rx.Observable.of(flushAuditBuffer(pendingEvents));
            }
            return Rx.Observable.empty();
        });

/**
 * Epic for handling FLUSH_AUDIT_BUFFER action
 * Sends pending events to audit API
 */
export const auditFlushHandlerEpic = (action$, store) =>
    action$.ofType(FLUSH_AUDIT_BUFFER)
        .let(filterByAuditEnabled(store))
        .switchMap((action) => {
            const events = action.events || [];
            const state = store.getState();
            const debug = isAuditDevtoolEnabled(state);
            if (events.length === 0) {
                return Rx.Observable.empty();
            }

            // GA4 transport — fire-and-forget, independent of REST
            const ga4Config = getGa4Config(state);
            if (ga4Config?.enabled) {
                sendToGa4(events);
            }

            const restConfig = state.audit?.config?.transports?.rest;
            // REST transport disabled explicitly → skip, emit success with 0
            if (restConfig?.enabled === false) {
                return Rx.Observable.of(auditSendSuccess(0));
            }

            return Rx.Observable.fromPromise(sendAuditData(events, {debug}))
                .map((response) => {
                    return auditSendSuccess(response.count);
                })
                .catch((error) => {
                    console.error('AUDIT FLUSH HANDLER: API error:', error);
                    return Rx.Observable.empty();
                });
        });


// Export all epics - complete audit system
export const auditEpics = {
    genericAuditEpic,
    auditConfigEpic,
    auditFlushEpic,
    auditSizeCheckEpic,
    auditFlushHandlerEpic
};
