import axios from "../../../libs/ajax";
import { auditKeysParser } from '../utils/auditDataHelper';
import { AUDIT_ACTIONS_REGISTRY } from '../registry/auditActionsRegistry';

// TODO: only for devtools for now.
let savedAudits = [];

/**
 * Checks if the audit API is active.
 * @returns {Promise<object>} Promise that resolves to true if audit API is active
 */
export const checkAuditActive = () => {
    return axios.get('rest/audit').then((response) => {
        return {
            active: response?.data?.active
        };
    }).catch((e) => {
        console.error('Audit API check failed', e);
        return {
            active: false,
            reason: "error",
            detail: e.message
        };
    });
};
/**
 * Sends audit data to the API
 * Converts client-side field names to database column names before sending
 * @param {Array} auditData - Array of audit events to send (in client format)
 * @param {Object} config - Optional configuration
 * @returns {Promise} Promise that resolves with API response
 */
export const sendAuditData = (auditData, {debug} = {}) => {
    // Validate input
    if (!Array.isArray(auditData) || auditData.length === 0) {
        throw new Error('Invalid audit data: must be a non-empty array');
    }

    // Convert client format to database format
    const dbFormattedData = auditData.map(event => {
        // Find the keysMap for this event type
        const registryEntry = AUDIT_ACTIONS_REGISTRY
            .find(entry => entry.eventType === event.eventType);

        const keysMap = registryEntry?.keysMap || {};

        // Convert client fields to database keys
        return auditKeysParser(event, keysMap, false);
    });

    return new Promise((resolve, reject) => {
        axios.post('rest/audit', dbFormattedData).then(() => {
            // Simulate successful response
            const response = {
                success: true,
                count: dbFormattedData.length,
                timestamp: new Date().toISOString(),
                message: `Successfully processed ${dbFormattedData.length} audit events`,
                totalSaved: savedAudits.length,
                savedAudits: savedAudits
            };
            if (debug) {
                savedAudits = savedAudits.concat(dbFormattedData); // for devtools only
            }
            resolve(response);
        }).catch((error) => {
            reject(new Error(`API error: ${error.message}`));
        });
    });
};


/**
 * Gets all saved audit data
 * @returns {Array} Array of all saved audit events
 */
export const getSavedAudits = () => {
    return savedAudits;
};
