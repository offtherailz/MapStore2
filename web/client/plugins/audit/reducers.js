import {
    RECORD_AUDIT,
    FLUSH_AUDIT_BUFFER,
    AUDIT_SEND_SUCCESS,
    AUDIT_CONFIG_LOADED
} from './actions';

// Initial state
const initialState = {
    pendingEvents: [],
    config: null,
    lastFlushTime: null,
    totalEventsSent: 0
};

/**
 * Audit reducer
 * @param {Object} state - Current state
 * @param {Object} action - Redux action
 * @returns {Object} New state
 */
const auditReducer = (state = initialState, action) => {
    switch (action.type) {
    case RECORD_AUDIT:
        return {
            ...state,
            pendingEvents: [...state.pendingEvents, {
                eventType: action.eventType,
                timestamp: action.timestamp,
                ...action.data
            }]
        };

    case FLUSH_AUDIT_BUFFER:
        return {
            ...state,
            pendingEvents: [],
            lastFlushTime: action.timestamp
        };

    case AUDIT_SEND_SUCCESS:
        return {
            ...state,
            lastError: null,
            totalEventsSent: state.totalEventsSent + action.count
        };

    case AUDIT_CONFIG_LOADED:
        return {
            ...state,
            config: action.config
        };

    default:
        return state;
    }
};

export default auditReducer;
