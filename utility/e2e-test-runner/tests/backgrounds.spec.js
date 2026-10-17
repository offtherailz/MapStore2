import { test, expect, describeIfFeature, fromScenario, THUMBNAIL_DATA_URI } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { fixtureLayer, mapConfig, openMapViewer } from './helpers/map.js';
import { moveAwayFromTooltips } from './helpers/navigation.js';

// The local WMS service comes from profiles/geoserver/localConfig.e2e.geoserver.patch.json.
const WMS_SERVICE = 'Local GeoServer WMS';

function backgroundMap(data) {
    return data.map({ data: mapConfig([fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined })]) });
}

/** Opens the list of the background selector, if closed. */
async function openBackgrounds(page) {
    const selector = page.locator('.ms-background-selector');

    if (!await selector.getByText('Backgrounds').isVisible()) {
        await selector.locator('.ms-background-selector-preview').click();
    }
    await expect(selector.getByText('Backgrounds')).toBeVisible();

    return selector;
}

/** Opens the catalog from the table of contents, which is empty in these maps. */
async function openCatalog(page) {
    const addLayer = page.locator('button.toc-toolbar-button:has(.glyphicon-add-layer)');

    // A closed drawer is rendered off canvas: only the position tells it apart.
    const box = await addLayer.boundingBox().catch(() => null);
    if (!box || box.x < 0) {
        await page.locator('button.ms-drawer-menu-button:has(.glyphicon-1-layer)').click();
    }
    await moveAwayFromTooltips(page);
    await addLayer.click();
}

async function selectService(page, catalog, title) {
    await catalog.locator('.Select input[role="combobox"]').first().fill(title);
    await page.keyboard.press('Enter');
    await expect(catalog.locator('.Select-value-label').first()).toHaveText(title);
}

describeIfFeature('geoserverIntegration', 'Backgrounds', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('A WMS layer is added as background with its own title and thumbnail, and another one is removed', fromScenario(
        'Maps/Options/Backgrounds — Add a map background (@GH-11883)',
        'Maps/Options/Backgrounds — Remove a map background'
    ), async({ page, data }) => {
        const map = await backgroundMap(data);

        await openMapViewer(page, map.id);
        let selector = await openBackgrounds(page);
        await selector.locator('button:has(.glyphicon-plus)').click();
        const catalog = page.locator('.ms-catalog-panel');
        await selectService(page, catalog, WMS_SERVICE);
        await catalog.locator('.ms-catalog-card').filter({ hasText: 'e2e:e2e_events' }).locator('button:has(.glyphicon-plus)').click();

        const dialog = page.getByRole('dialog').filter({ hasText: 'Add New Background' });
        await dialog.locator('input[type="file"]').setInputFiles({
            name: 'thumbnail.png',
            mimeType: 'image/png',
            buffer: Buffer.from(THUMBNAIL_DATA_URI.split(',')[1], 'base64')
        });
        await dialog.getByRole('textbox').first().fill('E2E events background');
        await dialog.getByRole('button', { name: 'Add', exact: true }).click();
        await expect(dialog).toBeHidden();
        await catalog.locator('button:has(.glyphicon-1-close)').first().click();

        selector = await openBackgrounds(page);
        await expect(selector.getByText('E2E events background', { exact: true })).toBeVisible();
        // The new background becomes the current one, shown by the preview with its thumbnail.
        await expect(selector.locator('.ms-background-selector-preview img')).toHaveAttribute('src', /^(data:image\/png|blob:)/);
        const getMap = page.waitForRequest((r) => /request=GetMap/i.test(r.url()) && r.url().includes('e2e_events'));
        await page.mouse.move(640, 300);
        await page.mouse.wheel(0, -200);
        await getMap;

        selector = await openBackgrounds(page);
        await selector.getByText('E2E background', { exact: true }).locator('xpath=ancestor::*[.//button][1]').locator('button:has(.glyphicon-trash)').click();
        await page.getByRole('dialog').getByRole('button', { name: /Confirm|Delete|Yes/ }).last().click();
        selector = await openBackgrounds(page);
        await expect(selector.getByText('E2E background', { exact: true })).toHaveCount(0);
        await expect(selector.getByText('E2E events background')).toBeVisible();
    });

    test('The catalog keeps its default service after adding backgrounds', fromScenario('Maps/Options/Catalog — Default catalog changes after the catalog is opened from the background tool (@GH-10486)'), async({ page, data }) => {
        const map = await backgroundMap(data);
        const catalog = page.locator('.ms-catalog-panel');

        await openMapViewer(page, map.id);
        await openCatalog(page);
        await expect(catalog.locator('.Select-value-label').first()).toHaveText(WMS_SERVICE);
        await catalog.locator('button:has(.glyphicon-1-close)').first().click();

        const selector = await openBackgrounds(page);
        await selector.locator('button:has(.glyphicon-plus)').click();
        await expect(catalog.locator('.Select-value-label').first()).toHaveText('Default Backgrounds');
        await catalog.locator('button:has(.glyphicon-1-close)').first().click();

        await openCatalog(page);
        await expect(catalog.locator('.Select-value-label').first()).toHaveText(WMS_SERVICE);
    });
});
