/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { FormGroup, ControlLabel, InputGroup, FormControl, Checkbox } from 'react-bootstrap';
import Select from 'react-select';
import Message from '../../../../I18N/Message';
import { useLocalizedOptions } from './hooks/useLocalizedOptions';
import { RANGE_VARIANTS, RANGE_ENDS, RANGE_STEP_UNITS } from '../../../../../utils/FilterRangeUtils';

const VARIANT_OPTIONS = [
    { value: RANGE_VARIANTS.FIELDS, label: 'Fields', labelKey: 'widgets.filterWidget.rangeFields' },
    { value: RANGE_VARIANTS.SLIDER, label: 'Slider', labelKey: 'widgets.filterWidget.rangeSlider' }
];
const ENDS_OPTIONS = [
    { value: RANGE_ENDS.BOTH, label: 'From - to', labelKey: 'widgets.filterWidget.rangeEndsBoth' },
    { value: RANGE_ENDS.MIN, label: 'From only', labelKey: 'widgets.filterWidget.rangeEndsMin' },
    { value: RANGE_ENDS.MAX, label: 'Up to only', labelKey: 'widgets.filterWidget.rangeEndsMax' }
];
const STEP_UNIT_OPTIONS = [
    { value: RANGE_STEP_UNITS.DAY, label: 'Day', labelKey: 'widgets.filterWidget.rangeStepDay' },
    { value: RANGE_STEP_UNITS.MONTH, label: 'Month', labelKey: 'widgets.filterWidget.rangeStepMonth' },
    { value: RANGE_STEP_UNITS.YEAR, label: 'Year', labelKey: 'widgets.filterWidget.rangeStepYear' }
];

const LocalizedSelect = ({ options, value, onChange }) => {
    const { localizedOptions, localizedSelectedOption } = useLocalizedOptions(options, options.find(option => option.value === value));
    return (
        <InputGroup>
            <Select clearable={false} value={localizedSelectedOption} options={localizedOptions} onChange={(option) => onChange(option?.value)} />
        </InputGroup>
    );
};

/**
 * Layout options of an interval filter: fields or slider, ends shown and step.
 * Options that change the possible values clear the selection, so a stale interval is never applied.
 */
const RangeLayoutOptions = ({ layout = {}, isDate, onChange = () => {}, onClearSelection = () => {} }) => {
    const changeAndClear = (key) => (value) => {
        onChange(key, value);
        onClearSelection();
    };
    return (
        <>
            <FormGroup className="form-group-flex">
                <ControlLabel><Message msgId="widgets.filterWidget.variant" /></ControlLabel>
                <LocalizedSelect options={VARIANT_OPTIONS} value={layout.variant} onChange={(value) => onChange('layout.variant', value)} />
            </FormGroup>
            <FormGroup className="form-group-flex">
                <ControlLabel><Message msgId="widgets.filterWidget.rangeEnds" /></ControlLabel>
                <LocalizedSelect options={ENDS_OPTIONS} value={layout.rangeEnds ?? RANGE_ENDS.BOTH} onChange={changeAndClear('layout.rangeEnds')} />
            </FormGroup>
            <FormGroup className="form-group-flex">
                <ControlLabel><Message msgId="widgets.filterWidget.rangeStep" /></ControlLabel>
                {isDate
                    ? <LocalizedSelect options={STEP_UNIT_OPTIONS} value={layout.stepUnit ?? RANGE_STEP_UNITS.DAY} onChange={changeAndClear('layout.stepUnit')} />
                    : <InputGroup>
                        <FormControl
                            type="number"
                            min={0}
                            step="any"
                            value={layout.step ?? ''}
                            onChange={(e) => changeAndClear('layout.step')(e.target.value === '' ? undefined : Number(e.target.value))}
                        />
                    </InputGroup>}
            </FormGroup>
            {layout.variant === RANGE_VARIANTS.SLIDER && (
                <FormGroup className="form-group-flex">
                    <ControlLabel><Message msgId="widgets.filterWidget.rangeShowInputs" /></ControlLabel>
                    <Checkbox checked={!!layout.showInputs} onChange={() => onChange('layout.showInputs', !layout.showInputs)} />
                </FormGroup>
            )}
        </>
    );
};

RangeLayoutOptions.propTypes = {
    layout: PropTypes.object,
    isDate: PropTypes.bool,
    onChange: PropTypes.func,
    onClearSelection: PropTypes.func
};

export default RangeLayoutOptions;
