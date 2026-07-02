
import { createPlugin } from '../../utils/PluginsUtils';
import auditReducer from './reducers';
import { auditEpics } from './epics';
import AuditDevtool from './components/auditDevtool/auditDevtool';

/**
 * @name Auditing
 * @memberof plugins
 * @class
 * Auditing Plugin for MapStore2
 *
 * Captures user interactions and system events as structured audit records, enriches them
 * with standard metadata (resourceType, resourceId, appContext, timestamp, sessionId), and
 * forwards them to one or more configurable transports (REST backend, Google Analytics 4).
 *
 * The plugin activates automatically when added to the page plugins list — no user interaction
 * required. If `auditDevToolEnabled` is `true`, an in-browser panel shows buffered events in
 * real time for development and integration testing.
 *
 * ## How it works
 *
 * 1. `genericAuditEpic` watches all Redux actions registered in `auditActionsRegistry.js`.
 *    Each registry entry declares the action to watch, an optional debounce, an optional
 *    condition predicate, and a processor function that extracts event-specific fields.
 * 2. Matching events are buffered in the Redux `audit` state.
 * 3. `auditFlushEpic` flushes the buffer on a timer (`flushInterval` seconds) or when it
 *    reaches `maxAuditSizeToSave` events.
 * 4. `auditFlushHandlerEpic` sends the batch to all enabled transports:
 *    - **REST**: `POST /rest/audit` — backend enriches with IP and username, saves to PostgreSQL.
 *    - **GA4**: `gtag('event', ...)` — semantic field names sent directly, no key01/key06 mapping.
 *
 * ## Events tracked out of the box
 *
 * | Event | Trigger |
 * |-------|---------|
 * | `RESOURCE_ACCESS` | Map, context, dashboard, or geostory loaded |
 * | `LOGIN` | Successful authentication |
 * | `SEARCH` | Text search (debounced 1 s, min 3 chars) |
 * | `SEARCH_CLICK` | Search result selected |
 * | `MAP_CLICK` | Click on the map |
 * | `MAP_CLICK_RESULT` | GetFeatureInfo complete — one event per layer with features |
 * | `ATTRIBUTE_TABLE_OPEN` | Feature grid opened |
 * | `ATTRIBUTE_TABLE_SEARCH` | Feature grid filter applied (debounced 1 s) |
 * | `RECORD_CREATION` | New feature saved via WFS-T |
 * | `RECORD_UPDATE` | Existing feature updated via WFS-T |
 * | `RECORD_DELETE` | Feature deleted via WFS-T |
 *
 * ## Configuration
 *
 * All settings live under `"auditing"` in `localConfig.json` — **not** in the plugin `cfg` block.
 * All keys are optional; defaults apply when omitted.
 *
 * @example
 * // localConfig.json — GA4-only deployment (no REST backend required)
 * {
 *   "auditing": {
 *     "enabled": true,
 *     "auditDevToolEnabled": false,
 *     "flushInterval": 30,
 *     "maxAuditSizeToSave": 50,
 *     "transports": {
 *       "rest": { "enabled": false },
 *       "ga4": {
 *         "enabled": true,
 *         "measurementId": "G-XXXXXXXXXX"
 *       }
 *     }
 *   }
 * }
 *
 * @example
 * // localConfig.json — REST + GA4 in parallel
 * {
 *   "auditing": {
 *     "enabled": true,
 *     "transports": {
 *       "rest": { "enabled": true },
 *       "ga4": { "enabled": true, "measurementId": "G-XXXXXXXXXX" }
 *     }
 *   }
 * }
 *
 * @prop {boolean}  auditing.enabled                      Master on/off switch. Default: `false`.
 * @prop {boolean}  auditing.auditDevToolEnabled           Show in-browser event inspector panel. For development only; set `false` in production. Default: `false`.
 * @prop {number}   auditing.flushInterval                 Seconds between automatic buffer flushes. Default: `30`.
 * @prop {number}   auditing.maxAuditSizeToSave            Flush immediately when buffer reaches this size. Default: `50`.
 * @prop {Object}   auditing.transports                    Transport configuration block.
 * @prop {Object}   auditing.transports.rest               REST transport options.
 * @prop {boolean}  auditing.transports.rest.enabled       Send events to `POST /rest/audit`. When `false`, the backend health check is skipped and the plugin activates from local config alone. Default: `true`.
 * @prop {Object}   auditing.transports.ga4                GA4 transport options.
 * @prop {boolean}  auditing.transports.ga4.enabled        Send events to Google Analytics 4 via dynamically loaded `gtag.js`. Default: `false`.
 * @prop {string}   auditing.transports.ga4.measurementId  GA4 Measurement ID (format: `G-XXXXXXXXXX`). Required when `ga4.enabled` is `true`.
 */


// Create the audit plugin
const AuditPlugin = createPlugin('Auditing', {
    // UI component for testing - includes temporary devtool
    component: AuditDevtool,

    // Redux reducer for audit state management
    reducers: {
        audit: auditReducer
    },
    // Redux-Observable epics for side effects
    epics: auditEpics
});

export default AuditPlugin;
