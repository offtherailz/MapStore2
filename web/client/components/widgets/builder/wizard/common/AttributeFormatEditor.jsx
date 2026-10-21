/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import PropTypes from 'prop-types';
import isNil from 'lodash/isNil';
import { FormGroup, FormControl, HelpBlock, Popover, OverlayTrigger, Glyphicon } from 'react-bootstrap';
import Select from 'react-select';
import Message from '../../../../I18N/Message';
import Button from '../../../../misc/Button';
import localizedProps from '../../../../misc/enhancers/localizedProps';
import { useLocalizedOptions } from '../filter/hooks/useLocalizedOptions';
import Format from './Format';
import Formula from './Formula';
import { DATE_FORMAT_TYPES, isDateType, isNumberType, formatAttributeValue } from '../../../../../utils/AttributeFormatUtils';

const LocalizedFormControl = localizedProps('placeholder')(FormControl);
const SAMPLE_DATE = '2025-03-21T14:30:00Z';
const SAMPLE_NUMBER = 1234567.891;
const DATE_FORMAT_OPTIONS = [
    { value: DATE_FORMAT_TYPES.AUTO, label: 'Automatic', labelKey: 'widgets.builder.wizard.attributeFormat.auto' },
    { value: DATE_FORMAT_TYPES.ISO, label: 'ISO', labelKey: 'widgets.builder.wizard.attributeFormat.iso' },
    { value: DATE_FORMAT_TYPES.CUSTOM, label: 'Custom', labelKey: 'widgets.builder.wizard.attributeFormat.custom' }
];

const DateFormatFields = ({ value, onChange }) => {
    const formatType = value?.type ?? DATE_FORMAT_TYPES.AUTO;
    const { localizedOptions, localizedSelectedOption } = useLocalizedOptions(
        DATE_FORMAT_OPTIONS,
        DATE_FORMAT_OPTIONS.find(option => option.value === formatType)
    );
    return (
        <>
            <FormGroup>
                <Select
                    clearable={false}
                    value={localizedSelectedOption}
                    options={localizedOptions}
                    onChange={(option) => onChange({ type: option?.value, pattern: value?.pattern })}
                />
            </FormGroup>
            {formatType === DATE_FORMAT_TYPES.CUSTOM && (
                <FormGroup>
                    <LocalizedFormControl
                        type="text"
                        value={value?.pattern ?? ''}
                        placeholder="widgets.builder.wizard.attributeFormat.patternPlaceholder"
                        onChange={(e) => onChange({ type: DATE_FORMAT_TYPES.CUSTOM, pattern: e.target.value })}
                    />
                </FormGroup>
            )}
            <HelpBlock><Message msgId={`widgets.builder.wizard.attributeFormat.${formatType}Description`} /></HelpBlock>
        </>
    );
};

const NumberFormatFields = ({ value = {}, onChange }) => (
    <>
        <Format
            data={{ format: value }}
            prefix="format"
            onChange={(key, fieldValue) => onChange({ ...value, [key.replace('format.', '')]: fieldValue })}
        />
        <Formula data={value} onChange={(key, fieldValue) => onChange({ ...value, [key]: fieldValue })} />
    </>
);

/**
 * Editor of the display format of an attribute: date formats for dates, the options of the chart values for numbers.
 * @prop {string} type attribute type (`localType`)
 * @prop {object} value format of the attribute; empty means the default display
 * @prop {function} onChange called with the new format, or `undefined` to restore the default display
 * @prop {string} locale current locale, used for the example
 */
const AttributeFormatEditor = ({ type, value, onChange = () => {}, locale }) => {
    const sample = isDateType(type) ? SAMPLE_DATE : SAMPLE_NUMBER;
    const example = formatAttributeValue(sample, isDateType(type) ? 'date-time' : 'number', value, locale);
    return (
        <div className="ms-attribute-format-editor">
            {isDateType(type)
                ? <DateFormatFields value={value} onChange={onChange} />
                : <NumberFormatFields value={value} onChange={onChange} />}
            <HelpBlock>
                <Message msgId="widgets.builder.wizard.attributeFormat.example" />
                {' '}
                <span className="ms-attribute-format-example">{example}</span>
            </HelpBlock>
            {!isNil(value) && (
                <Button bsSize="xsmall" className="ms-attribute-format-reset" onClick={() => onChange(undefined)}>
                    <Message msgId="widgets.builder.wizard.attributeFormat.reset" />
                </Button>
            )}
        </div>
    );
};

AttributeFormatEditor.propTypes = {
    type: PropTypes.string,
    value: PropTypes.object,
    onChange: PropTypes.func,
    locale: PropTypes.string
};

/**
 * Button that opens the format editor of an attribute. It is shown only for dates and numbers.
 * The button is highlighted when the attribute has a format.
 */
export const AttributeFormatButton = ({ id, type, value, onChange, locale, disabled, bsSize }) => {
    if (!isDateType(type) && !isNumberType(type)) {
        return null;
    }
    const popover = (
        <Popover id={`ms-attribute-format-${id}`} title={<Message msgId="widgets.builder.wizard.attributeFormat.title" />}>
            <AttributeFormatEditor type={type} value={value} onChange={onChange} locale={locale} />
        </Popover>
    );
    return (
        <OverlayTrigger trigger="click" rootClose placement="left" overlay={popover}>
            <Button
                className={`ms-attribute-format-button no-border${value ? ' active' : ''}`}
                bsSize={bsSize}
                bsStyle={value ? 'primary' : 'default'}
                disabled={disabled}
            >
                <Glyphicon glyph={isDateType(type) ? 'calendar' : 'counter'} />
            </Button>
        </OverlayTrigger>
    );
};

export default AttributeFormatEditor;
