/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { FormGroup, ControlLabel, InputGroup, FormControl, HelpBlock } from 'react-bootstrap';
import Select from 'react-select';
import Message from '../../../../../../I18N/Message';
import { useLocalizedOptions } from '../../hooks/useLocalizedOptions';
import { RANGE_BOUNDS_OPTIONS, RANGE_BOUNDS_TYPES } from '../constants';
import { isRangeDateType } from '../../../../../../../utils/FilterRangeUtils';

/**
 * Bounds of an interval filter: read from the layer, or set by the author.
 * @prop {object} value `{ bounds, min, max }`
 * @prop {string} attributeType type of the value attribute, to pick date or number inputs
 * @prop {function} onChange called with the new bounds configuration
 */
const RangeBoundsSelector = ({ value = {}, attributeType, onChange = () => {} }) => {
    const bounds = value.bounds ?? RANGE_BOUNDS_TYPES.AUTO;
    const { localizedOptions, localizedSelectedOption } = useLocalizedOptions(
        RANGE_BOUNDS_OPTIONS,
        RANGE_BOUNDS_OPTIONS.find(option => option.value === bounds)
    );
    const inputType = isRangeDateType(attributeType) ? 'date' : 'number';
    const toInputValue = (bound) => (inputType === 'date' && bound ? String(bound).slice(0, 10) : bound ?? '');
    const handleBoundChange = (key) => (e) => {
        const raw = e.target.value;
        const bound = raw === '' ? null : inputType === 'number' ? Number(raw) : raw;
        onChange({ ...value, bounds, [key]: bound });
    };
    return (
        <>
            <FormGroup className="form-group-flex">
                <ControlLabel><Message msgId="widgets.filterWidget.rangeBounds" /></ControlLabel>
                <InputGroup>
                    <Select
                        clearable={false}
                        value={localizedSelectedOption}
                        options={localizedOptions}
                        onChange={(option) => onChange({ ...value, bounds: option?.value })}
                    />
                </InputGroup>
            </FormGroup>
            {bounds === RANGE_BOUNDS_TYPES.MANUAL
                ? (
                    <FormGroup className="form-group-flex ms-filter-range-bounds-inputs">
                        <ControlLabel><Message msgId="widgets.filterWidget.rangeMin" /></ControlLabel>
                        <FormControl type={inputType} value={toInputValue(value.min)} onChange={handleBoundChange('min')} />
                        <ControlLabel><Message msgId="widgets.filterWidget.rangeMax" /></ControlLabel>
                        <FormControl type={inputType} value={toInputValue(value.max)} onChange={handleBoundChange('max')} />
                    </FormGroup>
                )
                : <HelpBlock><Message msgId="widgets.filterWidget.rangeBoundsAutoDescription" /></HelpBlock>}
        </>
    );
};

RangeBoundsSelector.propTypes = {
    value: PropTypes.object,
    attributeType: PropTypes.string,
    onChange: PropTypes.func
};

export default RangeBoundsSelector;
