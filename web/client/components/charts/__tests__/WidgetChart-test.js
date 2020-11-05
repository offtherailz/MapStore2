
import React from 'react';
import ReactDOM from 'react-dom';
import WidgetChart, { toPlotly, defaultColorGenerator, COLOR_DEFAULTS } from '../WidgetChart';

import expect from 'expect';
import { DATASET_1 } from './sample_data';

describe('WidgetChart', () => {
    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        setTimeout(done);
    });
    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(document.getElementById("container"));
        document.body.innerHTML = '';
        setTimeout(done);
    });
    it('rendering pie', (done) => {
        const check = ({ data, layout }, graphDiv) => {
            expect(graphDiv).toExist();
            expect(layout.showLegend).toBeFalsy();
            expect(layout.autosize).toBeFalsy();
            expect(layout.automargin).toBeFalsy();
            expect(data.length).toEqual(1);
            // use yAxis dataKey as default label
            expect(data[0].name).toEqual(DATASET_1.series[0].dataKey);
            // data values mapped
            data[0].values.map((v, i) => expect(v).toBe(DATASET_1.data[i][DATASET_1.series[0].dataKey]));
            // data labels mapped
            data[0].labels.map((v, i) => expect(v).toBe(DATASET_1.data[i][DATASET_1.xAxis.dataKey]));
            done();
        };
        ReactDOM.render(<WidgetChart onInitialized={check} {...DATASET_1} type="pie" />, document.getElementById("container"));
    });
    it('rendering line', (done) => {
        const check = ({ data, layout }, graphDiv) => {
            expect(graphDiv).toExist();
            expect(layout.showLegend).toBeFalsy();
            expect(layout.autosize).toBeFalsy();
            expect(layout.automargin).toBeFalsy();
            expect(data.length).toEqual(1);
            // use yAxis dataKey as default label
            expect(data[0].name).toEqual(DATASET_1.series[0].dataKey);
            // data values mapped
            data[0].y.map((v, i) => expect(v).toBe(DATASET_1.data[i][DATASET_1.series[0].dataKey]));
            // data labels mapped
            data[0].x.map((v, i) => expect(v).toBe(DATASET_1.data[i][DATASET_1.xAxis.dataKey]));
            done();
        };
        ReactDOM.render(<WidgetChart onInitialized={check} {...DATASET_1} type="line" />, document.getElementById("container"));
    });
    it('rendering bar', (done) => {
        const check = ({ data, layout }, graphDiv) => {
            expect(graphDiv).toExist();
            expect(layout.showLegend).toBeFalsy();
            expect(layout.autosize).toBeFalsy();
            expect(layout.automargin).toBeFalsy();
            expect(data.length).toEqual(1);
            // use yAxis dataKey as default label
            expect(data[0].name).toEqual(DATASET_1.series[0].dataKey);
            // data values mapped
            data[0].y.map((v, i) => expect(v).toBe(DATASET_1.data[i][DATASET_1.series[0].dataKey]));
            // data labels mapped
            data[0].x.map((v, i) => expect(v).toBe(DATASET_1.data[i][DATASET_1.xAxis.dataKey]));
            done();
        };
        ReactDOM.render(<WidgetChart onInitialized={check} {...DATASET_1} type="bar" />, document.getElementById("container"));
    });
});


const TYPES = ['pie', 'line', 'bar'];

