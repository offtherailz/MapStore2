import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { fixtureLayer, mapConfig, FIXTURE_FEATURES, FIXTURE_LAYER_NAME, FIXTURE_LAYER_TITLE } from './helpers/map.js';
import { openDashboard, addWidget, wizardNext, saveWidget, selectCombo, selectComboByLabel, pickFixtureLayer } from './helpers/dashboard.js';

/** Map centred on Rome, close enough to leave the other cities out of view. */
function romeMapData() {
    const config = mapConfig([fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined }), fixtureLayer()]);
    config.map.center = { x: 12.4964, y: 41.9028, crs: 'EPSG:4326' };
    config.map.zoom = 10;

    return config;
}

/** Fills the title of the widget info step and saves the widget. */
async function saveWithTitle(page, title) {
    await page.getByText('Title', { exact: true }).locator('xpath=following::input[1]').fill(title);
    await saveWidget(page);
}

/** Adds a map widget showing the given saved map. */
async function addMapWidget(page, mapName) {
    await addWidget(page, 'Map');
    await page.getByText(mapName, { exact: true }).first().click();
    await wizardNext(page);
    await expect(page.getByText('Configure map options')).toBeVisible({ timeout: 20000 });
    await wizardNext(page);
    await saveWithTitle(page, 'E2E map widget');
    await expect(page.locator('.mapstore-widget-card .ol-viewport, .mapstore-widget-card canvas').first()).toBeVisible({ timeout: 30000 });
}

/** Connects the widget being built to the other one, through the plug button. */
async function connect(page) {
    // The button shows an unplugged glyph until the widget is connected.
    await page.locator('button:has(.glyphicon-unplug)').filter({ visible: true }).first().click();
    // With more candidates a menu lists them: the first one is picked.
    const option = page.getByRole('menuitem').first();
    if (await option.isVisible().catch(() => false)) {
        await option.click();
    }
    await expect(page.locator('button:has(.glyphicon-plug)').filter({ visible: true }).first()).toBeVisible();
}

