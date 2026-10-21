/*
 * Copyright 2025, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React, { useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import UserDefinedValuesDataGrid from '../UserDefinedValuesDataGrid';
import { useFilterData } from './hooks/useFilterData';
import { useLayerAttributes } from './hooks/useLayerAttributes';
import { useAttributeSync } from './hooks/useAttributeSync';
import DataSourceSelector from './components/DataSourceSelector';
import UserDefinedTypeSelector from './components/UserDefinedTypeSelector';
import LayerSelectorField from './components/LayerSelectorField';
import ValuesFromSelector from './components/ValuesFromSelector';
import FilterAttributesSection from './components/FilterAttributesSection';
import MaxFeaturesInput from './components/MaxFeaturesInput';
import FilterCompositionSelector from './components/FilterCompositionSelector';
import FilterSelectionModeSelector from './components/FilterSelectionModeSelector';
import RangeBoundsSelector from './components/RangeBoundsSelector';
import { VALUES_FROM_TYPES, USER_DEFINED_TYPES } from './constants';
import { isFilterValid } from '../../../../../../utils/FilterUtils';
import { RANGE_VARIANTS, RANGE_SELECTION_MODE, isRangeAttributeType } from '../../../../../../utils/FilterRangeUtils';

const getMissingAttributeTypeUpdates = ({
    attributeOptions = [],
    valueAttribute,
    valueAttributeType,
    labelAttribute,
    labelAttributeType
}) => {
    const updates = [];

    if (valueAttribute && !valueAttributeType) {
        const valueAttributeOption = attributeOptions.find(option =>
            option?.value === valueAttribute
        );
        if (valueAttributeOption?.type) {
            updates.push(['data.valueAttributeType', valueAttributeOption.type]);
        }
    }

    if (labelAttribute && !labelAttributeType) {
        const labelAttributeOption = attributeOptions.find(option =>
            option?.value === labelAttribute
        );
        if (labelAttributeOption?.type) {
            updates.push(['data.labelAttributeType', labelAttributeOption.type]);
        }
    }

    return updates;
};

const FilterDataTab = ({
    data = {},
    onChange: onChangeProp = () => {},
    onOpenLayerSelector = () => {},
    openFilterEditor,
    onEditorChange = () => {},
    dashBoardEditing,
    selections = {},
    interactions = [],
    globalWidgetMode = false,
    locale
}) => {
    // Normalize and derive filter data
    const filterDataState = useFilterData(data);

    // Fetch attributes from WFS
    const {
        attributeOptions,
        isLoading: attributesLoading,
        error: attributesError
    } = useLayerAttributes(
        filterDataState.selectedLayerObject,
        filterDataState.hasLayerSelection
    );

    // Enhanced onChange handler with auto-sync
    const onChange = useAttributeSync(data, onChangeProp, onEditorChange, selections, interactions);

    // Backward compatibility: Back fill missing attribute types for older saved filters
    useEffect(() => {
        if (!attributeOptions?.length) {
            return;
        }

        getMissingAttributeTypeUpdates({
            attributeOptions,
            valueAttribute: filterDataState.valueAttribute,
            valueAttributeType: filterDataState.valueAttributeType,
            labelAttribute: filterDataState.labelAttribute,
            labelAttributeType: filterDataState.labelAttributeType
        }).forEach(([key, value]) => {
            onChangeProp(key, value);
        });
    }, [
        attributeOptions,
        filterDataState.valueAttribute,
        filterDataState.valueAttributeType,
        filterDataState.labelAttribute,
        filterDataState.labelAttributeType,
        onChangeProp
    ]);

    // Generic handler factory for simple onChange handlers
    const createChangeHandler = (key) => (value) => {
        onChange(key, value);
    };

    // Handlers
    const handleDataSourceChange = (nextSource) => {
        onChange('data.dataSource', nextSource);
        // Clear items when dataSource changes
        onChange('items', []);
    };

    const isRange = filterDataState.valuesFrom === VALUES_FROM_TYPES.RANGE;
    const valueAttributeOptions = isRange
        ? (attributeOptions || []).filter(option => isRangeAttributeType(option?.type))
        : attributeOptions;

    const handleValuesFromChange = (nextValue) => {
        if (nextValue === filterDataState.valuesFrom) {
            return;
        }
        onChange('data.valuesFrom', nextValue);
        // Clear labelAttribute when switching to grouped mode
        if (nextValue === VALUES_FROM_TYPES.GROUPED || nextValue === VALUES_FROM_TYPES.RANGE) {
            onChange('data.labelAttribute', undefined);
        }
        if (nextValue === VALUES_FROM_TYPES.RANGE) {
            if (!isRangeAttributeType(filterDataState.valueAttributeType)) {
                onChange('data.valueAttribute', undefined);
                onChange('data.valueAttributeType', undefined);
            }
            onChange('layout.variant', RANGE_VARIANTS.SLIDER);
            onChange('layout.selectionMode', RANGE_SELECTION_MODE);
        } else if (isRange) {
            onChange('layout.variant', 'checkbox');
            onChange('layout.selectionMode', 'multiple');
        }
    };

    const handleUserDefinedItemsChange = (items) => {
        onChange('data.userDefinedItems', items);
    };

    const handleEditUserDefinedItemFilter = useCallback((itemId) => {
        onEditorChange('editingDefaultFilter', false);
        onEditorChange('editingUserDefinedItemId', itemId);
        setTimeout(() => {
            openFilterEditor();
        }, 0);
    }, [onEditorChange, openFilterEditor]);

    const handleEditUserDefinedItemStyle = useCallback((itemId) => {
        // Store which user-defined item is being edited (for any additional handling if needed)
        onEditorChange('editingUserDefinedItemId', itemId);
    }, [onEditorChange]);

    // Generic handlers using the factory function
    const handleValueAttributeChange = useCallback((option) => {
        onChange('data.valueAttribute', option?.value);
        onChange('data.valueAttributeType', option?.type);
        if (!filterDataState.labelAttribute) {
            onChange('data.labelAttributeType', option?.type);
        }
    }, [onChange, filterDataState.labelAttribute]);
    const handleLabelAttributeChange = useCallback((option) => {
        onChange('data.labelAttribute', option?.value);
        onChange('data.labelAttributeType', option?.type);
    }, [onChange]);
    const handleSortByAttributeChange = createChangeHandler('data.sortByAttribute');
    const handleSortOrderChange = createChangeHandler('data.sortOrder');
    const handleMaxFeaturesChange = createChangeHandler('data.maxFeatures');
    const handleFilterCompositionChange = createChangeHandler('data.filterComposition');
    const handleNoSelectionModeChange = createChangeHandler('data.noSelectionMode');
    const handleUserDefinedTypeChange = useCallback((value) => {
        onChange('data.userDefinedType', value);
        // Clear userDefinedItems when type changes
        onChange('data.userDefinedItems', []);
        // Force selectionMode to single when Style List is selected
        if (value === USER_DEFINED_TYPES.STYLE_LIST) {
            onChange('layout.selectionMode', 'single');
        }
    }, [onChange]);

    const handleEditDefaultFilter = useCallback(() => {
        onEditorChange('editingUserDefinedItemId', null);
        onEditorChange('editingDefaultFilter', true);
        setTimeout(() => {
            openFilterEditor();
        }, 0);
    }, [onEditorChange, openFilterEditor]);

    return (
        <div className="ms-filter-wizard-data-tab">
            <DataSourceSelector
                value={filterDataState.dataSource}
                onChange={handleDataSourceChange}
            />

            {filterDataState.isUserDefined && (
                <UserDefinedTypeSelector
                    value={filterDataState.userDefinedType}
                    onChange={handleUserDefinedTypeChange}
                    selectedLayer={filterDataState.selectedLayerObject}
                />
            )}

            <LayerSelectorField
                onFilterLayer={() => {
                    openFilterEditor();
                }}
                layer={filterDataState.selectedLayerObject}
                layerIsRequired={filterDataState.layerIsRequired}
                onOpenLayerSelector={onOpenLayerSelector}
                dashBoardEditing={dashBoardEditing}
                globalWidgetMode={globalWidgetMode}
                hideFilter={filterDataState.isUserDefined}
            />

            {filterDataState.isFeaturesSource && (
                <>
                    <ValuesFromSelector
                        value={filterDataState.valuesFrom}
                        onChange={handleValuesFromChange}
                    />

                    <FilterAttributesSection
                        valuesFrom={filterDataState.valuesFrom}
                        valueAttribute={filterDataState.valueAttribute}
                        labelAttribute={filterDataState.labelAttribute}
                        sortByAttribute={filterDataState.sortByAttribute}
                        sortOrder={filterDataState.sortOrder}
                        attributeOptions={valueAttributeOptions}
                        isLoading={attributesLoading}
                        hasLayerSelection={filterDataState.hasLayerSelection}
                        error={attributesError}
                        onValueAttributeChange={handleValueAttributeChange}
                        onLabelAttributeChange={handleLabelAttributeChange}
                        onSortByAttributeChange={handleSortByAttributeChange}
                        onSortOrderChange={handleSortOrderChange}
                        attributeFormats={filterDataState.filterData?.attributeFormats}
                        onAttributeFormatChange={(name, format) => onChange('data.attributeFormats', { ...filterDataState.filterData?.attributeFormats, [name]: format })}
                        locale={locale}
                    />

                    {isRange
                        ? <RangeBoundsSelector
                            value={filterDataState.filterData?.range}
                            attributeType={filterDataState.valueAttributeType}
                            onChange={createChangeHandler('data.range')}
                        />
                        : <MaxFeaturesInput
                            value={filterDataState.maxFeaturesValue}
                            onChange={handleMaxFeaturesChange}
                        />}
                </>
            )}

            {filterDataState.isUserDefined && (
                <UserDefinedValuesDataGrid
                    items={filterDataState.userDefinedItems}
                    onChange={handleUserDefinedItemsChange}
                    onEditFilter={handleEditUserDefinedItemFilter}
                    onEditStyle={handleEditUserDefinedItemStyle}
                    userDefinedType={filterDataState.userDefinedType}
                    layer={filterDataState.selectedLayerObject}
                />
            )}

            {filterDataState.userDefinedType !== USER_DEFINED_TYPES.STYLE_LIST && (
                <>
                    {!isRange && <FilterCompositionSelector
                        value={filterDataState.filterComposition}
                        onChange={handleFilterCompositionChange}
                    />}

                    <FilterSelectionModeSelector
                        value={filterDataState.noSelectionMode}
                        onChange={handleNoSelectionModeChange}
                        defaultFilter={filterDataState?.defaultFilter}
                        onDefineFilter={handleEditDefaultFilter}
                        isFilterValid={isFilterValid}
                    />
                </>
            )}
        </div>
    );
};

FilterDataTab.propTypes = {
    data: PropTypes.object,
    onChange: PropTypes.func,
    onOpenLayerSelector: PropTypes.func,
    openFilterEditor: PropTypes.func,
    onEditorChange: PropTypes.func,
    dashBoardEditing: PropTypes.bool,
    interactions: PropTypes.array,
    globalWidgetMode: PropTypes.bool,
    locale: PropTypes.string
};

export default FilterDataTab;
