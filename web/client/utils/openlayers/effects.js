/*
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const SWIPE = "swipe";
const SPY = "spy";

function applySpy(map, layer, effect) {
    const {radius = 100} = effect;
    const container = map.getTargetElement();
    let mousePosition = null;

    container.addEventListener('mousemove', function(event) {
        mousePosition = map.getEventPixel(event);
        map.render();
    });

    container.addEventListener('mouseout', function() {
        mousePosition = null;
        map.render();
    });
    // before rendering the layer, do some clipping
    layer.on('precompose', function(event) {
        let ctx = event.context;
        let pixelRatio = event.frameState.pixelRatio;
        ctx.save();
        ctx.beginPath();
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


    // after rendering the layer, restore the canvas context
    layer.on('postcompose', function (event) { // https://github.com/openlayers/openlayers/issues/10323 postrender with OL v6
        let ctx = event.context;
        ctx.restore();
    });
}

function applySwipe(map, layer, effect, props) {
    let value = 50;
    layer.on('precompose', function (event) {
        let ctx = event.context;
        let width = ctx.canvas.width * (value / 100);

        ctx.save();
        ctx.beginPath();
        ctx.rect(width, 0, ctx.canvas.width - width, ctx.canvas.height);
        ctx.clip();
    });

    layer.on('postcompose', function (event) {
        let ctx = event.context;
        ctx.restore();
    });
}

export function applyEffect(map, layer, effect, props) {
    switch (effect.type) {
    case SWIPE:
        applySwipe(map, layer, effect, props);
        break;
    case SPY:
        applySpy(map, layer, effect, props);
        break;
    default:
        break;

    }
}

export function applyEffects(map, layer, effects = [], props) {
    return effects.map(effect => applyEffect(map, layer, effect, props));
}
