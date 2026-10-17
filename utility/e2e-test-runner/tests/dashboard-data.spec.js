import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { fixtureLayer, mapConfig, FIXTURE_FEATURES, FIXTURE_LAYER_TITLE } from './helpers/map.js';
import { openDashboard, addWidget, wizardNext, saveWidget, selectComboByLabel, pickFixtureLayer } from './helpers/dashboard.js';

async function saveWithTitle(page, title) {
    await page.getByText('Title', { exact: true }).locator('xpath=following::input[1]').fill(title);
    await saveWidget(page);
}

describeIfFeature('geoserverIntegration', 'Dashboard widget data', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('The data downloaded from a table widget follow its quick filter', fromScenario('Dashboard/Widget — Exporting data from Table Widget with a QuickFilters'), async({ page, data }) => {
        // The Download Data of the widget sends its WFS query without the quick filter,
        // so every feature is exported. To be fixed in the table widget export.
        test.fail();
        const dashboard = await data.dashboard();
        const map = await data.map({ data: mapConfig([fixtureLayer()]) });

        await openDashboard(page, dashboard.id);
        await addWidget(page, 'Table');
        await pickFixtureLayer(page, FIXTURE_LAYER_TITLE);
        await wizardNext(page);
        await wizardNext(page);
        await saveWithTitle(page, 'E2E downloadable table');
        const card = page.locator('.mapstore-widget-card').filter({ has: page.locator('.react-grid-Container') }).first();
        await expect(card.getByText(`${FIXTURE_FEATURES.length} Items`)).toBeVisible({ timeout: 30000 });

        // The quick filters of a table appear once another widget depends on it.
        await addWidget(page, 'Map');
        await page.getByText(map.name, { exact: true }).first().click();
        await wizardNext(page);
        await page.locator('button:has(.glyphicon-unplug)').filter({ visible: true }).first().click();
        await wizardNext(page);
        await saveWithTitle(page, 'E2E dependent map');
        // The quick filter of the name column, the second one of the filter row.
        await card.locator('.react-grid-HeaderRow').nth(1).locator('input[type="text"]').nth(1).fill('Roma');
        await expect(card.getByText('1 Item', { exact: true })).toBeVisible({ timeout: 30000 });

        await card.locator('button:has(.glyphicon-option-vertical)').click();
        await page.getByRole('menuitem', { name: 'Download Data' }).click();
        const panel = page.locator('.modal-dialog').filter({ hasText: 'Export Data' }).last();
        await panel.locator('.Select-control .Select-arrow-zone').first().click();
        await page.locator('.Select-option').filter({ hasText: /^CSV$/ }).click();
        const download = page.waitForEvent('download');
        await panel.getByRole('button', { name: 'Export' }).click();
        const csv = Buffer.concat(await (await (await download).createReadStream()).toArray()).toString();
        expect(csv).toContain('Roma');
        expect(csv).not.toContain('Milano');
    });

    test('A widget is filtered by an area drawn in its builder', fromScenario('Dashboard/Widget — Filtering capabilities for widgets'), async({ page, data }) => {
        const dashboard = await data.dashboard();

        await openDashboard(page, dashboard.id);
        await addWidget(page, 'Counter');
        await pickFixtureLayer(page, FIXTURE_LAYER_TITLE);
        await wizardNext(page);
        await selectComboByLabel(page, 'Use', 'population');
        await selectComboByLabel(page, 'Operation', 'SUM');
        await expect(page.getByText('5935000').first()).toBeVisible({ timeout: 30000 });

        await page.locator('button:has(.glyphicon-filter)').filter({ visible: true }).first().click();
        await expect(page.getByText('Attribute filter')).toBeVisible();
        await expect(page.getByText('Area of interest')).toBeVisible();
        // A map opens next to the filter to draw the area on.
        const map = page.locator('.ol-viewport').filter({ visible: true }).first();
        await expect(map).toBeVisible({ timeout: 20000 });
        const area = page.locator('.panel').filter({ hasText: 'Area of interest' }).last();
        await area.getByText('Filter type', { exact: true }).locator('xpath=following::*[@role="combobox"][1]').click();
        await page.locator('.rw-list-option').filter({ visible: true }).filter({ hasText: /^Rectangle$/ }).click();
        // A rectangle around Rome, drawn by two clicks on its corners.
        const box = await map.boundingBox();
        await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.7);
        await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.88);
        const aggregate = page.waitForRequest((r) => /gs:Aggregate/.test(r.postData() ?? '') && /BBOX|Intersects|Within/i.test(r.postData()));
        await page.locator('#query-toolbar-query, button:has(.glyphicon-search)').filter({ visible: true }).first().click();
        await aggregate;
    });
});
