/**
 * GeoServer REST client for the style editor suites.
 *
 * The style editor calls the REST API of the GeoServer of the layer from the browser.
 * In a real deployment that GeoServer shares the authentication of MapStore; in the E2E
 * stack the tests add the GeoServer administrator credentials to those calls instead.
 */

import { getServiceUrl } from '../config.js';

const WORKSPACE = 'e2e';

/** Styles published by profiles/geoserver/seed-geoserver.sh: they are never removed. */
const SEEDED_STYLES = ['e2e_points_by_category'];

function authorization() {
    const user = process.env.GEOSERVER_ADMIN_USER || 'admin';
    const password = process.env.GEOSERVER_ADMIN_PASSWORD || 'geoserver';

    return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
}

async function rest(method, path, body, contentType = 'application/json') {
    const response = await fetch(`${getServiceUrl('geoserver')}/rest${path}`, {
        method,
        headers: {
            Authorization: authorization(),
            ...(method === 'GET' ? { Accept: 'application/json' } : {}),
            ...(body ? { 'Content-Type': contentType } : {})
        },
        body
    });
    if (!response.ok) {
        throw new Error(`GeoServer REST ${method} ${path} failed: ${response.status} ${await response.text()}`);
    }
    const text = await response.text();

    return text && /json/.test(response.headers.get('content-type') || '') ? JSON.parse(text) : text;
}

/** Lets the style editor of the page call the GeoServer REST API as administrator. */
async function authorizeGeoServerRest(page) {
    await page.route(`${getServiceUrl('geoserver')}/rest/**`, (route) =>
        route.continue({ headers: { ...route.request().headers(), authorization: authorization() } }));
}

/**
 * Publishes an SLD in the e2e workspace and adds it to the styles of a layer.
 *
 * @param {string} layer layer name, without workspace
 * @param {string} name style name
 * @param {string} sld style body
 */
async function addLayerStyle(layer, name, sld) {
    await rest('POST', `/workspaces/${WORKSPACE}/styles?name=${name}`, sld, 'application/vnd.ogc.sld+xml');
    await rest('POST', `/layers/${WORKSPACE}:${layer}/styles`, JSON.stringify({ style: { name: `${WORKSPACE}:${name}` } }));
}

async function setDefaultStyle(layer, name) {
    await rest('PUT', `/layers/${WORKSPACE}:${layer}`, JSON.stringify({ layer: { defaultStyle: { name: `${WORKSPACE}:${name}` } } }));
}

/** @returns {Promise<string[]>} names of the styles of a layer, default style excluded */
async function layerStyles(layer) {
    const { layer: info } = await rest('GET', `/layers/${WORKSPACE}:${layer}.json`);
    const styles = info.styles?.style;

    return (Array.isArray(styles) ? styles : styles ? [styles] : []).map(({ name }) => name.replace(`${WORKSPACE}:`, ''));
}

async function styleBody(name) {
    return rest('GET', `/workspaces/${WORKSPACE}/styles/${name}.sld`);
}

/**
 * Removes every style of the e2e workspace not published by the seed, the temporary
 * ones of the style editor included, and restores the default style of a layer.
 */
async function resetStyles(layer) {
    const { styles } = await rest('GET', `/workspaces/${WORKSPACE}/styles.json`);
    const names = (styles?.style || []).map(({ name }) => name).filter((name) => !SEEDED_STYLES.includes(name));
    for (const name of names) {
        await rest('DELETE', `/workspaces/${WORKSPACE}/styles/${name}?purge=true&recurse=true`);
    }
    await rest('PUT', `/layers/${WORKSPACE}:${layer}`, JSON.stringify({ layer: { defaultStyle: { name: 'point' } } }));
}

export { authorizeGeoServerRest, addLayerStyle, setDefaultStyle, layerStyles, styleBody, resetStyles };
