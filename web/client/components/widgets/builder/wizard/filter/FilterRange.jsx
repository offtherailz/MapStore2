/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import isNil from 'lodash/isNil';
import { FormControl, Glyphicon } from 'react-bootstrap';
import Slider from '../../../../misc/Slider';
import DateTimePicker from '../../../../misc/datetimepicker';
import Message from '../../../../I18N/Message';
import Button from '../../../../misc/Button';
import FlexBox from '../../../../layout/FlexBox';
import { getDisplayDateFormats, formatDateValue, formatNumberValue } from '../../../../../utils/AttributeFormatUtils';
import {
    RANGE_ENDS,
    RANGE_VARIANTS,
    RANGE_STEP_UNITS,
    isRangeDateType,
    getRangeStops,
    getRangeSelection,
    toRangeSelections,
    startOfStep
} from '../../../../../utils/FilterRangeUtils';
import './FilterRange.less';

const toNumber = (value, isDate) => (isDate ? moment.utc(value).valueOf() : Number(value));

const nearestIndex = (stops, value, isDate) => {
    if (isNil(value) || !stops.length) {
        return null;
    }
    const target = toNumber(value, isDate);
    return stops.reduce((best, stop, index) =>
        Math.abs(toNumber(stop, isDate) - target) < Math.abs(toNumber(stops[best], isDate) - target) ? index : best, 0);
};

// The date picker works on local dates, while filter values are UTC dates.
const toLocalDate = (value) => {
    if (isNil(value)) {
        return null;
    }
    const date = moment.utc(value);
    return new Date(date.year(), date.month(), date.date());
};
const fromLocalDate = (date) => moment.utc([date.getFullYear(), date.getMonth(), date.getDate()]).toISOString();

const NumberField = ({ value, min, max, step, onCommit, disabled }) => {
    const toDraft = (v) => (isNil(v) ? '' : String(v));
    const [draft, setDraft] = useState(toDraft(value));
    const [lastValue, setLastValue] = useState(value);
    // A new value from outside replaces what the user was typing.
    if (value !== lastValue) {
        setLastValue(value);
        setDraft(toDraft(value));
    }
    const commit = () => onCommit(draft === '' ? null : Number(draft));
    return (
        <FormControl
            type="number"
            min={min}
            max={max}
            step={step}
            value={draft}
            disabled={disabled}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') { commit(); } }}
        />
    );
};

const RangeField = ({ labelId, value, isDate, dateFormat, stops, onCommit, canClear, disabled }) => (
    <div className="ms-filter-range-field">
        <span className="ms-filter-range-field-label"><Message msgId={labelId} /></span>
        <FlexBox gap="xs" centerChildrenVertically>
            {isDate
                ? <DateTimePicker
                    key={isNil(value) ? 'empty' : 'value'}
                    calendar
                    time={false}
                    type="date"
                    format={dateFormat}
                    value={toLocalDate(value)}
                    disabled={disabled}
                    onChange={(date) => date && onCommit(fromLocalDate(date))}
                />
                : <NumberField
                    value={value}
                    min={stops[0]}
                    max={stops[stops.length - 1]}
                    step={stops.length > 1 ? stops[1] - stops[0] : 1}
                    disabled={disabled}
                    onCommit={onCommit}
                />}
            {canClear && !isNil(value) && (
                <Button className="square-button-md no-border" onClick={() => onCommit(null)}>
                    <Glyphicon glyph="remove" />
                </Button>
            )}
        </FlexBox>
    </div>
);

/**
 * Interval selector of the dynamic filter, with fields or a slider.
 * An empty end, or a slider handle left on the bound, means no limit on that side.
 */
