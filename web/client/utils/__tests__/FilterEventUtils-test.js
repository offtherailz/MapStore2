/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import expect from 'expect';
import { getFilterLabelAttribute, processFilterToCQL } from '../FilterEventUtils';

describe('FilterEventUtils', () => {
    describe('processFilterToCQL with an interval', () => {
        const filter = {
            id: 'f1',
            data: { dataSource: 'features', valuesFrom: 'range', valueAttribute: 'pm10', valueAttributeType: 'number' },
            layout: {}
        };
        it('builds the CQL filter of the interval', () => {
            expect(processFilterToCQL(filter, [{ start: 10, end: 20 }])).toEqual({
                format: 'cql',
                version: '1.0.0',
                body: '"pm10" >= 10 AND "pm10" <= 20',
                id: '["pm10" >= 10 AND "pm10" <= 20]',
                filterId: 'f1'
            });
        });
        it('returns null when the interval is empty', () => {
            expect(processFilterToCQL(filter, [])).toBe(null);
            expect(processFilterToCQL(filter, [{ start: null, end: null }])).toBe(null);
        });
    });
    describe('getFilterLabelAttribute', () => {
        it('returns the value attribute when the labels are the values', () => {
            expect(getFilterLabelAttribute({ data: { dataSource: 'features', valueAttribute: 'day', valueAttributeType: 'date', attributeFormats: { day: { type: 'iso' } } } }))
                .toEqual({ name: 'day', type: 'date', format: { type: 'iso' } });
            expect(getFilterLabelAttribute({ data: { dataSource: 'features', valueAttribute: 'mass', valueAttributeType: 'number', labelAttribute: 'mass', labelAttributeType: 'number' } }))
                .toEqual({ name: 'mass', type: 'number', format: undefined });
        });
        it('returns the label attribute when a different label attribute is set', () => {
            expect(getFilterLabelAttribute({ data: { dataSource: 'features', valueAttribute: 'id', valueAttributeType: 'int', labelAttribute: 'day', labelAttributeType: 'date' } }))
                .toEqual({ name: 'day', type: 'date', format: undefined });
            expect(getFilterLabelAttribute({ data: { dataSource: 'features', valueAttribute: 'day', valueAttributeType: 'date', labelAttribute: 'name', labelAttributeType: 'string' } })).toBe(null);
        });
        it('returns null for labels that cannot be formatted', () => {
            expect(getFilterLabelAttribute({ data: { dataSource: 'features', valueAttribute: 'name', valueAttributeType: 'string' } })).toBe(null);
            expect(getFilterLabelAttribute({ data: { dataSource: 'userDefined', valueAttribute: 'day', valueAttributeType: 'date' } })).toBe(null);
            expect(getFilterLabelAttribute(undefined)).toBe(null);
        });
    });
});