describeIfFeature('geoserverIntegration', 'Dashboard widget connections', () => {
    let mapName;

    test.beforeEach(async({ page, data }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        const map = await data.map({ data: romeMapData() });
        mapName = map.name;
        await login(page);
    });

    test('A table connected to the map lists the features in view', fromScenario('Dashboard/Widget_Connections — Map-Table connection'), async({ page, data }) => {
        const dashboard = await data.dashboard();

        await openDashboard(page, dashboard.id);
        await addMapWidget(page, mapName);
        await addWidget(page, 'Table');
        await pickFixtureLayer(page, FIXTURE_LAYER_TITLE);
        await wizardNext(page);
        await expect(page.getByText('Configure table options')).toBeVisible({ timeout: 15000 });
        await connect(page);
        await wizardNext(page);
        await saveWithTitle(page, 'E2E connected table');
        // Only Rome is in the view of the map.
        await expect(page.getByText('1 Item', { exact: true })).toBeVisible({ timeout: 30000 });
    });

    test('A counter connected to the map counts the features in view', fromScenario('Dashboard/Widget_Connections — Map-Counter connection'), async({ page, data }) => {
        const dashboard = await data.dashboard();

        await openDashboard(page, dashboard.id);
        await addMapWidget(page, mapName);
        await addWidget(page, 'Counter');
        await pickFixtureLayer(page, FIXTURE_LAYER_TITLE);
        await wizardNext(page);
        await selectCombo(page, 0, 'population');
        await selectCombo(page, 1, 'SUM');
        await connect(page);
        await wizardNext(page);
        await saveWithTitle(page, 'E2E connected counter');
        await expect(page.locator('.mapstore-widget-card').getByText('2748000')).toBeVisible({ timeout: 30000 });
    });

    test('A pie chart connected to the map groups the features in view', fromScenario('Dashboard/Widget_Connections — Map-Chart connections'), async({ page, data }) => {
        const dashboard = await data.dashboard();

        await openDashboard(page, dashboard.id);
        await addMapWidget(page, mapName);
        await addWidget(page, 'Chart');
        await pickFixtureLayer(page, FIXTURE_LAYER_TITLE);
        await wizardNext(page);
        await page.locator('.Select-control').filter({ hasText: 'Bar Chart' }).first().click();
        await page.locator('.Select-menu-outer').getByText('Pie Chart', { exact: true }).click();
        await selectComboByLabel(page, 'Group By', 'category');
        // "Use" labels another field too: the first one is the trace data.
        await page.locator('xpath=//*[normalize-space(text())="Use"]/following::*[contains(@class,"Select-control")][1]').first().click();
        await page.locator('.Select-menu-outer').getByText('population', { exact: true }).first().click();
        await selectComboByLabel(page, 'Operation', 'SUM');
        await connect(page);
        // Only the capital is in view: the pie has a single slice.
        await expect(page.locator('.js-plotly-plot').last().getByText('100%')).toBeVisible({ timeout: 30000 });
        await expect.poll(async() => {
            await wizardNext(page);
            return page.getByText('Configure Widget Info').isVisible();
        }, { timeout: 15000 }).toBe(true);
        await saveWithTitle(page, 'E2E connected chart');
        await expect(page.locator('.mapstore-widget-card .js-plotly-plot').last().getByText('100%')).toBeVisible({ timeout: 30000 });
    });

    test('A legend widget shows the layers of the map', fromScenario('Dashboard/Widget_Connections — Map-Legend connections'), async({ page, data }) => {
        const dashboard = await data.dashboard();

        await openDashboard(page, dashboard.id);
        await addMapWidget(page, mapName);
        await addWidget(page, 'Legend');
        await expect(page.getByText(FIXTURE_LAYER_TITLE).first()).toBeVisible({ timeout: 20000 });
        await expect(page.locator('button:has(.glyphicon-plug), button:has(.glyphicon-unplug)').filter({ visible: true }).first()).toBeEnabled();
        await wizardNext(page);
        await saveWithTitle(page, 'E2E legend widget');
        const legend = page.locator('.mapstore-widget-card').filter({ hasText: 'E2E legend widget' });
        await legend.locator('.ms-node-layer').filter({ hasText: FIXTURE_LAYER_TITLE }).locator('.ms-node-expand').click();
        await expect(legend.locator('img[src*="GetLegendGraphic"]').first()).toBeVisible({ timeout: 30000 });
    });

    test('A map connected to a table follows its filters', fromScenario('Dashboard/Widget_Connections — Parent Table-Map connections (@GH-9739 @GH-11709)'), async({ page, data }) => {
        const dashboard = await data.dashboard();

        await openDashboard(page, dashboard.id);
        await addWidget(page, 'Table');
        await pickFixtureLayer(page, FIXTURE_LAYER_TITLE);
        await wizardNext(page);
        await wizardNext(page);
        await saveWithTitle(page, 'E2E parent table');
        await expect(page.getByText(`${FIXTURE_FEATURES.length} Items`)).toBeVisible({ timeout: 30000 });

        await addWidget(page, 'Map');
        await page.getByText(mapName, { exact: true }).first().click();
        await wizardNext(page);
        await connect(page);
        await wizardNext(page);
        await saveWithTitle(page, 'E2E child map');

        // The quick filter of the table filters the layer of the map.
        const filtered = page.waitForRequest((r) => /request=GetMap/i.test(r.url()) && r.url().includes(encodeURIComponent(FIXTURE_LAYER_NAME)) && /CQL_FILTER=[^&]*Milano/i.test(decodeURIComponent(r.url())));
        const table = page.locator('.mapstore-widget-card').filter({ hasText: `${FIXTURE_FEATURES.length} Items` }).first();
        await table.locator('.react-grid-HeaderRow').nth(1).locator('input[type="text"]').nth(1).fill('Milano');
        await filtered;
    });
});