const FilterRange = ({ filterData, bounds, selections = [], onSelectionChange = () => {}, locale, disabled }) => {
    const layout = filterData?.layout || {};
    const type = filterData?.data?.valueAttributeType;
    const isDate = isRangeDateType(type);
    const ends = layout.rangeEnds ?? RANGE_ENDS.BOTH;
    const unit = layout.stepUnit ?? RANGE_STEP_UNITS.DAY;
    const force = layout.forceSelection === true;
    const stops = useMemo(
        () => getRangeStops({ type, min: bounds?.min, max: bounds?.max, step: layout.step, stepUnit: unit }),
        [type, bounds?.min, bounds?.max, layout.step, unit]
    );
    const last = stops.length - 1;
    // Without a format, dates follow the language of the user and numbers keep all their decimals.
    const attributeFormat = filterData?.data?.attributeFormats?.[filterData?.data?.valueAttribute];
    const dateFormat = getDisplayDateFormats(attributeFormat, locale).date;
    const selection = getRangeSelection(selections) ?? { start: null, end: null };
    const showStart = ends !== RANGE_ENDS.MAX;
    const showEnd = ends !== RANGE_ENDS.MIN;
    const isSlider = layout.variant === RANGE_VARIANTS.SLIDER;
    const showFields = !isSlider || layout.showInputs;

    if (!stops.length) {
        return <div className="ms-filter-range-empty"><Message msgId="widgets.filterWidget.rangeNoBounds" /></div>;
    }

    const formatValue = (value) => (isDate
        ? formatDateValue(value, 'date', { date: dateFormat })
        : formatNumberValue(value, attributeFormat));
    const emit = (start, end) => onSelectionChange(toRangeSelections(start, end));
    const clampToBounds = (value) => (isNil(value) ? null : stops[nearestIndex(stops, isDate ? startOfStep(value, unit) : value, isDate)]);
    const commitStart = (value) => {
        const start = clampToBounds(value);
        const end = !isNil(start) && !isNil(selection.end) && toNumber(start, isDate) > toNumber(selection.end, isDate) ? start : selection.end;
        emit(start, end);
    };
    const commitEnd = (value) => {
        const end = clampToBounds(value);
        const start = !isNil(end) && !isNil(selection.start) && toNumber(end, isDate) < toNumber(selection.start, isDate) ? end : selection.start;
        emit(start, end);
    };

    const lo = nearestIndex(stops, selection.start, isDate) ?? 0;
    const hi = nearestIndex(stops, selection.end, isDate) ?? last;
    const handleSlide = (values = []) => {
        const indexes = values.map(v => Math.round(Number(v)));
        const startIndex = showStart ? indexes[0] : null;
        const endIndex = showEnd ? indexes[indexes.length - 1] : null;
        const start = isNil(startIndex) || (startIndex === 0 && !force) ? null : stops[startIndex];
        const end = isNil(endIndex) || (endIndex === last && !force) ? null : stops[endIndex];
        emit(start, end);
    };
    const sliderStart = [...(showStart ? [lo] : []), ...(showEnd ? [hi] : [])];
    const connect = showStart && showEnd ? [false, true, false] : [!showStart, showStart];
    const anyLabel = <Message msgId="widgets.filterWidget.rangeAny" />;

    return (
        <div className={`ms-filter-range${disabled ? ' ms-filter-range-disabled' : ''}`}>
            {isSlider && (
                <>
                    <FlexBox className="ms-filter-range-values" gap="sm" centerChildrenVertically>
                        {showStart && <span><Message msgId="widgets.filterWidget.rangeFrom" />: {isNil(selection.start) ? anyLabel : formatValue(selection.start)}</span>}
                        {showEnd && <span><Message msgId={showStart ? 'widgets.filterWidget.rangeTo' : 'widgets.filterWidget.rangeUpTo'} />: {isNil(selection.end) ? anyLabel : formatValue(selection.end)}</span>}
                    </FlexBox>
                    {last > 0 && (
                        <div className="mapstore-slider ms-filter-range-slider">
                            <Slider
                                key={`${type}-${ends}-${stops.length}`}
                                start={sliderStart}
                                connect={connect}
                                range={{ min: 0, max: last }}
                                step={1}
                                disabled={disabled}
                                onChange={handleSlide}
                            />
                        </div>
                    )}
                    <FlexBox className="ms-filter-range-bounds" gap="sm">
                        <span>{formatValue(stops[0])}</span>
                        <span>{formatValue(stops[last])}</span>
                    </FlexBox>
                </>
            )}
            {showFields && (
                <FlexBox className="ms-filter-range-fields" gap="sm" wrap>
                    {showStart && <RangeField labelId="widgets.filterWidget.rangeFrom" value={selection.start} isDate={isDate} dateFormat={dateFormat} stops={stops} onCommit={commitStart} canClear={!force} disabled={disabled} />}
                    {showEnd && <RangeField labelId={showStart ? 'widgets.filterWidget.rangeTo' : 'widgets.filterWidget.rangeUpTo'} value={selection.end} isDate={isDate} dateFormat={dateFormat} stops={stops} onCommit={commitEnd} canClear={!force} disabled={disabled} />}
                </FlexBox>
            )}
        </div>
    );
};

FilterRange.propTypes = {
    filterData: PropTypes.object,
    bounds: PropTypes.object,
    selections: PropTypes.array,
    onSelectionChange: PropTypes.func,
    locale: PropTypes.string,
    disabled: PropTypes.bool
};

export default FilterRange;
