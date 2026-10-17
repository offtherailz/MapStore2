/**
 * WFS-T client for the editable tables of the PostGIS fixture (e2e_edit, e2e_stats).
 *
 * GeoServer accepts anonymous transactions on those tables only (see
 * profiles/geoserver/seed-geoserver.sh). Tests add the rows they edit, with a name of
 * their own, and remove them afterwards, so they never depend on each other.
 */

import { getServiceUrl } from '../config.js';

const NAMESPACES = 'xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc" '
    + 'xmlns:gml="http://www.opengis.net/gml" xmlns:e2e="http://e2e"';

function escapeXml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function transaction(body) {
    const response = await fetch(`${getServiceUrl('geoserver')}/wfs`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: `<wfs:Transaction service="WFS" version="1.1.0" ${NAMESPACES}>${body}</wfs:Transaction>`
    });
    const text = await response.text();

    if (!response.ok || /ExceptionReport/.test(text)) {
        throw new Error(`WFS transaction failed: ${text}`);
    }

    return text;
}

/**
 * @param {string} table e2e_edit or e2e_stats
 * @param {object} properties attribute values
 * @param {number[]} [point] [lon, lat], for tables with a geometry
 */
async function insertFeature(table, properties, point) {
    const attributes = Object.entries(properties)
        .map(([name, value]) => `<e2e:${name}>${escapeXml(value)}</e2e:${name}>`)
        .join('');
    const geometry = point
        ? `<e2e:geom><gml:Point srsName="EPSG:4326"><gml:pos>${point[1]} ${point[0]}</gml:pos></gml:Point></e2e:geom>`
        : '';

    await transaction(`<wfs:Insert><e2e:${table}>${attributes}${geometry}</e2e:${table}></wfs:Insert>`);
}

/** Removes the rows of the table whose attribute equals the value. */
async function deleteFeatures(table, attribute, value) {
    await transaction(`<wfs:Delete typeName="e2e:${table}"><ogc:Filter><ogc:PropertyIsEqualTo>`
        + `<ogc:PropertyName>${attribute}</ogc:PropertyName><ogc:Literal>${escapeXml(value)}</ogc:Literal>`
        + '</ogc:PropertyIsEqualTo></ogc:Filter></wfs:Delete>');
}

/** Returns the rows of the table whose attribute equals the value, as GeoJSON features. */
async function findFeatures(table, attribute, value) {
    const params = new URLSearchParams({
        service: 'WFS',
        version: '1.1.0',
        request: 'GetFeature',
        typeName: `e2e:${table}`,
        outputFormat: 'application/json',
        CQL_FILTER: `${attribute}='${String(value).replace(/'/g, "''")}'`
    });
    const response = await fetch(`${getServiceUrl('geoserver')}/wfs?${params}`);

    return (await response.json()).features;
}

export { insertFeature, deleteFeatures, findFeatures };
