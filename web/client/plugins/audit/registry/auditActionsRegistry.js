
import { LOGIN_SUCCESS } from '../../../actions/security';
import { TEXT_SEARCH_STARTED, TEXT_SEARCH_ITEM_SELECTED } from '../../../actions/search';
import { LOAD_FEATURE_INFO } from '../../../actions/mapInfo';
import { CLICK_ON_MAP } from '../../../actions/map';
import { SAVE_SUCCESS, DELETE_SELECTED_FEATURES, SET_LAYER, UPDATE_FILTER } from '../../../actions/featuregrid';
import { MAP_CONFIG_LOADED } from '../../../actions/config';
import { DASHBOARD_LOADED } from '../../../actions/dashboard';
import { GEOSTORY_LOADED } from '../../../actions/geostory';
import {
    processSearchAdditionalData,
    processSearchClickAdditionalData,
    processMapClickAdditionalData,
    processMapClickResultAdditionalData,
    processRecordCreationFromSaveSuccess,
    processRecordUpdateFromSaveSuccess,
    processRecordDeleteAdditionalData,
    processAttributeTableOpenAdditionalData,
    processAttributeTableSearchAdditionalData
} from '../processors';
import { isPathForExistingResource } from '../utils/auditDataHelper';

/**
 * Audit Actions Registry
 *
 * Defines which actions should be audited and how to process them.
 *
 * Configuration options for each action:
 * - actionToWatch: (string) Redux action type to watch (required)
 * - eventType: (string) Name of the audit event (required for single event)
 * - processor: (function) Function to extract additional data from action and state
 * - keysMap: (object) Maps database column keys (key1, key2, etc.) to field names
 * - debounce: (number) Milliseconds to debounce the action (optional)
 * - condition: (function) Predicate to determine if action should be audited (optional) parameters -> (action, state)
 *
 * Processor function signature:
 *   (action, state) => additionalData[]
 *
 * Where:
 *   additionalData = Array of objects with ONLY action-specific fields (e.g., [{searchText: "..."}])
 *                    Standard fields (eventType, resourceType, resourceId, appContext) added by epic
 *
 * Multiple Registry Entries for Same Action:
 *   The same action can have multiple registry entries with different eventTypes.
 *   Each entry is processed independently and all events are merged.
 *   - Example: SAVE_SUCCESS has two entries - one for RECORD_CREATION, one for RECORD_UPDATE
 *
 * Keys Map Convention:
 *   - layer_url and layer_name have dedicated database columns (not key1/key2)
 *   - key1, key2, key3, etc. are used for other event-specific fields
 *
 * Usage of keysMap:
 *   - To DB: auditKeysParser(data, keysMap, false) - converts client fields → database keys
 *   - From DB: auditKeysParser(data, keysMap, true) - converts database keys → client fields
 *
 * Note: Processors should ALWAYS return an array and should NOT call generateStandardAuditFields or enrichAuditData.
 *       The epic automatically generates standard fields and merges with processor data.
 */
