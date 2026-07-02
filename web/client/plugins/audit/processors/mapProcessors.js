/**
 * Map click audit processors
 * Handles LOAD_FEATURE_INFO action to generate audit events for map clicks
 * Supports two types of events:
 * - MAP_CLICK: Single event with just coordinates
 * - MAP_CLICK_RESULT: One event per layer that returned features (vector, WMS, WFS)
 */

import { getLayerUrl } from '../../../utils/LayersUtils';

/**
 * Process CLICK_ON_MAP action to extract MAP_CLICK audit data
 * Generates a single audit event with just the click coordinates
 *
 * @param {Object} action - The CLICK_ON_MAP action
 * @returns {Array} Array with single audit event containing coordinates
 */
export const processMapClickAdditionalData = (action) => {
    // Get click point from action
    const point = action.point;

    if (!point?.latlng) {
        return [];
    }

    const lat = point.latlng.lat;
    const lon = point.latlng.lng;

    // Validate coordinates
    if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) {
        return [];
    }

    // Return single event with just coordinates
    return [{
        lat: lat,
        lon: lon
    }];
};

/**
 * Process LOAD_FEATURE_INFO action to extract MAP_CLICK_RESULT audit data
 * Generates one audit event per layer that returned features at the click location
 * Handles layers without URLs gracefully by filtering them out
 *
 * This processor is triggered when ALL GetFeatureInfo queries are complete,
 * ensuring we capture both client-side vector layers and server-side WMS/WFS layers
 *
 * @param {Object} action - The LOAD_FEATURE_INFO action
 * @param {Object} state - Redux state
 * @returns {Array} Array of audit events (one per layer with features)
 */
export const processMapClickResultAdditionalData = (_, state) => {
    // Get click point from mapInfo state
    const clickPoint = state.mapInfo?.clickPoint;

    if (!clickPoint?.latlng) {
        return [];
    }

    const lat = clickPoint.latlng.lat;
    const lon = clickPoint.latlng.lng;

    // Validate coordinates
    if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) {
        return [];
    }

    // Get ALL responses from mapInfo state
    // This includes responses from ALL layers (vector, WMS, WFS) that were queried
    const responses = state.mapInfo?.responses || [];

    if (responses.length === 0) {
        return [];
    }

    // Generate one audit event per layer that has features
    return responses
        .filter(response => {
            // Check if response has features
            const hasFeatures = response.layerMetadata?.features?.length > 0;

            if (!hasFeatures || !response.layer) {
                return false;
            }

            return true;
        })
        .map(response => {
            const layer = response.layer;
            const layerUrl = getLayerUrl(layer) || null;
            const layerName = layer.name || layer.title || null;

            return {
                layerUrl,
                layerName,
                lat: lat,
                lon: lon
            };
        });
};
