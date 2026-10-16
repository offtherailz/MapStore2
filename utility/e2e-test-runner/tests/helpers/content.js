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

export { textDashboard, titledStory };
