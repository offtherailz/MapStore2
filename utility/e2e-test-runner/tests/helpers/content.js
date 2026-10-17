/**
 * Payloads of dashboards and stories with some content, in the format MapStore saves, so
 * the suites that only read them do not have to build them through the editors.
 */

import { randomUUID } from 'node:crypto';

/** Dashboard with one text widget in its main view. */
function textDashboard(title) {
    const layoutId = randomUUID();
    const widgetId = randomUUID();

    return {
        widgets: [{
            id: widgetId,
            widgetType: 'text',
            title,
            text: `<p>${title}</p>`,
            layoutId,
            dataGrid: { w: 1, h: 1, x: 0, y: 0 }
        }],
        layouts: [{ id: layoutId, name: 'Main view', color: null, md: [{ w: 1, h: 1, x: 0, y: 0, i: widgetId }] }]
    };
}

/** Story made of title sections, one per title. */
function titledStory(titles) {
    return {
        type: 'cascade',
        sections: titles.map((title) => ({
            id: randomUUID(),
            type: 'title',
            title,
            cover: false,
            contents: [{
                id: randomUUID(),
                type: 'text',
                html: `<h1>${title}</h1>`,
                size: 'large',
                align: 'center',
                theme: '',
                background: { fit: 'cover', size: 'full', align: 'center' }
            }]
        })),
        settings: {}
    };
}

/** Plugins every context needs to show its map. */
const CONTEXT_BASE_PLUGINS = [
    {
        name: 'Map',
        cfg: {
            mapOptions: { openlayers: { attribution: { container: '#footer-attribution-container' } } },
            toolsOptions: { scalebar: { container: '#footer-scalebar-container' } },
            containerPosition: 'background'
        }
    },
    { name: 'Notifications' },
    { name: 'SecurityPopup' },
    { name: 'MapFooter', cfg: { containerPosition: 'footer' } },
    { name: 'FeedbackMask' }
];

/**
 * Context in the format the context creator saves.
 *
 * @param {object} [options]
 * @param {string} [options.windowTitle]
 * @param {object[]} [options.layers] layers of the context map (no remote background)
 * @param {object[]} [options.plugins] plugins added to the base ones, e.g. [{ name: 'TOC' }]
 */
function contextPayload({ windowTitle = 'E2E context', layers = [], plugins = [] } = {}) {
    return {
        windowTitle,
        mapConfig: {
            version: 2,
            map: {
                center: { x: 11.2, y: 43.4, crs: 'EPSG:4326' },
                maxExtent: [-20037508.34, -20037508.34, 20037508.34, 20037508.34],
                projection: 'EPSG:900913',
                units: 'm',
                zoom: 5,
                mapOptions: {},
                layers
            }
        },
        customVariablesEnabled: false,
        plugins: { desktop: [...CONTEXT_BASE_PLUGINS, ...plugins] },
        userPlugins: []
    };
}

/**
 * Context with the plugins of the standard map viewer, read from the served
 * localConfig.json, so that it renders like the viewer. A minimal context lacks the
 * containers some plugins rely on.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} options
 * @param {object[]} [options.layers]
 * @param {object} [options.cfg] plugin name -> cfg merged into the cfg of that plugin
 * @param {object[]} [options.plugins] plugins added to the viewer ones
 * @param {string[]} [options.exclude] names of viewer plugins left out
 */
async function viewerContextPayload(page, { layers = [], cfg = {}, plugins = [], exclude = [] } = {}) {
    const localConfig = await (await page.request.get('configs/localConfig.json')).json();
    const payload = contextPayload({ layers });
    payload.plugins.desktop = [
        ...localConfig.plugins.desktop
            .map((plugin) => typeof plugin === 'string' ? { name: plugin } : plugin)
            .filter(({ name }) => !exclude.includes(name))
            .map((plugin) => cfg[plugin.name] ? { ...plugin, cfg: { ...plugin.cfg, ...cfg[plugin.name] } } : plugin),
        ...plugins
    ];

    return payload;
}

/**
 * Annotations layer, as the annotations editor saves it: a marker on the given point and a
 * small triangle south of it, each styled by its own rule.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.description] HTML
 * @param {number[]} options.point [lon, lat]
 */
function annotationLayer({ title, description = '', point }) {
    const [lon, lat] = point;
    const marker = randomUUID();
    const triangle = randomUUID();
    const rule = (featureId, symbolizer) => ({
        name: '',
        filter: ['==', 'id', featureId],
        mandatory: false,
        ruleId: randomUUID(),
        symbolizers: [{ symbolizerId: randomUUID(), ...symbolizer }]
    });

    return {
        id: `annotations:${randomUUID()}`,
        type: 'vector',
        title,
        description,
        visibility: true,
        rowViewer: 'annotations',
        options: {},
        features: [
            {
                type: 'Feature',
                id: marker,
                properties: { id: marker, name: 'Point', annotationType: 'Point', geodesic: false },
                geometry: { type: 'Point', coordinates: [lon, lat] }
            },
            {
                type: 'Feature',
                id: triangle,
                properties: { id: triangle, name: 'Polygon', annotationType: 'Polygon', geodesic: false },
                geometry: { type: 'Polygon', coordinates: [[[lon - 1, lat - 2], [lon + 1, lat - 2], [lon, lat - 3], [lon - 1, lat - 2]]] }
            }
        ],
        style: {
            format: 'geostyler',
            body: {
                rules: [
                    rule(marker, {
                        kind: 'Icon',
                        image: { name: 'msMarkerIcon', args: [{ color: 'blue', shape: 'circle', glyph: 'comment' }] },
                        opacity: 1,
                        size: 46,
                        rotate: 0,
                        anchor: 'bottom'
                    }),
                    rule(triangle, { kind: 'Fill', color: '#dddddd', fillOpacity: 1, outlineColor: '#777777', outlineWidth: 1 })
                ]
            }
        }
    };
}

export { textDashboard, titledStory, contextPayload, viewerContextPayload, annotationLayer };
