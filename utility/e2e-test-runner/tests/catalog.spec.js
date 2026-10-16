import { test, expect, describeIfFeature } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { moveAwayFromTooltips } from './helpers/navigation.js';
import { FIXTURE_LAYER_NAME, FIXTURE_LAYER_TITLE, mapConfig, openMapViewer } from './helpers/map.js';

// Services come from profiles/geoserver/localConfig.e2e.geoserver.patch.json.
const SERVICES = {
    wfs: 'Local GeoServer WFS',
    csw: 'Local GeoServer CSW'
};

async function openCatalog(page, data) {
    const map = await data.map({ data: mapConfig([]) });

    await openMapViewer(page, map.id);
    await page.locator('button.ms-drawer-menu-button:has(.glyphicon-1-layer)').click();
    await moveAwayFromTooltips(page);
    await page.locator('button.toc-toolbar-button:has(.glyphicon-add-layer)').click();
    const catalog = page.locator('.ms-catalog-panel');
    await expect(catalog).toBeVisible({ timeout: 15000 });

    return catalog;
}

/** The service selector is a react-select: typing the title and confirming picks it. */
async function selectService(page, catalog, title) {
    await catalog.locator('.Select input[role="combobox"]').first().fill(title);
    await page.keyboard.press('Enter');
    await expect(catalog.locator('.Select-value-label').first()).toHaveText(title);
}

async function search(page, catalog, text) {
    await catalog.getByRole('textbox', { name: 'Search' }).fill(text);
    await page.keyboard.press('Enter');
}

function fixtureRecord(catalog) {
    return catalog.locator('.ms-catalog-card').filter({ hasText: FIXTURE_LAYER_NAME });
}

async function addFixtureToMap(page, catalog) {
    await fixtureRecord(catalog).first().locator('button:has(.glyphicon-plus)').first().click();
    await expect(page.locator('.ms-node-layer').filter({ hasText: FIXTURE_LAYER_TITLE })).toBeVisible({ timeout: 15000 });
}

describeIfFeature('geoserverIntegration', 'Catalog', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('A WFS layer is found and added to the map', async({ page, data }) => {
        const catalog = await openCatalog(page, data);

        await selectService(page, catalog, SERVICES.wfs);
        await search(page, catalog, FIXTURE_LAYER_TITLE);
        await expect(fixtureRecord(catalog)).toBeVisible({ timeout: 20000 });
        await addFixtureToMap(page, catalog);
    });

    test('CSW search works with plain text and with no text', async({ page, data }) => {
        const catalog = await openCatalog(page, data);

        await selectService(page, catalog, SERVICES.csw);

        await test.step('Plain text finds the fixture record', async() => {
            await search(page, catalog, 'e2e');
            await expect(fixtureRecord(catalog)).toBeVisible({ timeout: 20000 });
        });

        await test.step('An empty search lists the records', async() => {
            await search(page, catalog, '');
            await expect(fixtureRecord(catalog)).toBeVisible({ timeout: 20000 });
        });
    });
});
