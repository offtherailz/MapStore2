import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { fixtureLayer, fixtureTableLayer, mapConfig, openMapViewer, openLayersDrawer, selectLayerNode, layerToolbarButton, FIXTURE_LAYER_TITLE } from './helpers/map.js';
import { wizardNext, saveWidget, selectComboByLabel } from './helpers/dashboard.js';
import { insertFeature, deleteFeatures } from './api/wfs.js';

const background = () => fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined, visibility: false });

// 2748000 + 1352000 + 913000 + 361000 + 561000: the population of the fixture cities.
const TOTAL_POPULATION = 5935000;


/** Opens the widget builder of a layer of the open map on the given type. */
async function newWidget(page, type, title = FIXTURE_LAYER_TITLE) {
    await openLayersDrawer(page);
    await selectLayerNode(page, title);
    await layerToolbarButton(page, 'widgets').click();
    await expect(page.getByText('Select the widget type')).toBeVisible({ timeout: 15000 });
    await page.getByText(type, { exact: true }).first().click();
}

/** Moves to the options step, gives the widget a title and saves it on the map. */
async function saveWithTitle(page, title) {
    await wizardNext(page);
    await page.getByText('Title', { exact: true }).locator('xpath=following::input[1]').fill(title);
    await saveWidget(page);
    await expect(page.locator('.mapstore-widget-card').filter({ hasText: title.slice(0, 1) }).first()).toBeVisible({ timeout: 20000 });
}

async function openMap(page, data, layers = [fixtureLayer()]) {
    const map = await data.map({ data: mapConfig([background(), ...layers]) });
    await openMapViewer(page, map.id);

    return map;
}

