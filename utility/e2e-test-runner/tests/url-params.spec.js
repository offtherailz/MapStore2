import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { config, hasFeature, getServiceUrl } from './config.js';
import { login } from './helpers/auth.js';
import { openAppTarget, resolveAppUrl } from './helpers/navigation.js';
import { fixtureLayer, mapConfig, openLayersDrawer, FIXTURE_LAYER_NAME, FIXTURE_LAYER_TITLE } from './helpers/map.js';

// Shared links and external pages open MapStore with the map view in the URL (GET) or
// posted to rest/config/setParams (POST), which stores them and redirects to the page.
//
// The parameters are applied when the first layer of the map loads, so the map needs a
// layer that actually loads: a background on the local GeoServer.

function linkedMap(data) {
    const background = fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined });

    return data.map({ data: mapConfig([background]) });
}

/** The zoom level select in the status bar. */
function zoomSelect(page) {
    return page.locator('select').first();
}

/**
 * Opens a link as a new visit: from outside the application, so the page is loaded with
 * the parameters instead of reaching them through an in-app hash change.
 */
async function openLink(page, target) {
    await page.goto('about:blank');
    await openAppTarget(page, target);
}

async function expectZoom(page, zoom) {
    await expect(page.locator('.ms-drawer-menu-button')).toBeVisible({ timeout: 30000 });
    await expect.poll(async() => Number(await zoomSelect(page).inputValue()), { timeout: 20000 }).toBe(zoom);
}

describeIfFeature('geoserverIntegration', 'Opening MapStore from a link', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('Center and zoom in the URL set the map view', fromScenario('Maps — Map viewer query parameter API'), async({ page, data }) => {
        const map = await linkedMap(data);

        await openAppTarget(page, `#/viewer/${map.id}?center=12.4964,41.9028&zoom=10`);
        await expectZoom(page, 10);
    });

    test('A bounding box in the URL zooms the map to it', async({ page, data }) => {
        const map = await linkedMap(data);

        // Around Rome: much smaller than the saved view.
        await openAppTarget(page, `#/viewer/${map.id}?bbox=12.40,41.85,12.60,41.95`);
        await expect(page.locator('.ms-drawer-menu-button')).toBeVisible({ timeout: 30000 });
        await expect.poll(async() => Number(await zoomSelect(page).inputValue()), { timeout: 20000 }).toBeGreaterThan(9);
    });

    test('Parameters posted by an external page open the map view', async({ page, data }) => {
        const map = await linkedMap(data);
        const action = new URL('rest/config/setParams', resolveAppUrl('#/')).toString();

        // The external page: a plain form posting to MapStore, as an embedding site does.
        await page.goto('about:blank');
        await page.setContent(`<form method="post" action="${action}">
            <input name="page" value="${resolveAppUrl(`#/viewer/${map.id}`)}">
            <input name="center" value="12.4964,41.9028">
            <input name="zoom" value="9">
            <button type="submit">Open</button>
        </form>`);
        await page.getByRole('button', { name: 'Open' }).click();

        await expect(page).toHaveURL(new RegExp(`#/viewer/${map.id}\\?queryParamsID=`), { timeout: 30000 });
        await expectZoom(page, 9);
        expect(page.url().startsWith(config.baseURL.replace(/\/?$/, '/'))).toBe(true);
    });

    test('Camera parameters in the URL open the map in 3D', fromScenario('Maps — Map viewer query parameter for Cesium map'), async({ page, data }) => {
        test.skip(!hasFeature('cesium'), 'Requires feature cesium');
        const map = await linkedMap(data);

        await openAppTarget(page, `#/viewer/${map.id}?center=12.4964,41.9028&zoom=12&heading=0&pitch=-1.5707963267948966&roll=0`);
        await expect(page.locator('.cesium-widget canvas')).toBeVisible({ timeout: 30000 });
    });

    test('A marker in the URL centres the map at the given zoom', fromScenario('Maps — Map viewer query parameter for Cesium map'), async({ page, data }) => {
        const map = await linkedMap(data);

        await openAppTarget(page, `#/viewer/${map.id}?marker=12.4964,41.9028&zoom=8`);
        await expectZoom(page, 8);
    });

    test('Layers added from the URL are identified with a filter', fromScenario('Maps — Map viewer query parameter for Cesium map'), async({ page, data }) => {
        const map = await linkedMap(data);

        await openLink(page, `#/viewer/${map.id}?addLayers=${FIXTURE_LAYER_NAME}&mapInfo=${FIXTURE_LAYER_NAME}&mapInfoFilter=name='Napoli'`);
        await expect(page.getByText('Napoli').first()).toBeVisible({ timeout: 30000 });
        await openLayersDrawer(page);
        await expect(page.locator('.ms-node-layer').filter({ hasText: FIXTURE_LAYER_TITLE })).toBeVisible();
    });

    test('A point in the URL opens the feature info there', fromScenario('Maps — Map viewer query parameter for Cesium map'), async({ page, data }) => {
        const map = await data.map({ data: mapConfig([
            fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined }),
            fixtureLayer()
        ]) });

        // The simplified syntax takes longitude first.
        await openLink(page, `#/viewer/${map.id}?featureInfo=12.4964,41.9028`);
        await expect(page.getByText('Roma').first()).toBeVisible({ timeout: 30000 });
    });

    test('A GeoJSON file in the URL actions is added as a layer', fromScenario('Maps — Geojson layer from URL params'), async({ page, data }) => {
        const map = await linkedMap(data);
        const geojson = `${getServiceUrl('geoserver')}/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=${FIXTURE_LAYER_NAME}&outputFormat=application/json&srsName=EPSG:4326`;
        const actions = [{ type: 'CATALOG:ADD_LAYERS_FROM_CATALOGS', layers: ['E2E GeoJSON from URL'], sources: [{ type: 'GEOJSON', url: geojson }] }];

        await openLink(page, `#/viewer/${map.id}?actions=${encodeURIComponent(JSON.stringify(actions))}`);
        await openLayersDrawer(page);
        await expect(page.locator('.ms-node-layer').filter({ hasText: 'E2E GeoJSON from URL' })).toBeVisible({ timeout: 30000 });
    });

    test('Layers of a link followed inside the application are added once', async({ page, data }) => {
        // The parameters are applied twice when the viewer is reached by a hash change,
        // so the layer is added two times. To be fixed in the query parameters handling.
        test.fail();
        const map = await linkedMap(data);

        await openAppTarget(page, `#/viewer/${map.id}`);
        await expect(page.locator('.ms-drawer-menu-button')).toBeVisible({ timeout: 30000 });
        await page.evaluate((hash) => { window.location.hash = hash; }, `#/viewer/${map.id}?addLayers=${FIXTURE_LAYER_NAME}`);
        await openLayersDrawer(page);
        await expect(page.locator('.ms-node-layer').filter({ hasText: FIXTURE_LAYER_TITLE }).first()).toBeVisible({ timeout: 30000 });
        // Lets a second addition happen before counting.
        await page.waitForTimeout(3000);
        await expect(page.locator('.ms-node-layer').filter({ hasText: FIXTURE_LAYER_TITLE })).toHaveCount(1);
    });
});
