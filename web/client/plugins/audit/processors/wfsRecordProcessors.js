/**
 * WFS Edit audit processors for SAVE_SUCCESS and DELETE_SELECTED_FEATURES
 */

import { getLayerUrl } from '../../../utils/LayersUtils';
import {
    selectedLayerSelector,
    selectedFeaturesSelector,
    newFeaturesSelector,
    changesMapSelector
} from '../../../selectors/featuregrid';

/**
 * RECORD_DELETE processor - generates one event per selected feature
 */
export const processRecordDeleteAdditionalData = (action, state) => {
    const layer = selectedLayerSelector(state);
    const selectedFeatures = selectedFeaturesSelector(state) || [];

    if (!layer || selectedFeatures.length === 0) {
        return [];
    }

    const layerUrl = getLayerUrl(layer) || null;
    const layerName = layer.name || null;

    return selectedFeatures.map(feature => ({
        layerUrl,
        layerName,
        recordId: feature.id || null
    }));
};

/**
 * RECORD_CREATION processor - generates one event per new feature
 */
export const processRecordCreationFromSaveSuccess = (action, state) => {
    const layer = selectedLayerSelector(state);

    if (!layer) {
        return [];
    }

    const layerUrl = getLayerUrl(layer) || null;
    const layerName = layer.name || null;
    const newFeatures = newFeaturesSelector(state) || [];

    return newFeatures.map(() => ({
        layerUrl,
        layerName
    }));
};

/**
 * RECORD_UPDATE processor - generates one event per modified feature (includes recordId)
 */
export const processRecordUpdateFromSaveSuccess = (action, state) => {
    const layer = selectedLayerSelector(state);

    if (!layer) {
        return [];
    }

    const layerUrl = getLayerUrl(layer) || null;
    const layerName = layer.name || null;
    const changesMap = changesMapSelector(state) || {};

    return Object.keys(changesMap)
        .filter(featureId => changesMap[featureId] && Object.keys(changesMap[featureId]).length > 0)
        .map(featureId => ({
            layerUrl,
            layerName,
            recordId: featureId
        }));
};
