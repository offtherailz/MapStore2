/**
  * Copyright 2017, GeoSolutions Sas.
  * All rights reserved.
  *
  * This source code is licensed under the BSD-style license found in the
  * LICENSE file in the root directory of this source tree.
  */


const loadingState = require('../../misc/enhancers/loadingState')();
const errorChartState = require('../enhancers/errorChartState');
const emptyChartState = require('../enhancers/emptyChartState');
const React = require('react');
// const SimpleChart = require('./SimpleChart');
const EChart = require('../../charts/EChart').default;
const { withProps } = require('recompose');
// TODO: this should be splitted in two in final implementation.
// One is the adapter for data (wpsChart or what else) and type, options parsing in the component.
const toECharts = withProps(({ data, xAxis, series, type, height, width, cartesian }) => {
    const xDataKey = xAxis.dataKey;
    const yDataKey = series[0].dataKey;
    const style = {
        height, width
    };
    const commonOption = {
        // source data
        dataset: { source: data },
        tooltip: {
            trigger: 'axis'
        }
    };
    if (type === "pie") {
        return {
            style,

            option: {
                ...commonOption,
                series: [{
                    type: "pie",
                    label: {
                        position: 'outer',
                        alignTo: 'none',
                        bleedMargin: 5
                    },
                    encode: {
                        itemName: xDataKey,
                        value: yDataKey
                    }
                    // data: data.map(d => ({ name: d[xDataKey], value: d[yDataKey] }))data: data.map(d => ({ name: d[xDataKey], value: d[yDataKey] }))
                }]
            }
        };
    }
    // line and bars
    return {
        style,
        option: {
            ...commonOption,
            xAxis: {
                type: 'category' // or number?
            },
            yAxis: {},
            series: [{
                type,
                encode: { x: xDataKey, y: yDataKey}
            }]
        }
    };
});

const SimpleChart = loadingState(errorChartState(emptyChartState(
    toECharts(EChart)
)));
const ContainerDimensions = require('react-container-dimensions').default;

module.exports = (props) => (<div className="mapstore-widget-chart">
    <ContainerDimensions>
        <SimpleChart {...props} />
    </ContainerDimensions>
</div>);
