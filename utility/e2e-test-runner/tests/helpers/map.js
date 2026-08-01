/**
 * Map viewer helpers.
 *
 * The layer used by the map suites is the one published by the `geoserver` profile
 * (profiles/geoserver/seed-geoserver.sh) from the PostGIS fixture, so the suites never
 * depend on data owned by someone else.
 */

import { expect } from '@playwright/test';
import { getServiceUrl } from '../config.js';
import { openAppTarget, moveAwayFromTooltips } from './navigation.js';

const FIXTURE_LAYER_NAME = 'e2e:e2e_points';
const FIXTURE_LAYER_TITLE = 'e2e_points';

/** Cities of the PostGIS fixture, in descending population order. */
const FIXTURE_FEATURES = ['Roma', 'Milano', 'Napoli', 'Firenze', 'Genova'];

/** Extent of the fixture cities, as published by GeoServer. */
const FIXTURE_LAYER_BBOX = {
    crs: 'EPSG:4326',
    bounds: { minx: 8.9463, miny: 40.8518, maxx: 14.2681, maxy: 45.4642 }
};

/**
 * WMS layer descriptor for the fixture layer.
 *
 * `search` is what enables the attribute table, and `bbox` is what enables "zoom to
 * layer": without an extent the viewer hides that button.
 */
function fixtureLayer(overrides = {}) {
    const geoserver = getServiceUrl('geoserver');

    return {
        type: 'wms',
        url: `${geoserver}/wms`,
        name: FIXTURE_LAYER_NAME,
        title: FIXTURE_LAYER_TITLE,
        visibility: true,
        search: { type: 'wfs', url: `${geoserver}/wfs` },
        bbox: FIXTURE_LAYER_BBOX,
        ...overrides
    };
}

/**
 * Map configuration centred on the fixture features.
 *
 * @param {object[]} [layers] defaults to the single fixture layer
 */
function mapConfig(layers = [fixtureLayer()]) {
    return {
        version: 2,
        map: {
            projection: 'EPSG:900913',
            center: { x: 1250000, y: 5200000, crs: 'EPSG:900913' },
            zoom: 5,
            layers
        }
    };
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} id resource id of a MAP
 */
async function openMapViewer(page, id) {
    await openAppTarget(page, `#/viewer/${id}`);
    await expect(page.locator('.ms-drawer-menu-button')).toBeVisible({ timeout: 30000 });
}

/**
 * Opens the layers drawer holding the table of contents.
 *
 * The drawer state is part of the saved map, so it can already be open: clicking the
 * button again would be intercepted by the open drawer.
 */
async function openLayersDrawer(page) {
    const firstNode = page.locator('.ms-node-layer').first();

    // A closed drawer is rendered off canvas, so the nodes report as visible while
    // sitting at a negative x: only their position tells the drawer state apart.
    const box = await firstNode.boundingBox().catch(() => null);

    if (!box || box.x < 0) {
        await page.locator('button.ms-drawer-menu-button:has(.glyphicon-1-layer)').click();
    }

    await moveAwayFromTooltips(page);
    await expect(firstNode).toBeVisible({ timeout: 15000 });
    await expect.poll(async() => (await firstNode.boundingBox())?.x ?? -1, { timeout: 15000 }).toBeGreaterThanOrEqual(0);
}

/**
 * Selects a layer node, which is what reveals the layer toolbar.
 *
 * @returns {import('@playwright/test').Locator} the node
 */
async function selectLayerNode(page, title = FIXTURE_LAYER_TITLE) {
    const node = page.locator('.ms-node-layer').filter({ hasText: title }).first();

    await node.click();
    await moveAwayFromTooltips(page);

    return node;
}

/**
 * Layer toolbar button. Buttons carry no accessible name, so the glyph identifies them.
 *
 * @param {string} glyph e.g. 'wrench', 'features-grid', 'trash', 'zoom-to'
 */
function layerToolbarButton(page, glyph) {
    return page.locator(`button.toc-toolbar-button:has(.glyphicon-${glyph})`);
}

export {
    FIXTURE_LAYER_NAME,
    FIXTURE_LAYER_TITLE,
    FIXTURE_FEATURES,
    fixtureLayer,
    mapConfig,
    openMapViewer,
    openLayersDrawer,
    selectLayerNode,
    layerToolbarButton
};
