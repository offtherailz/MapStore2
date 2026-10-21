/**
* Copyright 2025, GeoSolutions Sas.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

import expect from 'expect';

import {
    downloadLayerSelector,
    wfsFilterSelector,
    widgetDownloadPropertyNamesSelector,
    widgetDownloadViewportSelector
} from '../layerdownload';


describe('Test layers selectors', () => {
    it('test downloadLayerSelector', () => {
        let layer = downloadLayerSelector({layerdownload: {downloadLayer: {id: "ws:layer_1"}}});
        expect(layer).toExist();
        expect(layer).toEqual({id: "ws:layer_1"});
    });
    describe('wfsFilterSelector with filters coming from other widgets', () => {
        const interactionFilter = { id: "i1", format: "logic", logic: "OR", filters: [{ format: "cql", body: "year >= '2000-01-01'" }] };
        it('adds the filters applied by other widgets to the table filter', () => {
            const result = wfsFilterSelector({
                featuregrid: {open: false},
                layerdownload: {downloadLayer: {widgetId: "id", name: "ws:layer"}},
                widgets: {containers: {floating: {widgets: [{id: "id", widgetType: "table", interactionFilters: [interactionFilter]}]}}}
            });
            expect(result).toEqual({
                featureTypeName: "ws:layer",
                filterType: 'OGC',
                ogcVersion: '1.1.0',
                filters: [interactionFilter]
            });
        });
        it('applies the quick filters of the table also without a table filter', () => {
            const result = wfsFilterSelector({
                featuregrid: {open: false},
                layerdownload: {downloadLayer: {widgetId: "id", name: "ws:layer"}},
                widgets: {containers: {floating: {widgets: [{
                    id: "id",
                    widgetType: "table",
                    options: {propertyName: ["NAME"]},
                    quickFilters: {NAME: {rawValue: "a", value: "a", operator: "ilike", type: "string", attribute: "NAME"}}
                }]}}}
            });
            expect(result.featureTypeName).toBe("ws:layer");
            expect(result.filterFields.length).toBe(1);
            expect(result.filterFields[0].attribute).toBe("NAME");
            expect(result.filterFields[0].value).toBe("a");
        });
    });
    describe('widgetDownloadViewportSelector', () => {
        const viewport = { bounds: { minx: 0, miny: 0, maxx: 10, maxy: 10 }, crs: "EPSG:3857" };
        const state = (table) => ({
            layerdownload: {downloadLayer: {widgetId: "tbl", name: "name"}},
            widgets: {containers: {floating: {widgets: [
                {id: "map1", widgetType: "map", maps: [{mapId: "m1", viewport}], selectedMapId: "m1"},
                table
            ]}}}
        });
        it('returns the viewport of the map the table is synchronized with', () => {
            const table = {id: "tbl", widgetType: "table", mapSync: true, dependenciesMap: {viewport: "widgets[map1].maps[m1].viewport"}};
            expect(widgetDownloadViewportSelector(state(table))).toEqual(viewport);
        });
        it('returns null when the table is not synchronized with a map', () => {
            const table = {id: "tbl", widgetType: "table", mapSync: false, dependenciesMap: {viewport: "widgets[map1].maps[m1].viewport"}};
            expect(widgetDownloadViewportSelector(state(table))).toBe(null);
            expect(widgetDownloadViewportSelector({...state(table), layerdownload: {downloadLayer: {name: "name"}}})).toBe(null);
        });
    });
    describe('widgetDownloadPropertyNamesSelector', () => {
        const tableWidget = {
            id: "id",
            widgetType: "table",
            options: {
                propertyName: ["A", {name: "B"}, "C"],
                columnSettings: {C: {hide: true}, A: {width: 100}}
            }
        };
        const state = (extra = {}) => ({
            layerdownload: {downloadLayer: {widgetId: "id", name: "name"}},
            widgets: {containers: {floating: {widgets: [tableWidget]}}},
            ...extra
        });
        it('returns the visible columns of the table widget', () => {
            expect(widgetDownloadPropertyNamesSelector(state())).toEqual(["A", "B"]);
        });
        it('returns null when the download does not come from a table widget', () => {
            expect(widgetDownloadPropertyNamesSelector(state({layerdownload: {downloadLayer: {name: "name"}}}))).toBe(null);
            expect(widgetDownloadPropertyNamesSelector(state({layerdownload: {downloadLayer: {widgetId: "other", name: "name"}}}))).toBe(null);
        });
    });
    const filterObj = {featureTypeName: "test"};
    describe('test wfsFilterSelector', () => {
        it('featureGridOpen true, wfsFilter valid', () => {
            let result = wfsFilterSelector({
                featuregrid: {open: true},
                query: {filterObj}
            });
            expect(result).toExist();
            expect(result).toEqual(filterObj);
        });
        it('featureGridOpen true, wfsFilter not valid', () => {
            let result = wfsFilterSelector({
                featuregrid: {open: true},
                layerdownload: {downloadLayer: {widgetId: "id", name: "name"}},
                widgets: {containers: {floating: {widgets: [{id: "id", widgetType: "table", filter: filterObj}]}}}
            });
            expect(result).toExist();
            expect(result).toEqual(filterObj);
        });
        it('featureGridOpen false, downloadLayer', () => {
            let result = wfsFilterSelector({
                featuregrid: {open: false},
                layerdownload: {downloadLayer: {widgetId: "id", name: "name"}},
                widgets: {containers: {floating: {widgets: [{id: "id", widgetType: "table", filter: filterObj}]}}}
            });
            expect(result).toExist();
            expect(result).toEqual(filterObj);
        });
        it('featureGridOpen false, no filter added using default filterObj', () => {
            let result = wfsFilterSelector({
                featuregrid: {open: false},
                layerdownload: {downloadLayer: {widgetId: "id", name: "name"}},
                widgets: {containers: {floating: {widgets: [{id: "id", widgetType: "table"}]}}}
            });
            expect(result).toExist();
            expect(result).toEqual({
                featureTypeName: "name",
                filterType: 'OGC',
                ogcVersion: '1.1.0'
            });
        });
        it('featureGridOpen false, quickFilter added along with default filterObj', () => {
            let filter = {
                featureTypeName: "name",
                filterType: 'OGC',
                ogcVersion: '1.1.0',
                filterFields: []
            };
            let quickFilters = {
                "states": {
                    attribute: "states",
                    operator: "ilike",
                    rawValue: "a",
                    type: "string",
                    value: "a"
                }
            };
            let options = {
                propertyName: ["states"]
            };
            let result = wfsFilterSelector({
                featuregrid: {open: false},
                layerdownload: {downloadLayer: {widgetId: "id", name: "name"}},
                widgets: {containers: {floating: {widgets: [{id: "id", widgetType: "table", quickFilters, filter, options}]}}}
            });
            expect(result).toExist();
            expect(result.filterFields.length).toBe(1);
            expect(result.filterFields[0].value).toBe('a');
            expect(result.filterFields[0].operator).toBe('ilike');
            expect(result.filterFields[0].attribute).toBe('states');
        });
    });

});
