/**
 * Audit Event Filtering Utility
 *
 * Provides a rule-based filtering system for audit events.
 * Rules are evaluated top-down, first matching rule wins.
 *
 * Rule format:
 * {
 *   eventType: "EVENT_TYPE",      // Optional: event type to match
 *   attributes: {                 // Optional: attribute filters (all must match)
 *     attributeName: ["value1", "value2"]
 *   },
 *   decision: "accept" | "drop"   // Required: accept or drop
 * }
 */

/**
 * Checks if an event matches a filter rule
 * @param {Object} event - The audit event
 * @param {Object} rule - The filter rule
 * @returns {boolean} true if event matches rule
 */
export const matches = (event, rule) => {
    if (rule.eventType && rule.eventType !== event.eventType) return false;
    if (rule.attributes) {
        return Object.entries(rule.attributes).every(
            ([k, vals]) => vals.includes(event[k])
        );
    }
    return true;
};

/**
 * Determines if an event should be sent based on filter rules
 * Checks both eventType and attributes
 * @param {Object} event - The audit event
 * @param {Array} rules - Array of filter rules
 * @returns {boolean} true if event should be sent
 */
export const shouldSend = (event, rules) => {
    for (const r of rules) {
        if (matches(event, r)) return r.decision === "accept";
    }
    return true; // default accept
};
