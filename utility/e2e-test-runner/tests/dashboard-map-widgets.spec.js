import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { fixtureLayer, fixtureTableLayer, mapConfig, FIXTURE_LAYER_NAME, FIXTURE_LAYER_TITLE } from './helpers/map.js';
import { openDashboard, addWidget, wizardNext, saveWidget } from './helpers/dashboard.js';

const background = () => fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined });

/** Saved map centred on Rome, with the given layers over the background. */
function romeMapData(layers = [fixtureLayer()]) {
    const config = mapConfig([background(), ...layers]);
    config.map.center = { x: 12.4964, y: 41.9028, crs: 'EPSG:4326' };
    config.map.zoom = 10;

    return config;
}


async function saveWithTitle(page, title) {
    await page.getByText('Title', { exact: true }).locator('xpath=following::input[1]').fill(title);
    await saveWidget(page);
}

/** Starts a map widget on a saved map and moves to its options. */
async function startMapWidget(page, mapName) {
    await addWidget(page, 'Map');
    await page.getByText(mapName, { exact: true }).first().click();
    await wizardNext(page);
    await expect(page.getByText('Configure map options')).toBeVisible({ timeout: 20000 });
}

/** The plus button of the builder toolbar, between the dashboard and the side bar. */
async function builderToolbarPlus(page) {
    let found;
    await expect.poll(async() => {
        for (const button of await page.locator('button:has(.glyphicon-plus)').filter({ visible: true }).all()) {
            const box = await button.boundingBox();
            if (box && box.x > 700 && box.x < 1200 && box.y < 150) {
                found = button;
                return true;
            }
        }
        return false;
    }, { timeout: 15000 }).toBe(true);

    return found;
}

const mapCard = (page) => page.locator('.mapstore-widget-card').filter({ has: page.locator('.ol-viewport') }).first();

