import React from 'react';
import ReactECharts from 'echarts-for-react';

// maybe we can use the lib directly
export default function({ option, style, className }) {

    return (
        <ReactECharts option={option} style={style} className={className} />

    );
}