describe('Widget Chart: data conversions ', () => {
    describe('common options', () => {
        function testAllTypes(props, handler) {
            TYPES.map(type => toPlotly({
                type,
                ...props
            })).map(handler);
        }
        it('defaults', () => {
            testAllTypes(DATASET_1, ({data, config, layout}) => {
                // default settings valid for all chart types
                expect(layout.showLegend).toBeFalsy();
                expect(layout.autosize).toBeFalsy();
                expect(layout.automargin).toBeFalsy();
                expect(data.length).toEqual(1);
                // use yAxis dataKey as default label
                expect(data[0].name).toEqual(DATASET_1.series[0].dataKey);
                // hide logo
                expect(config.displaylogo).toBeFalsy();
            });
        });
        const THRESHOLD = 350;
        it('test dimension are passed', () => {
            testAllTypes({ ...DATASET_1, width: 200, height: 200 }, ({ layout }) => {
                expect(layout.width).toBe(200);
                expect(layout.height).toBe(200);
            });
        });
        it(`show toolbar only if witdth > ${THRESHOLD}`, () => {
            testAllTypes({ ...DATASET_1, width: THRESHOLD }, ({ config }) => {
                expect(config.displayModeBar).toBe(false);
            });
            testAllTypes({ ...DATASET_1, width: THRESHOLD + 1 }, ({ config }) => {
                expect(config.displayModeBar).toBe(true);
            });
        });
        it('show legend', () => {
            testAllTypes({ ...DATASET_1, legend: true }, ({ layout }) => {
                expect(layout.showlegend).toBeTruthy();
            });
        });
    });
    describe('Pie chart', () => {
        it('basic chart options', () => {
            const { data, layout } = toPlotly({
                type: 'pie',
                ...DATASET_1
            });
            // DATA
            expect(data.length).toBe(1);
            expect(data[0].type).toBe('pie');
            // this avoids text to overflow the chart div when rendered outside the widget
            expect(data[0].textposition).toEqual('inside');
            // data values mapped
            data[0].values.map((v, i) => expect(v).toBe(DATASET_1.data[i][DATASET_1.series[0].dataKey]));
            // data labels mapped
            data[0].labels.map((v, i) => expect(v).toBe(DATASET_1.data[i][DATASET_1.xAxis.dataKey]));
            // LAYOUT
            expect(layout.margin).toEqual({t: 5, b: 5, l: 2, r: 2, pad: 4}); // fixed margins
            // colors generated are the defaults, generated on data (1 color for each entry)
            expect(layout.colorway).toEqual(defaultColorGenerator(data[0].values.length, COLOR_DEFAULTS));
        });
        it('custom colors', () => {
            const autoColorOptions = { base: 190, range: 20 };
            const { data, layout } = toPlotly({
                type: 'pie',
                autoColorOptions,
                ...DATASET_1
            });
            expect(layout.colorway).toEqual(defaultColorGenerator(data[0].values.length, autoColorOptions));
        });
    });
    describe('Line/Bar chart', () => {
        function testAllTypes(props, handler) {
            ['line', 'bar'].map(type => toPlotly({
                type,
                ...props
            })).map(handler);
        }
        it('basic line/bar options', () => {
            testAllTypes(DATASET_1, ({data, layout}) => {
                // DATA

                expect(data.length).toBe(1);
                // expect(data[0].type).toBe('line');

                // data values mapped
                data[0].y.map((v, i) => expect(v).toBe(DATASET_1.data[i][DATASET_1.series[0].dataKey]));
                // data labels mapped
                data[0].x.map((v, i) => expect(v).toBe(DATASET_1.data[i][DATASET_1.xAxis.dataKey]));
                // LAYOUT

                // minimal margins, botton automatic
                expect(layout.margin).toEqual({ t: 5, b: undefined, l: 5, r: 5, pad: 4 });

                // colors generated are the defaults, generated on series (1 color for series, so 1)
                expect(layout.colorway).toEqual(defaultColorGenerator(1, COLOR_DEFAULTS));

                // yaxis
                expect(layout.yaxis.automargin).toBeTruthy();
                expect(layout.yaxis.showticklabels).toBeFalsy();
                expect(layout.yaxis.showgrid).toBeFalsy();

                // xaxis
                expect(layout.xaxis.automargin).toBeTruthy();
                expect(layout.xaxis.tickangle).toEqual('auto');
            });
        });
        it('yAxisLabel to be used as name of the chart', () => {
            testAllTypes({
                ...DATASET_1,
                yAxisLabel: "TEST_LABEL"
            }, ({ data }) => {
                expect(data[0].name).toEqual("TEST_LABEL");
            });
        });
        it('xAxisAngle and relative bottom margin', () => {
            testAllTypes({
                ...DATASET_1,
                xAxisAngle: 0
            }, ({ layout }) => {
                // bottom margin is optimized
                expect(layout.margin).toEqual({ t: 5, b: 25, l: 5, r: 5, pad: 4 });
                expect(layout.xaxis.tickangle).toEqual(0);
            });
            testAllTypes({
                ...DATASET_1,
                xAxisAngle: 90
            }, ({ layout }) => {
                expect(layout.margin).toEqual({ t: 5, b: undefined, l: 5, r: 5, pad: 4 });
                expect(layout.xaxis.tickangle).toEqual(90);
            });
        });
        it('yAxis amd relative left margin', () => {
            testAllTypes({
                ...DATASET_1
            }, ({ layout }) => {
                // bottom margin is optimized
                expect(layout.yaxis.showticklabels).toBe(false); // false by default
                expect(layout.margin).toEqual({ t: 5, b: undefined, l: 5, r: 5, pad: 4 });
            });
            testAllTypes({
                ...DATASET_1,
                yAxis: true
            }, ({ layout }) => {
                // bottom margin is optimized
                expect(layout.yaxis.showticklabels).toBe(true);
                expect(layout.margin).toEqual({ t: 5, b: undefined, l: undefined, r: 5, pad: 4 });
            });
        });
        it('cartesian to show/hide grid', () => {
            testAllTypes({
                ...DATASET_1,
                cartesian: true
            }, ({ layout }) => {
                // bottom margin is optimized
                expect(layout.yaxis.showgrid).toBe(true); // false by default
                expect(layout.margin).toEqual({ t: 5, b: undefined, l: 5, r: 5, pad: 4 });
            });

        });
    });
});