describeIfFeature('geoserverIntegration', 'Dashboard map widgets', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('A map widget is added and identifies its features', fromScenario(
        'Dashboard/Widget/Map_Widgets — Add a Map Widget',
        'Dashboard/Widget/Map_Widgets — Identify options on Map widget'
    ), async({ page, data }) => {
        const map = await data.map({ data: romeMapData() });
        const dashboard = await data.dashboard();

        await openDashboard(page, dashboard.id);
        await startMapWidget(page, map.name);
        // Identify is on by default: its button in the builder toolbar is green.
        await expect(page.locator('button.btn-success:has(.glyphicon-info-sign)').filter({ visible: true })).toHaveCount(1);
        await wizardNext(page);
        await saveWithTitle(page, 'E2E map widget');

        await mapCard(page).locator('.glyphicon-resize-full, .glyphicon-1-full-screen').first().click();
        const viewport = mapCard(page).locator('.ol-viewport');
        await expect(viewport).toBeVisible({ timeout: 30000 });
        const box = await viewport.boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await expect(page.getByText('Roma').first()).toBeVisible({ timeout: 20000 });
    });

    test('The layers of a map widget are managed from its table of contents', fromScenario('Dashboard/Widget/Map_Widgets — TOC on Map Widget (@GH-10237)'), async({ page, data }) => {
        const map = await data.map({ data: romeMapData() });
        const dashboard = await data.dashboard();

        await openDashboard(page, dashboard.id);
        await startMapWidget(page, map.name);
        const node = page.locator('.ms-node-layer').filter({ hasText: FIXTURE_LAYER_TITLE }).last();
        const visibility = node.locator('.ms-visibility-check');
        await expect(visibility).toHaveClass(/active/);
        await visibility.click();
        await expect(visibility).not.toHaveClass(/active/);
        await visibility.click();
        await node.locator('.ms-node-expand').click();
        await expect(node.locator('img[src*="GetLegendGraphic"]')).toBeVisible({ timeout: 20000 });
        await expect(node.locator('.mapstore-slider')).toBeVisible();
    });

    test('A map widget is built from an empty map', fromScenario('Dashboard/Widget/Map_Widgets — Add a new map with a map widget'), async({ page, data }) => {
        const dashboard = await data.dashboard();

        await openDashboard(page, dashboard.id);
        await addWidget(page, 'Map');
        await page.getByText('Empty Map', { exact: true }).click();
        await wizardNext(page);
        // An empty map is named before its configuration.
        await page.getByPlaceholder('Enter map name').fill('E2E empty map');
        await page.getByPlaceholder('Enter map name').locator('xpath=following::button[1]').click();
        await expect(page.getByText('Configure map options')).toBeVisible({ timeout: 20000 });
        await expect(page.getByText('Configure map options')).toBeVisible();
        await builderToolbarPlus(page).then((button) => button.click());
        await page.locator('.Select input[role="combobox"]').filter({ visible: true }).first().fill('Local GeoServer WMS');
        await page.keyboard.press('Enter');
        // The layer is selected and then added with the toolbar button.
        await page.locator('.ms-catalog-card').filter({ hasText: FIXTURE_LAYER_NAME }).first().click();
        await builderToolbarPlus(page).then((button) => button.click());
        await expect(page.locator('.ms-node-layer').filter({ hasText: FIXTURE_LAYER_TITLE }).last()).toBeVisible({ timeout: 20000 });
        await expect.poll(async() => {
            await wizardNext(page);
            return page.getByText('Configure Widget Info').isVisible();
        }, { timeout: 15000 }).toBe(true);
        await saveWithTitle(page, 'E2E new map widget');
        await expect(mapCard(page)).toBeVisible({ timeout: 30000 });
    });

    test('A map widget shows a legend and a background selector', fromScenario('Dashboard/Widget/Map_Widgets — Background and Legend on Map Widget (@GH-11525 @GH-12431)'), async({ page, data }) => {
        const map = await data.map({ data: romeMapData() });
        const dashboard = await data.dashboard();

        await openDashboard(page, dashboard.id);
        await startMapWidget(page, map.name);
        // The second tab of the options holds the settings of the widget.
        await page.locator('a:has(.glyphicon-wrench), [role=tab]:has(.glyphicon-wrench)').filter({ visible: true }).first().click();
        await page.getByRole('checkbox', { name: 'Show background selector' }).check();
        await page.getByRole('checkbox', { name: 'Show legend' }).check();
        await expect(page.getByRole('checkbox', { name: 'Show legend' })).toBeChecked();
        await wizardNext(page);
        await saveWithTitle(page, 'E2E map with legend');

        // New widgets are small: the map is maximized to show its tools.
        const card = mapCard(page);
        await card.locator('.glyphicon-resize-full, .glyphicon-1-full-screen').first().click();
        await expect(card.locator('.ms-background-selector, [class*=background-selector]').first()).toBeVisible({ timeout: 30000 });
        await expect(card.getByText(FIXTURE_LAYER_TITLE).first()).toBeVisible();
    });

    test('The interactive legend of a legend widget filters the map', fromScenario('Dashboard/Widget/Map_Widgets — Interactive legend in dashboard (@GH-10235)'), async({ page, data }) => {
        const classified = fixtureLayer({ style: 'e2e:e2e_points_by_category', enableInteractiveLegend: true });
        const map = await data.map({ data: romeMapData([classified]) });
        const dashboard = await data.dashboard();

        await openDashboard(page, dashboard.id);
        await startMapWidget(page, map.name);
        await wizardNext(page);
        await saveWithTitle(page, 'E2E legend map');
        await addWidget(page, 'Legend');
        await wizardNext(page);
        await saveWithTitle(page, 'E2E interactive legend');

        const legend = page.locator('.mapstore-widget-card').filter({ hasText: 'E2E interactive legend' });
        await legend.locator('.ms-node-layer').filter({ hasText: FIXTURE_LAYER_TITLE }).locator('.ms-node-expand').click();
        const filtered = page.waitForRequest((r) => /request=GetMap/i.test(r.url()) && /CQL_FILTER/i.test(r.url()) && /capital/.test(decodeURIComponent(r.url())));
        await legend.locator('.wms-json-legend-rule').filter({ hasText: 'capital' }).click();
        await filtered;
    });

    test('The map of a widget is edited in the advanced editor', fromScenario('Dashboard/Widget/Map_Widgets — Inline Advanced Map Editor'), async({ page, data }) => {
        const map = await data.map({ data: romeMapData([fixtureTableLayer('e2e_edit')]) });
        const dashboard = await data.dashboard();

        await openDashboard(page, dashboard.id);
        await startMapWidget(page, map.name);
        await wizardNext(page);
        await saveWithTitle(page, 'E2E editable map');

        const card = mapCard(page);
        await card.locator('button:has(.glyphicon-option-vertical), button:has(.glyphicon-cog)').first().click();
        await page.getByText(/Open map editor/i).click();
        const editor = page.getByRole('dialog').filter({ has: page.locator('.ol-viewport') }).last();
        await expect(editor).toBeVisible({ timeout: 30000 });
        await editor.locator('button:has(.glyphicon-1-layer)').first().click();
        await editor.locator('.ms-node-layer').filter({ hasText: 'e2e_edit' }).click();
        await expect(editor.locator('button.toc-toolbar-button:has(.glyphicon-features-grid)')).toBeVisible();
        await expect(editor.locator('button.toc-toolbar-button:has(.glyphicon-wrench)')).toBeVisible();
        await editor.getByRole('button', { name: /^ok$/i }).click();
        await expect(editor).toBeHidden();
    });
});
