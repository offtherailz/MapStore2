/**
 * Feature Grid (Attribute Table) audit processors
 * Handles ATTRIBUTE_TABLE_OPEN and ATTRIBUTE_TABLE_SEARCH events
 */

/**
 * Process FEATUREGRID:SET_LAYER action to extract additional audit data
 * Returns array of events with action-specific data for attribute table open events
 * @param {Object} action - The SET_LAYER action containing layer id
 * @param {Object} state - Redux state
 * @returns {Array} Array of audit events with layer-specific data
 */
export const processAttributeTableOpenAdditionalData = (action, state) => {
    const layerId = action.id;

    if (!layerId) {
        return [];
    }

    const layers = state.layers?.flat || [];
    const layer = layers.find(l => l.id === layerId);

    if (!layer) {
        return [];
    }

    return [{
        layerUrl: layer.url || '',
        layerName: layer.name || ''
    }];
};

/**
 * Process QUERY:UPDATE_FILTER action to extract additional audit data
 * Returns array of events with action-specific data for attribute table search events
 * This action fires when user types in column filter inputs
 * @param {Object} action - The UPDATE_FILTER action containing filter update
 * @param {Object} state - Redux state
 * @returns {Array} Array of audit events with search-specific data
 */
export const processAttributeTableSearchAdditionalData = (action, state) => {
    const selectedLayerId = state.featuregrid?.selectedLayer;

    if (!selectedLayerId) {
        return [];
    }

    const layers = state.layers?.flat || [];
    const layer = layers.find(l => l.id === selectedLayerId);

    if (!layer) {
        return [];
    }

    // Extract filter data from action.update
    const update = action.update || {};
    const attribute = update.attribute;
    const value = update.value;
    const operator = update.operator;

    // Only create audit if we have both attribute and value
    if (!attribute || value === undefined || value === null || value === '') {
        return [];
    }

    return [{
        layerUrl: layer.url || null,
        layerName: layer.name || null,
        attributeName: attribute,
        attributeValue: String(value),
        operator: operator
    }];
};
