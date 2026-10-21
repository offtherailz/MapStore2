/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import expect from 'expect';
import {
    DATE_FORMAT_TYPES,
    ATTRIBUTE_FORMATTER_NAME,
    getDisplayDateFormats,
    formatDateValue,
    formatNumberValue,
    formatAttributeValue,
    addAttributeFormatters,
    isFormattableType
} from '../AttributeFormatUtils';
import { dateFormats as isoDateFormats } from '../FeatureGridUtils';

describe('AttributeFormatUtils', () => {
    it('getDisplayDateFormats uses the language format when no format is set', () => {
        expect(getDisplayDateFormats(undefined, 'it-IT')).toEqual({
            'date': 'DD/MM/YYYY',
            'date-time': 'DD/MM/YYYY HH:mm:ss',
            'time': 'HH:mm:ss'
        });
        expect(getDisplayDateFormats({ type: DATE_FORMAT_TYPES.AUTO }, 'en-US').date).toBe('MM/DD/YYYY');
        expect(getDisplayDateFormats(undefined, 'de-DE').date).toBe('DD.MM.YYYY');
        expect(getDisplayDateFormats(undefined, 'xx-XX').date).toBe('YYYY/MM/DD');
    });
    it('getDisplayDateFormats returns the ISO formats and the custom pattern', () => {
        expect(getDisplayDateFormats({ type: DATE_FORMAT_TYPES.ISO }, 'it-IT')).toBe(isoDateFormats);
        expect(getDisplayDateFormats({ type: DATE_FORMAT_TYPES.CUSTOM, pattern: 'DD/MM/YYYY HH:mm' }, 'en-US')).toEqual({
            'date': 'DD/MM/YYYY HH:mm',
            'date-time': 'DD/MM/YYYY HH:mm',
            'time': 'DD/MM/YYYY HH:mm'
        });
        expect(getDisplayDateFormats({ type: DATE_FORMAT_TYPES.CUSTOM, pattern: '' }, 'it-IT').date).toBe('DD/MM/YYYY');
    });
    it('formatDateValue formats dates, date-times and times and keeps other values', () => {
        const formats = getDisplayDateFormats(undefined, 'it-IT');
        expect(formatDateValue('2025-12-29Z', 'date', formats)).toBe('29/12/2025');
        expect(formatDateValue('2025-03-21T14:30:05.000Z', 'date-time', formats)).toBe('21/03/2025 14:30:05');
        expect(formatDateValue('14:30:05Z', 'time', formats)).toBe('14:30:05');
        expect(formatDateValue('not a date', 'date', formats)).toBe('not a date');
        expect(formatDateValue(null, 'date', formats)).toBe(null);
    });
    it('formatNumberValue applies formula, d3 format, prefix and suffix', () => {
        expect(formatNumberValue(1234567.891, {})).toBe('1234567.891');
        expect(formatNumberValue(1234567.891, { format: ',.1f' })).toBe('1,234,567.9');
        expect(formatNumberValue('12', { format: '.2f' })).toBe('12.00');
        expect(formatNumberValue(1234567.891, { formula: 'value / 1000', format: ',.2f', tickPrefix: '~', tickSuffix: ' kg' })).toBe('~1,234.57 kg');
        expect(formatNumberValue(0.25, { format: '.0%' })).toBe('25%');
        expect(formatNumberValue(12, { format: 'not a format', formula: 'value +' })).toBe('12');
        expect(formatNumberValue('abc', { tickPrefix: '~' })).toBe('abc');
        expect(formatNumberValue(null, {})).toBe(null);
    });
    it('formatAttributeValue picks the formatter of the type', () => {
        expect(formatAttributeValue('2025-12-29Z', 'date', { type: DATE_FORMAT_TYPES.CUSTOM, pattern: 'YYYY' }, 'it-IT')).toBe('2025');
        expect(formatAttributeValue(1500, 'int', { format: ',d' }, 'it-IT')).toBe('1,500');
        expect(formatAttributeValue('text', 'string', {}, 'it-IT')).toBe('text');
    });
    it('isFormattableType', () => {
        expect(['date', 'date-time', 'time', 'int', 'number', 'string', 'boolean'].map(isFormattableType))
            .toEqual([true, true, true, true, true, false, false]);
    });
    it('addAttributeFormatters adds the formatter only to the formatted attributes', () => {
        const describe = { featureTypes: [{ properties: [
            { name: 'day', localType: 'date' },
            { name: 'mass', localType: 'number' },
            { name: 'name', localType: 'string' }
        ] }] };
        const fields = [{ name: 'name', alias: 'Name' }, { name: 'day', alias: 'Day' }];
        const format = { type: DATE_FORMAT_TYPES.ISO };
        expect(addAttributeFormatters(fields, [{ name: 'day' }, { name: 'name' }], describe, 'it-IT')).toBe(fields);
        expect(addAttributeFormatters(fields, [{ name: 'day', format }, { name: 'mass', format: { format: '.1f' } }], describe, 'it-IT')).toEqual([
            { name: 'name', alias: 'Name' },
            { name: 'day', alias: 'Day', featureGridFormatter: { name: ATTRIBUTE_FORMATTER_NAME, localType: 'date', format, locale: 'it-IT' } },
            { name: 'mass', featureGridFormatter: { name: ATTRIBUTE_FORMATTER_NAME, localType: 'number', format: { format: '.1f' }, locale: 'it-IT' } }
        ]);
    });
});
