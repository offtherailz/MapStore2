/**
 * Selectors for accessing audit state
 */

/**
 * Get the entire audit state
 * @param {object} state - Redux state
 * @returns {object} Audit state
 */
export const getAuditState = (state) => state.audit || {};

/**
 * Get the audit configuration
 * @param {object} state - Redux state
 * @returns {object} Audit configuration object
 */
export const getAuditConfig = (state) => getAuditState(state).config || {};

/**
 * Get pending audit events
 * @param {object} state - Redux state
 * @returns {Array} Array of pending audit events
 */
export const getPendingEvents = (state) => getAuditState(state).pendingEvents || [];

/**
 * Check if auditing is enabled
 * @param {object} state - Redux state
 * @returns {boolean} True if auditing is enabled
 */
export const isAuditEnabled = (state) => getAuditConfig(state).enabled === true;

/**
 * Get the flush interval in milliseconds
 * @param {object} state - Redux state
 * @returns {number|undefined} Flush interval in milliseconds
 */
export const getFlushInterval = (state) => getAuditConfig(state).flushInterval;

/**
 * Get the maximum audit size before flushing
 * @param {object} state - Redux state
 * @returns {number|undefined} Maximum audit size
 */
export const getMaxAuditSize = (state) => getAuditConfig(state).maxAuditSizeToSave;

/**
 * Is devtool enabled
 * @param {object} state - Redux state
 * @returns {boolean} True if devtool is enabled
 */
export const isAuditDevtoolEnabled = (state) => getAuditConfig(state).auditDevToolEnabled === true;

/**
 * Get audit filter rules
 * @param {object} state - Redux state
 * @returns {Array} Array of filter rules
 */
export const getFilterRules = (state) => getAuditConfig(state).filterRules || [];

/**
 * Get GA4 transport configuration
 * @param {object} state - Redux state
 * @returns {object|null} GA4 config {enabled, measurementId} or null
 */
export const getGa4Config = (state) => getAuditConfig(state).transports?.ga4 || null;
