/**
* Copyright 2019, GeoSolutions Sas.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

import React, { useEffect} from 'react';
import { createSelector } from 'reselect';
import { connect } from 'react-redux';

import {getSelectedLayers} from '../selectors/layers';

import { createPlugin } from '../utils/PluginsUtils';

// **********************************************************
// NOTES:
// **********************************************************
// In this prototype everything is in one file, there are some missing features.
// Please separate and implement missing features.
// This is only a prototype, the only problems not solved yet:
// - is how to render a draggable handle on map. Probably a custom OL control or using postcompose of the map.
// - all state handling in a proper reducer (to handle radius, settings, mode etc...)
// - TOC part
// - config part (mockup needed)
// - see TODO in the file
// **********************************************************
// **********************************************************



// **********************************************************
// EFFECT SUPPORT COMPONENT
// **********************************************************
const verticalCut = (layer, { getSize }) => {
    layer.on('precompose', function(event) {
        let ctx = event.context;
        const width = getSize();
        ctx.save();
        ctx.beginPath();
        ctx.rect(width, 0, ctx.canvas.width - width, ctx.canvas.height);
        ctx.clip();
    });

    layer.on('postcompose', function(event) {
        let ctx = event.context;
        // maybe draw line separator?
        ctx.restore();
    });

};
const circleCut = (layer, {getPosition, radius = 100}) => {

    // before rendering the layer, do some clipping
    layer.on('precompose', function(event) {
        let ctx = event.context;
        let pixelRatio = event.frameState.pixelRatio;
        ctx.save();
        ctx.beginPath();
        const mousePosition = getPosition();
        if (mousePosition) {
            // only show a circle around the mouse
            ctx.arc(mousePosition[0] * pixelRatio, mousePosition[1] * pixelRatio,
                radius * pixelRatio, 0, 2 * Math.PI);
            ctx.lineWidth = 5 * pixelRatio;
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.stroke();
        }
        ctx.clip();
    });

    // after rendering the layer, restore the canvas context
    layer.on('postcompose', function(event) {
        let ctx = event.context;
        ctx.restore();
    });

};


const EffectSupport = ({map, layer: layerId, type, getSize, getPosition}) => {
    let layer;
    useEffect(() => {
        // for the moment take only the layer on top
        const layers = map.getLayers().getArray();
        layer = layers[layers.length - 1];
        /* TODO: find the selected layer from OL map.
        map.getLayers().forEach((l) => {
            if (l.get('msId') === layerId) {
                layer = l;
            }
        }, this);
        */
        if (layer) {
            switch (type) {
            case "cut":
                verticalCut(layer, { getSize });
                // TODO: implement horizontal
                break;
            case "circle":
                circleCut(layer, {getPosition});
                // TODO: radius
                break;
            default:
                break;
            }
        }
    }, [layerId]);
    // TODO: detach events on unmount.
    return null;
};

// **********************************************************
// SWIPE SUPPORT COMPONENT
// **********************************************************
let size;

const addHandle = (map, setSize) => {
    // TODO: for the moment on mouse move, it should be draggable
    const container = map.getTargetElement();
    let mousePosition = null;

    container.addEventListener('mousemove', (event) => {
        mousePosition = map.getEventPixel(event);
        setSize(mousePosition[0]);
        // drawVerticalHandler
        map.render();
    });

    container.addEventListener('mouseout', () => {
        mousePosition = null;
        map.render();
    });
    // TODO: add draggable handler on the map

};

const sizeHandler = {
    setSize: (s) => {
        size = s;
    },
    getSize: () => {
        return size;
    }
};

const SwipeSupport = ({ layer, active, map}) => {
    // TODO: add handler to the map and support drag and drop
    useEffect(() => {
        addHandle(map, sizeHandler.setSize);
    }, []);
    if (layer && active) {
        return (<React.Fragment>
            <EffectSupport type="cut" direction="vertical" map={map} layer={layer} getSize={sizeHandler.getSize} />
        </React.Fragment>);
    }
    // TODO: detach events on umount
    return null;
};

// **********************************************************
// SPYGLASS SUPPORT COMPONENT
// **********************************************************

let position;
const positionHandler = {
    setPosition: (p) => {
        position = p;
    },
    getPosition: () => {
        return position;
    }
};

const SpyGlassSupport = ({ layer, active, map }) => {
    // TODO: add handler to the map and support drag and drop
    useEffect(() => {
        const container = map.getTargetElement();
        let mousePosition = null;

        container.addEventListener('mousemove', (event) => {
            mousePosition = map.getEventPixel(event);
            positionHandler.setPosition(mousePosition);
            // drawVerticalHandler
            map.render();
        });

        container.addEventListener('mouseout', () => {
            mousePosition = null;
            map.render();
        });
        // TODO: detach events on unmount
    }, []);
    if (layer && active) {
        return (<React.Fragment>
            <EffectSupport type="circle" direction="vertical" map={map} layer={layer} getPosition={positionHandler.getPosition} />
        </React.Fragment>);
    }
    return null;
};
// **********************************************************
// SWIPE PLUGIN COMPONENT
// **********************************************************
// TODO: switch between spyglass and swipe, implement spyglass (See original spike)
const Support = connect(
    createSelector(
        [getSelectedLayers],
        (selectedLayers) => ({
            mode: 'spy', // TODO: implement switch mode
            layer: selectedLayers[0],
            active: selectedLayers.length === 1 // TODO: handle tool activation via TOC
        })
    )
)((mode, ...props) => {
    switch (mode) {
        case "spy":
            return <SpyGlassSupport {...props}/>
            break;
        case
            <SwipeSupport {...props}/>;
            break;
        default:
            break;
    }
});

/**
 * Swipe. Add to the TOC the possibility to select a layer for Swipe.
 * @memberof plugins
 * @requires plugins.Swipe
 */
export default createPlugin('Swipe', {
    component: () => <div></div>, // TODO: settings panel
    containers: {
        TOC: {
            name: "swipe",
            button: {}
        },
        Map: {
            Component: Support
        }
    }

});
