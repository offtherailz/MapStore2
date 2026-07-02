/**
 * Search-related audit processors
 * Handles both TEXT_SEARCH_STARTED and TEXT_SEARCH_ITEM_SELECTED actions
 */

import { get } from 'lodash';
import pointOnSurface from '@turf/point-on-surface';
import { generateTemplateString } from '../../../utils/TemplateUtils';

/**
 * Utility function to format service name
 * @param {Object} service - Service object with name and/or type
 * @returns {string} Formatted service name
 */
const getServiceName = (service) => {
    return service?.name || service?.type;
};

/**
 * Process TEXT_SEARCH_STARTED action to extract additional audit data
 * Returns array of events with action-specific data
 * @param {Object} action - The TEXT_SEARCH_STARTED action
 * @returns {Array} Array of audit events with search-specific data
 */
export const processSearchAdditionalData = (action) => {
    const { searchText } = action;
    return [{ searchText }];
};

/**
 * Process TEXT_SEARCH_ITEM_SELECTED action to extract additional audit data
 * Returns array of events with action-specific data for search click events
 * @param {Object} action - The TEXT_SEARCH_ITEM_SELECTED action
 * @param {Object} state - Redux state (unused for this processor)
 * @returns {Array} Array of audit events with search click-specific data
 */
export const processSearchClickAdditionalData = (action) => {
    const { item, service } = action;

    if (!item) {
        return [];
    }
    const coord = pointOnSurface(item)?.geometry?.coordinates;
    const lon = coord[0];
    const lat = coord[1];

    const itemService = service || item.__SERVICE__ || {};
    const displayName = itemService.displayName || "properties.display_name";
    const title = get(item, displayName) || generateTemplateString(displayName || "")(item) || '';

    const serviceName = getServiceName(itemService);

    // Build the audit data object
    const auditData = {
        service: serviceName
    };

    // Only include coordinates if they exist
    if (lat !== undefined && !isNaN(lat)) {
        auditData.lat = lat;
    }
    if (lon !== undefined && !isNaN(lon)) {
        auditData.lon = lon;
    }

    // Only include title if it exists
    if (title) {
        auditData.title = title;
    }

    return [auditData];
};
