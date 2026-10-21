/*
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createSelector } from 'reselect';

import { isFeatureGridOpen } from './featuregrid';
import { getSelectedLayer } from './layers';
import { wfsFilter } from './query';
import { composeFilterObject } from '../components/widgets/enhancers/utils';

import { getTableWidgets, getFloatingWidgets, getMapWidgets } from './widgets';
import { getWFSLayerName } from '../utils/LayersUtils';
import { getAttributesNames } from '../utils/FeatureGridUtils';
import { getWidgetDependency } from '../utils/WidgetsUtils';

export const layerDownloadControlEnabledSelector = state => state?.controls?.layerdownload?.enabled;
export const downloadOptionsSelector = state => state?.layerdownload?.downloadOptions;
export const loadingSelector = state => state?.layerdownload?.loading;
export const checkingWPSAvailabilitySelector = state => state?.layerdownload?.checkingWPSAvailability;
export const wfsFormatsSelector = state => state?.layerdownload?.wfsFormats;
export const formatsLoadingSelector = state => state?.layerdownload?.formatsLoading;
export const wpsAvailableSelector = state => state?.layerdownload?.wpsAvailable;
export const serviceSelector = state => state?.layerdownload?.service;

export const downloadLayerSelector = state => state?.layerdownload?.downloadLayer;

export const wfsFilterSelector = createSelector(
    isFeatureGridOpen,
    wfsFilter,
    getSelectedLayer,
    downloadLayerSelector,
    getTableWidgets,
    (
        featureGridOpen,
        wfsFilterObj,
        mapLayer,
        downloadLayer,
        tableWidgets
    ) => {
        const selectedLayer = mapLayer || downloadLayer;
        const widget = tableWidgets.filter(w => w.id === downloadLayer?.widgetId)[0];
        const options = widget?.options;
        const typeName = getWFSLayerName(selectedLayer);
        const defaultFilter = typeName ? { featureTypeName: typeName, filterType: 'OGC', ogcVersion: '1.1.0' } : null;
        let updatedFilter = widget?.filter;
        if (widget?.quickFilters) {
            updatedFilter = composeFilterObject(widget.filter || defaultFilter, widget.quickFilters, options);
        }
        // The rows of the table also depend on the filters applied to it by other widgets, e.g. a dynamic filter.
        if (widget?.interactionFilters?.length) {
            const base = updatedFilter || defaultFilter;
            updatedFilter = { ...base, filters: [...(base?.filters || []), ...widget.interactionFilters] };
        }
        return featureGridOpen ? wfsFilterObj || updatedFilter : typeName ? updatedFilter || defaultFilter : null;
    }
);
export const exportDataResultsControlEnabledSelector = state => state?.controls?.exportDataResults?.enabled;
export const exportDataResultsSelector = state => state?.layerdownload?.results;
export const checkingExportDataEntriesSelector = state => state?.layerdownload?.checkingExportDataEntries;

/**
 * Returns the attributes shown by the table widget that started the download, so the export matches the table.
 * Returns `null` when the download does not come from a table widget.
 */
export const widgetDownloadPropertyNamesSelector = createSelector(
    getSelectedLayer,
    downloadLayerSelector,
    getTableWidgets,
    (mapLayer, downloadLayer, tableWidgets) => {
        const widget = !mapLayer && downloadLayer?.widgetId && tableWidgets.find(w => w.id === downloadLayer.widgetId);
        const propertyNames = widget && getAttributesNames(widget.options?.propertyName);
        if (!propertyNames?.length) {
            return null;
        }
        return propertyNames.filter(name => !widget.options?.columnSettings?.[name]?.hide);
    }
);

/**
 * Returns the viewport of the map the table widget that started the download is synchronized with,
 * so the export contains only the rows the table shows. Returns `null` otherwise.
 */
export const widgetDownloadViewportSelector = createSelector(
    getSelectedLayer,
    downloadLayerSelector,
    getFloatingWidgets,
    getMapWidgets,
    (mapLayer, downloadLayer, floatingWidgets = [], mapWidgets) => {
        const widget = !mapLayer && downloadLayer?.widgetId && floatingWidgets.find(w => w.id === downloadLayer.widgetId);
        const viewportPath = widget?.mapSync && widget?.dependenciesMap?.viewport;
        const viewport = viewportPath && getWidgetDependency(viewportPath, floatingWidgets, mapWidgets);
        return viewport?.bounds ? viewport : null;
    }
);