export const AUDIT_ACTIONS_REGISTRY = [
    // LOGIN Event
    // Additional fields: None (only standard fields)
    {
        actionToWatch: LOGIN_SUCCESS,
        eventType: 'LOGIN',
        // no additional data is needed for login
        processor: () => [{}],
        keysMap: {}
    },

    // SEARCH Event
    // Additional fields: searchText
    {
        actionToWatch: TEXT_SEARCH_STARTED,
        eventType: 'SEARCH',
        processor: processSearchAdditionalData,
        debounce: 1000,
        condition: (_, state) => state.search?.searchText?.length > 2,
        keysMap: {
            key01: 'searchText'
        }
    },

    // SEARCH_CLICK Event
    // Additional fields: service, lat, lon, title
    {
        actionToWatch: TEXT_SEARCH_ITEM_SELECTED,
        eventType: 'SEARCH_CLICK',
        processor: processSearchClickAdditionalData,
        keysMap: {
            key01: 'service',
            key02: 'lat',
            key03: 'lon',
            key04: 'title'
        }
    },

    // MAP_CLICK Event
    // Additional fields: lat, lon
    // Generates a single event with just the click coordinates
    // Triggered when user clicks on the map
    {
        actionToWatch: CLICK_ON_MAP,
        eventType: 'MAP_CLICK',
        processor: processMapClickAdditionalData,
        keysMap: {
            key01: 'lat',
            key02: 'lon'
        }
    },

    // MAP_CLICK_RESULT Event
    // Additional fields: layerUrl, layerName, lat, lon
    // Generates one event per layer that returned features (includes vector, WMS, WFS)
    // Triggered when ALL GetFeatureInfo queries are complete
    {
        actionToWatch: LOAD_FEATURE_INFO,
        eventType: 'MAP_CLICK_RESULT',
        processor: processMapClickResultAdditionalData,
        condition: (action, state) => {
            // Only audit when this is the LAST response (all queries complete)
            const requests = state.mapInfo?.requests || [];
            const responses = state.mapInfo?.responses || [];
            return requests.length > 0 && requests.length === responses.length;
        },
        keysMap: {
            key01: 'lat',
            key02: 'lon'
        }
    },
    // ATTRIBUTE_TABLE_OPEN Event
    // Additional fields: layer_url, layer_name
    {
        actionToWatch: SET_LAYER,
        eventType: 'ATTRIBUTE_TABLE_OPEN',
        processor: processAttributeTableOpenAdditionalData,
        keysMap: {
        }
    },

    // ATTRIBUTE_TABLE_SEARCH Event
    // Additional fields: layerUrl, layerName, attributeName, attributeValue, operator
    {
        actionToWatch: UPDATE_FILTER,
        eventType: 'ATTRIBUTE_TABLE_SEARCH',
        processor: processAttributeTableSearchAdditionalData,
        debounce: 1000, // Apply 1 second debounce to prevent overflow during typing
        condition: (action, state) => {
            // Only track if we have a selected layer and filter update with value
            const update = action.update || {};
            return state.featuregrid?.selectedLayer && update.attribute && update.value;
        },
        keysMap: {
            key01: 'attributeName',
            key02: 'attributeValue',
            key03: 'operator'
            // layerUrl and layerName have dedicated database columns
        }
    },

    // RECORD_CREATION Event (from SAVE_SUCCESS)
    // Additional fields: layerUrl, layerName
    // Generates RECORD_CREATION events for new features created in the feature grid
    // Triggered after WFS Transaction API succeeds, ensuring only successful saves are audited
    {
        actionToWatch: SAVE_SUCCESS,
        eventType: 'RECORD_CREATION',
        processor: processRecordCreationFromSaveSuccess
    },

    // RECORD_UPDATE Event (from SAVE_SUCCESS)
    // Additional fields: layerUrl, layerName, recordId
    // Generates RECORD_UPDATE events for modified features in the feature grid
    // Triggered after WFS Transaction API succeeds, ensuring only successful saves are audited
    {
        actionToWatch: SAVE_SUCCESS,
        eventType: 'RECORD_UPDATE',
        processor: processRecordUpdateFromSaveSuccess,
        keysMap: {
            key01: 'recordId'
        }
    },

    // RECORD_DELETE Event
    // Additional fields: layerUrl, layerName, recordId
    // Generates one event per feature selected for deletion in the feature grid
    // Triggered when user deletes the selected features
    {
        actionToWatch: DELETE_SELECTED_FEATURES,
        eventType: 'RECORD_DELETE',
        processor: processRecordDeleteAdditionalData,
        keysMap: {
            key01: 'recordId'
        }
    },

    // RESOURCE_ACCESS Event - Map/Context
    // Tracks when users access map or context resources
    // MAP_CONFIG_LOADED fires for both direct map access and when loading a context
    // Additional fields: None (standard fields capture resourceId and type)
    {
        actionToWatch: MAP_CONFIG_LOADED,
        eventType: 'RESOURCE_ACCESS',
        processor: () => [{}],
        condition: (_, state) => isPathForExistingResource(state.router?.location?.pathname),
        keysMap: {}
    },

    // RESOURCE_ACCESS Event - Dashboard
    // Tracks when users successfully load a dashboard
    // Additional fields: None (standard fields capture resourceId and type)
    {
        actionToWatch: DASHBOARD_LOADED,
        eventType: 'RESOURCE_ACCESS',
        processor: () => [{}],
        condition: (_, state) => isPathForExistingResource(state.router?.location?.pathname),
        keysMap: {}
    },

    // RESOURCE_ACCESS Event - GeoStory
    // Tracks when users successfully load a GeoStory
    // Additional fields: None (standard fields capture resourceId and type)
    {
        actionToWatch: GEOSTORY_LOADED,
        eventType: 'RESOURCE_ACCESS',
        processor: () => [{}],
        condition: (_, state) => isPathForExistingResource(state.router?.location?.pathname),
        keysMap: {},
        debounce: 1000
    }
];
