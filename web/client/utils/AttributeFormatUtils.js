/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import moment from 'moment';
import isNil from 'lodash/isNil';
import { format as d3Format } from 'd3-format';
import { parseExpression } from './ExpressionUtils';
import { getDateFormat } from './LocaleUtils';
import { dateFormats as isoDateFormats } from './FeatureGridUtils';

export const DATE_FORMAT_TYPES = {
    AUTO: 'auto',
    ISO: 'iso',
    CUSTOM: 'custom'
};

// Name of the feature grid formatter that applies the format of an attribute.
export const ATTRIBUTE_FORMATTER_NAME = 'attributeFormat';

const TIME_FORMAT = 'HH:mm:ss';
const DATE_TYPES = ['date', 'date-time', 'time'];
const NUMBER_TYPES = ['int', 'number'];
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}Z?$/i;

export const isDateType = (type) => DATE_TYPES.includes(type);
export const isNumberType = (type) => NUMBER_TYPES.includes(type);
export const isFormattableType = (type) => isDateType(type) || isNumberType(type);

/**
 * Returns the display formats for the date types from a date format setting.
 * The automatic format is the date format of the current language, as in the rest of the application.
 * @param {object} format setting with `type` (`auto`, `iso` or `custom`) and `pattern` for `custom`
 * @param {string} locale current locale code, e.g. `it-IT`
 * @returns {object} moment patterns for the `date`, `date-time` and `time` types
 */
export const getDisplayDateFormats = (format, locale) => {
    const type = format?.type ?? DATE_FORMAT_TYPES.AUTO;
    if (type === DATE_FORMAT_TYPES.ISO) {
        return isoDateFormats;
    }
    if (type === DATE_FORMAT_TYPES.CUSTOM && format.pattern) {
        const pattern = format.pattern;
        return { 'date': pattern, 'date-time': pattern, 'time': pattern };
    }
    const date = getDateFormat(locale);
    return { 'date': date, 'date-time': `${date} ${TIME_FORMAT}`, 'time': TIME_FORMAT };
};

/**
 * Formats a date value returned by a service with the display format of its type.
 * Values that are not valid dates are returned as they are.
 * @param {string} value date, date-time or time value
 * @param {string} type one of `date`, `date-time`, `time`
 * @param {object} formats display formats, from `getDisplayDateFormats`
 * @returns {string} the formatted value
 */
export const formatDateValue = (value, type, formats) => {
    if (isNil(value) || value === '') {
        return value;
    }
    const stringValue = String(value);
    let date = moment.utc(stringValue, moment.ISO_8601);
    if (DATE_ONLY_REGEX.test(stringValue)) {
        date = moment.utc(stringValue.slice(0, 10), 'YYYY-MM-DD');
    } else if (type === 'time' && !date.isValid()) {
        date = moment.utc(`1970-01-01T${stringValue}`, moment.ISO_8601);
    }
    return date.isValid() ? date.format(formats[type]) : stringValue;
};

/**
 * Formats a number with the same options of the chart and counter widgets.
 * The value is transformed by the formula, formatted with the d3 format and wrapped by prefix and suffix.
 * @param {number|string} value the number
 * @param {object} format `{ formula, format, tickPrefix, tickSuffix }`: filtrex expression of `value`, d3-format specifier (e.g. `,.2f`), text before and after the value
 * @returns {string} the formatted value, or the value itself when it is not a number
 */
export const formatNumberValue = (value, format = {}) => {
    const number = Number(value);
    if (isNil(value) || value === '' || isNaN(number)) {
        return value;
    }
    let result = number;
    if (format.formula) {
        try {
            result = parseExpression(format.formula, { value: number });
        } catch (e) {
            result = number;
        }
    }
    if (format.format) {
        try {
            result = d3Format(format.format)(result);
        } catch (e) {
            // an invalid specifier leaves the value unformatted
        }
    }
    return `${format.tickPrefix ?? ''}${result}${format.tickSuffix ?? ''}`;
};

/**
 * Formats the value of an attribute with the format configured for it.
 * @param {*} value the value
 * @param {string} type attribute type (`localType` of the describe feature type)
 * @param {object} format format configured for the attribute
 * @param {string} locale current locale code
 * @returns {*} the formatted value; values of other types are returned as they are
 */
export const formatAttributeValue = (value, type, format, locale) => {
    if (isDateType(type)) {
        return formatDateValue(value, type, getDisplayDateFormats(format, locale));
    }
    if (isNumberType(type)) {
        return formatNumberValue(value, format);
    }
    return value;
};

/**
 * Adds the feature grid formatter to the fields of the attributes that have a format,
 * so the table shows them with the format chosen for each column.
 * @param {object[]} fields layer fields
 * @param {object[]} propertyName attributes of the table, `{ name, format }`
 * @param {object} describe describe feature type of the layer
 * @param {string} locale current locale code
 * @returns {object[]} fields
 */
export const addAttributeFormatters = (fields = [], propertyName = [], describe, locale) => {
    const properties = describe?.featureTypes?.[0]?.properties || [];
    const formatted = (propertyName || []).filter(p => p?.format);
    if (!formatted.length) {
        return fields;
    }
    const others = fields.filter(field => !formatted.find(p => p.name === field.name));
    return [
        ...others,
        ...formatted.map(({ name, format }) => ({
            ...fields.find(field => field.name === name),
            name,
            featureGridFormatter: {
                name: ATTRIBUTE_FORMATTER_NAME,
                localType: properties.find(p => p.name === name)?.localType,
                format,
                locale
            }
        }))
    ];
};
