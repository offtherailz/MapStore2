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

export { textDashboard, titledStory, contextPayload };