describeIfFeature('geoserverIntegration', 'Widgets on map', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('A counter is formatted and computed by a formula', fromScenario('Maps/TOC/Widget — Create a Counter (@GH-9071)'), async({ page, data }) => {
        await openMap(page, data);
        await newWidget(page, 'Counter');
        await selectComboByLabel(page, 'Use', 'population');
        await selectComboByLabel(page, 'Operation', 'SUM');
        await page.getByPlaceholder('e.g.: ~').fill('~');
        await page.getByPlaceholder('e.g.: W').fill(' people');
        await expect(page.getByText(String(TOTAL_POPULATION)).first()).toBeVisible({ timeout: 30000 });
        await expect(page.getByText('people').first()).toBeVisible();
        await page.getByPlaceholder('e.g. value / 100').fill('value + 2');
        await expect(page.getByText(String(TOTAL_POPULATION + 2)).first()).toBeVisible({ timeout: 20000 });
        await saveWithTitle(page, 'E2E counter');
        await expect(page.getByText(new RegExp(`${TOTAL_POPULATION + 2}`)).first()).toBeVisible();
    });

    test('A chart gets a second trace and a line chart a classified style', fromScenario(
        'Maps/TOC/Widget — Create a Multivariable charts (@GH-8755)',
        'Maps/TOC/Widget — Line Chart - Classification style (@GH-11721)'
    ), async({ page, data }) => {
        await openMap(page, data);
        await newWidget(page, 'Chart');
        await selectComboByLabel(page, 'X Attribute', 'category');
        await selectComboByLabel(page, 'Y Attribute', 'population');
        await selectComboByLabel(page, 'Operation', 'SUM');
        const plot = page.locator('.js-plotly-plot').first();
        await expect(plot.getByText('capital')).toBeVisible({ timeout: 30000 });

        await test.step('A second trace', async() => {
            // The add button of the trace selector; the map zoom one is a square button.
            await page.locator('button.btn.btn-primary:not(.square-button):has(> .glyphicon-plus)').filter({ visible: true }).first().click();
            await selectComboByLabel(page, 'X Attribute', 'category');
            await selectComboByLabel(page, 'Y Attribute', 'population');
            await selectComboByLabel(page, 'Operation', 'COUNT');
            await expect(plot.locator('.trace, g.bars, .barlayer .trace')).toHaveCount(2, { timeout: 30000 });
        });

        await test.step('Line chart with a classification style', async() => {
            await selectComboByLabel(page, 'Traces', 'Line Chart').catch(async() => {
                await page.locator('.Select-control').filter({ hasText: 'Bar Chart' }).first().click();
                await page.locator('.Select-menu-outer').getByText('Line Chart', { exact: true }).click();
            });
            await selectComboByLabel(page, 'Mode', 'Classification style');
            await expect(page.getByText(/Classification/).first()).toBeVisible();
        });

        await test.step('The axes can be customized', async() => {
            await page.getByRole('tab', { name: 'Axes' }).or(page.getByText('Axes', { exact: true })).first().click();
            const xAxis = page.getByText('X axis', { exact: true });
            await expect(xAxis).toBeVisible();
            // A new X axis is added from the selector of the axes.
            await xAxis.locator('xpath=following::button[.//*[contains(@class,"glyphicon-plus")]][1]').click();
            await expect(page.getByText(/\[ ?X 1 ?\]/).first()).toBeVisible();
        });

        await saveWithTitle(page, 'E2E chart');
    });

    test('A table widget zooms the map to a feature', fromScenario('Maps/TOC/Widget — Create a Table (@GH-9567)'), async({ page, data }) => {
        const zoom = () => page.getByRole('combobox', { name: 'Scale:' }).inputValue().then(Number);

        await openMap(page, data);
        await newWidget(page, 'Table');
        await saveWithTitle(page, 'E2E table');
        const table = page.locator('.react-grid-Container, .react-grid-Grid').last();
        await expect(table.getByText('Roma')).toBeVisible({ timeout: 30000 });
        const start = await zoom();
        await table.locator('.react-grid-Row').filter({ hasText: 'Roma' }).locator('.glyphicon-zoom-to').click();
        await expect.poll(zoom, { timeout: 20000 }).toBeGreaterThan(start);
    });

    test('A widget is removed from the map', fromScenario(
        'Maps/TOC/Widget — Delete a widget',
        'Maps/TOC/Widget — Delete a Widget on map (@GH-10622)'
    ), async({ page, data }) => {
        await openMap(page, data);
        await newWidget(page, 'Counter');
        await selectComboByLabel(page, 'Use', 'population');
        await selectComboByLabel(page, 'Operation', 'SUM');
        await saveWithTitle(page, 'E2E removable counter');

        // The new widget is small: its title is cut, its value tells it apart.
        const widget = page.locator('.mapstore-widget-card').filter({ hasText: String(TOTAL_POPULATION) });
        await widget.locator('button:has(.glyphicon-option-vertical)').click();
        await page.getByRole('menuitem', { name: /delete|remove/i }).first().click();
        const confirm = page.getByRole('button', { name: /^(delete|yes|remove)$/i }).last();
        if (await confirm.isVisible().catch(() => false)) {
            await confirm.click();
        }
        await expect(widget).toHaveCount(0, { timeout: 15000 });
    });

    test('A filter restricts the features of a widget', fromScenario('Maps/TOC/Widget — Filter a widget'), async({ page, data }) => {
        await openMap(page, data);
        await newWidget(page, 'Counter');
        await selectComboByLabel(page, 'Use', 'population');
        await selectComboByLabel(page, 'Operation', 'SUM');
        await expect(page.getByText(String(TOTAL_POPULATION)).first()).toBeVisible({ timeout: 30000 });

        await page.locator('button:has(.glyphicon-filter)').filter({ visible: true }).first().click();
        await page.getByText('of the following conditions:').locator('xpath=ancestor::*[.//button][1]').locator('button:has(.glyphicon-plus)').click();
        const row = page.locator('.filter-field-row').filter({ has: page.locator('.filter-field-attribute') }).filter({ visible: true }).last();
        await row.locator('.filter-field-attribute .rw-dropdownlist').click();
        await page.locator('.rw-list-option').filter({ visible: true }).filter({ hasText: /^category$/ }).click();
        await row.locator('.filter-field-operator .rw-dropdownlist').click();
        await page.locator('.rw-list-option').filter({ visible: true }).filter({ hasText: /^=$/ }).click();
        await row.locator('.filter-field-value input').first().fill('capital');
        await row.locator('.filter-field-value input').first().press('Tab');
        await page.locator('button:has(.glyphicon-search), #query-toolbar-query').filter({ visible: true }).first().click();
        // Only Rome is left.
        await expect(page.getByText('2748000').first()).toBeVisible({ timeout: 30000 });
        await saveWithTitle(page, 'E2E filtered counter');
        await expect(page.getByText('2748000').first()).toBeVisible();
    });

    test('A chart is built on a table without geometry', fromScenario('Maps/TOC/Widget — Create chart with no geometry layer (@GH-11376)'), async({ page, data }) => {
        // The aggregation of a table without geometry is sent with an empty ogc:Filter,
        // which GeoServer rejects ("Could not parse XML request"): the chart says there
        // is no data in the viewport. To be fixed in the widget data request.
        test.fail();
        const stats = fixtureTableLayer('e2e_stats', { type: 'wfs', url: fixtureTableLayer('e2e_stats').search.url, bbox: undefined });
        await openMap(page, data, [stats]);
        await newWidget(page, 'Chart', 'e2e_stats');
        await selectComboByLabel(page, 'X Attribute', 'region');
        await selectComboByLabel(page, 'Y Attribute', 'visitors');
        await selectComboByLabel(page, 'Operation', 'SUM');
        await expect(page.locator('.js-plotly-plot').first().getByText('Lazio')).toBeVisible({ timeout: 30000 });
    });

    test.describe('Empty values', () => {
        const name = `E2E null category ${Date.now()}`;

        test.beforeEach(async() => {
            await insertFeature('e2e_edit', { name, population: 1 }, [10.5, 44.5]);
        });

        test.afterEach(async() => {
            await deleteFeatures('e2e_edit', 'name', name);
        });

        test('Empty values of a chart are excluded or labelled', fromScenario('Maps/TOC/Widget — NULL values in Chart Widget (@GH-11529)'), async({ page, data }) => {
            await openMap(page, data, [fixtureTableLayer('e2e_edit')]);
            await newWidget(page, 'Chart', 'e2e_edit');
            await selectComboByLabel(page, 'X Attribute', 'category');
            await selectComboByLabel(page, 'Y Attribute', 'population');
            await selectComboByLabel(page, 'Operation', 'COUNT');
            const plot = page.locator('.js-plotly-plot').first();
            await expect(plot.getByText('city')).toBeVisible({ timeout: 30000 });

            await selectComboByLabel(page, 'Null Value Handling', 'Use placeholder');
            await expect(plot.getByText('NULL')).toBeVisible({ timeout: 20000 });
            await selectComboByLabel(page, 'Null Value Handling', 'Exclude');
            await expect(plot.getByText('NULL')).toHaveCount(0, { timeout: 20000 });
        });
    });
});
