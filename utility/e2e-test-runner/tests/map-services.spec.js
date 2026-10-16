import { test, expect, describeIfFeature } from './fixtures.js';
import { hasFeature, getServiceUrl } from './config.js';
import { login } from './helpers/auth.js';
import { FIXTURE_LAYER_NAME, fixtureLayer, mapConfig, openMapViewer } from './helpers/map.js';

// Backgrounds, place search and the 3D viewer reach remote services by default (OSM
// tiles, Nominatim). Here every one of them is configured on the local GeoServer, so the
// suite exercises the same features on data this repository owns.

const BACKGROUNDS = ['E2E background one', 'E2E background two'];

function backgroundLayer(id, title, visibility) {
    return fixtureLayer({ id, title, group: 'background', visibility, search: undefined, bbox: undefined });
}

/** Map with two local backgrounds and a place search on the fixture cities. */
function servicesMapConfig() {
    const config = mapConfig([
        backgroundLayer('e2e_background_one', BACKGROUNDS[0], true),
        backgroundLayer('e2e_background_two', BACKGROUNDS[1], false)
    ]);

    config.map.text_search_config = {
        override: true,
        services: [{
            type: 'wfs',
            name: 'E2E cities',
            displayName: '${properties.name}',
            subTitle: '${properties.category}',
            priority: 1,
            options: {
                url: `${getServiceUrl('geoserver')}/wfs`,
                typeName: FIXTURE_LAYER_NAME,
                queriableAttributes: ['name'],
                sortBy: 'name',
                maxFeatures: 5,
                srsName: 'EPSG:4326'
            }
        }]
    };

    return config;
}

/** The zoom level select in the status bar. */
function zoomSelect(page) {
    return page.locator('select').first();
}

describeIfFeature('geoserverIntegration', 'Map services', () => {
    test.beforeEach(async({ page, data }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
        const map = await data.map({ data: servicesMapConfig() });
        await openMapViewer(page, map.id);
    });

    test('The background selector switches between the map backgrounds', async({ page }) => {
        const selector = page.locator('.ms-background-selector');
        const preview = selector.locator('.ms-background-selector-preview img');

        await expect(preview).toHaveAttribute('alt', BACKGROUNDS[0]);
        await selector.locator('.ms-background-selector-preview').click();
        const entries = selector.locator('.ms-background-selector-list li');
        await expect(entries).toHaveCount(BACKGROUNDS.length);

        await entries.filter({ hasText: BACKGROUNDS[1] }).locator('.ms-text').click();
        await expect(entries.filter({ hasText: BACKGROUNDS[1] })).toHaveClass(/active/);
        await expect(entries.filter({ hasText: BACKGROUNDS[0] })).not.toHaveClass(/active/);
        await expect(preview).toHaveAttribute('alt', BACKGROUNDS[1]);
    });

    test('Place search finds a fixture city and zooms to it', async({ page }) => {
        const zoomBefore = Number(await zoomSelect(page).inputValue());

        await page.getByPlaceholder('Search by location name').fill('Rom');
        const result = page.locator('[class*="search-result"]').filter({ hasText: 'Roma' }).first();
        await expect(result).toBeVisible({ timeout: 20000 });
        await expect(result).toContainText('capital');

        await result.click();
        await expect.poll(async() => Number(await zoomSelect(page).inputValue()), { timeout: 15000 })
            .toBeGreaterThan(zoomBefore);
    });

    test('The map switches to the 3D viewer and back', async({ page }) => {
        test.skip(!hasFeature('cesium'), 'Requires feature cesium');
        const toggle = page.locator('button:has(.glyphicon-3d)');

        await toggle.click();
        await expect(page.locator('.cesium-widget canvas')).toBeVisible({ timeout: 30000 });

        await toggle.click();
        await expect(page.locator('.cesium-widget canvas')).toHaveCount(0, { timeout: 30000 });
        await expect(page.locator('.ol-viewport')).toBeVisible();
    });
});
