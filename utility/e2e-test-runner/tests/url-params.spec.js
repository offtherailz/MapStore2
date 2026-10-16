import { test, expect, describeIfFeature } from './fixtures.js';
import { config, hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { openAppTarget, resolveAppUrl } from './helpers/navigation.js';
import { fixtureLayer, mapConfig } from './helpers/map.js';

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

async function expectZoom(page, zoom) {
    await expect(page.locator('.ms-drawer-menu-button')).toBeVisible({ timeout: 30000 });
    await expect.poll(async() => Number(await zoomSelect(page).inputValue()), { timeout: 20000 }).toBe(zoom);
}

describeIfFeature('geoserverIntegration', 'Opening MapStore from a link', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('Center and zoom in the URL set the map view', async({ page, data }) => {
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
});
