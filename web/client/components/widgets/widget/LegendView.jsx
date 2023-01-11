/*
 * Copyright 2018, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';

import { Grid, Row, Col } from 'react-bootstrap';
import WMSLegend from '../../TOC/fragments/WMSLegend';
import OpacitySlider from "../../TOC/fragments/OpacitySlider";
import Title from "../../TOC/fragments/Title";
import LayersTool from "../../TOC/fragments/LayersTool";

export default ({
    layers = [],
    updateProperty = () => {},
    legendProps = {},
    currentZoomLvl,
    disableOpacitySlider = false,
    disableVisibility = false,
    legendExpanded = false,
    scales,
    language,
    currentLocale
}) => {

    const renderOpacitySlider = (layer) => (
        !disableOpacitySlider && layer?.type !== '3dtiles' && <div
            className="mapstore-slider"
            onClick={(e) => { e.stopPropagation(); }}>
            <OpacitySlider
                opacity={layer.opacity}
                disabled={!layer.visibility}
                hideTooltip={false}
                onChange={opacity => updateProperty('opacity', opacity, layer.id)}/>
        </div>
    );

    return (<div className={"legend-widget"}>
        {layers.reverse().map((layer, index) => layer.visibility ? (<div key={index} className="widget-legend-toc">
            <div>
                <p><b>{layer.title}</b></p>
                <p>{layer.description}</p>
            </div>
            <WMSLegend
                node={{ ...layer }}
                currentZoomLvl={currentZoomLvl}
                scales={scales}
                language={language}
                {...legendProps} />
            {
            //renderOpacitySlider(layer)
            }
        </div>):null)}
    </div>);
};
