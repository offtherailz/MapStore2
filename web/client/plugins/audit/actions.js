// Action Types
export const RECORD_AUDIT = 'AUDIT:RECORD_AUDIT';
export const FLUSH_AUDIT_BUFFER = 'AUDIT:FLUSH_AUDIT_BUFFER';
export const AUDIT_SEND_SUCCESS = 'AUDIT:AUDIT_SEND_SUCCESS';
export const AUDIT_CONFIG_LOADED = 'AUDIT:AUDIT_CONFIG_LOADED';

// Action Creators

/**
 * Records an audit event
 * @param {string} eventType - The type of event (e.g., 'LOGIN', 'SEARCH', etc.)
 * @param {Object} data - Additional data for the audit event
 * @returns {Object} Redux action
 */
export const recordAudit = (eventType, data) => ({
    type: RECORD_AUDIT,
    eventType,
    data,
    timestamp: new Date().toISOString()
});

/**
 * Flushes the audit buffer (sends all pending events to API)
 * @param {Array} events - Optional array of events to flush
 * @returns {Object} Redux action
 */
export const flushAuditBuffer = (events = null) => ({
    type: FLUSH_AUDIT_BUFFER,
    events,
    timestamp: new Date().toISOString()
});

/**
 * Indicates successful sending of audit data to API
 * @param {number} count - Number of events sent
 * @returns {Object} Redux action
 */
export const auditSendSuccess = (count) => ({
    type: AUDIT_SEND_SUCCESS,
    count
});

/**
 * Loads audit configuration
 * @param {Object} config - Audit configuration object
 * @returns {Object} Redux action
 */
export const auditConfigLoaded = (config) => ({
    type: AUDIT_CONFIG_LOADED,
    config
});


