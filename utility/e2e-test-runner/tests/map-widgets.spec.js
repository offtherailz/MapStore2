import { test, expect, describeIfFeature, fromScenario, THUMBNAIL_DATA_URI } from './fixtures.js';
import { hasFeature, getServiceUrl } from './config.js';
import { login } from './helpers/auth.js';
import { fixtureLayer, fixtureTableLayer, mapConfig, openMapViewer, openLayersDrawer, selectLayerNode, layerToolbarButton, FIXTURE_LAYER_TITLE } from './helpers/map.js';
import { wizardNext, saveWidget, selectComboByLabel, commitTextWidgetBody } from './helpers/dashboard.js';
import { viewerContextPayload } from './helpers/content.js';
import { openAppTarget } from './helpers/navigation.js';
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

    test('Columns of a table widget get a title and a tooltip', fromScenario('Maps/TOC/Widget — Add Tilte and Tooltips for Table Widget'), async({ page, data }) => {
        /** Types in the cell of the column with the given header, in the row of an attribute. */
        async function typeInCell(header, attribute, text) {
            const headerBox = await page.locator('.react-grid-HeaderCell').filter({ hasText: new RegExp(`^${header}$`) }).first().boundingBox();
            const rowBox = await page.locator('.react-grid-Row').filter({ hasText: attribute }).first().boundingBox();
            const editor = page.locator('.rdg-editor-container input');
            // The first double click on an unselected row can just select it.
            for (let attempt = 0; attempt < 3 && !await editor.first().isVisible(); attempt++) {
                await page.mouse.dblclick(headerBox.x + headerBox.width / 2, rowBox.y + rowBox.height / 2);
                await editor.first().waitFor({ timeout: 2000 }).catch(() => {});
            }
            await editor.first().fill(text);
            await editor.first().press('Enter');
            await expect(page.locator('.react-grid-Row').filter({ hasText: text })).toHaveCount(1);
        }

        await openMap(page, data);
        await newWidget(page, 'Table');
        await expect(page.getByText('Configure table options')).toBeVisible({ timeout: 20000 });
        await typeInCell('Title', 'category', 'E2E kind');
        await typeInCell('Tooltip', 'category', 'E2E kind of city');
        await saveWithTitle(page, 'E2E titled table');
        // New widgets are small: the table is maximized to show every column.
        const card = page.locator('.mapstore-widget-card').filter({ hasText: '5 Items' }).first();
        await card.locator('.glyphicon-resize-full, .glyphicon-1-full-screen').first().click();

        const header = page.locator('.mapstore-widget-card .react-grid-HeaderCell').filter({ hasText: 'E2E kind' }).first();
        await expect(header).toBeVisible({ timeout: 30000 });
        // The tooltip belongs to the title text of the header.
        await header.getByText('E2E kind', { exact: true }).hover();
        await expect(page.getByRole('tooltip').filter({ hasText: 'E2E kind of city' })).toBeVisible();
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

    test('A text widget embeds a page', fromScenario('Maps/TOC/Widget — Create a Text (@GH-9627)'), async({ page, data }) => {
        const embedded = `${getServiceUrl('geoserver')}/web/`;

        await openMap(page, data);
        await newWidget(page, 'Text');
        await page.getByPlaceholder('Insert title...').fill('E2E text');
        await page.locator('.public-DraftEditor-content').click();
        await page.keyboard.type('E2E text body', { delay: 10 });
        await page.locator('.rdw-option-wrapper[title="Embedded"]').click();
        await page.locator('.rdw-embedded-modal-link-input').fill(embedded);
        await page.locator('.rdw-embedded-modal-btn').filter({ hasText: 'Add' }).click();
        await expect(page.locator(`iframe[src="${embedded}"]`).first()).toBeAttached();
        await commitTextWidgetBody(page);
        await saveWidget(page);
        const widget = page.locator('.mapstore-widget-card').filter({ hasText: 'E2E text body' });
        await expect(widget).toBeVisible({ timeout: 20000 });
        await expect(widget.locator(`iframe[src="${embedded}"]`)).toBeAttached();
    });

    test('An image is uploaded in a text widget', fromScenario('Maps/TOC/Widget — Upload image on Text Widget (@GH-10719)'), async({ page, data }) => {
        await openMap(page, data);
        await newWidget(page, 'Text');
        await page.getByPlaceholder('Insert title...').fill('E2E image text');
        await page.locator('.rdw-option-wrapper[title="Image"]').click();
        const modal = page.locator('.rdw-image-modal');
        const upload = modal.getByText(/upload/i).first();
        if (await upload.isVisible().catch(() => false)) {
            await upload.click();
        }
        await modal.locator('input[type="file"]').setInputFiles({
            name: 'e2e.png', mimeType: 'image/png', buffer: Buffer.from(THUMBNAIL_DATA_URI.split(',')[1], 'base64')
        });
        await modal.locator('.rdw-image-modal-btn').filter({ hasText: 'Add' }).click();
        await expect(page.locator('.public-DraftEditor-content img')).toHaveCount(1);
        await commitTextWidgetBody(page);
        await saveWidget(page);
        await expect(page.locator('.mapstore-widget-card img').first()).toBeVisible({ timeout: 20000 });
    });

    test('A widget disconnected from the map ignores the filters of the layer', fromScenario('Maps/TOC/Widget — Add widget with no connection to the map'), async({ page, data }) => {
        await openMap(page, data, [fixtureLayer({ style: 'e2e:e2e_points_by_category', enableInteractiveLegend: true })]);
        await newWidget(page, 'Counter');
        await selectComboByLabel(page, 'Use', 'population');
        await selectComboByLabel(page, 'Operation', 'SUM');
        // The plug button connects the widget to the map: switched off, the widget is independent.
        await page.locator('button:has(.glyphicon-plug)').filter({ visible: true }).first().click();
        await saveWithTitle(page, 'E2E independent counter');
        const counter = page.locator('.mapstore-widget-card').filter({ hasText: String(TOTAL_POPULATION) });
        await expect(counter).toBeVisible({ timeout: 30000 });

        await openLayersDrawer(page);
        const node = page.locator('.ms-node-layer').filter({ hasText: FIXTURE_LAYER_TITLE });
        await node.locator('.ms-node-expand').click();
        const getMap = page.waitForRequest((r) => /request=GetMap/i.test(r.url()) && /CQL_FILTER/i.test(r.url()));
        await node.locator('.wms-json-legend-rule').filter({ hasText: 'capital' }).click();
        await getMap;
        await expect(counter).toBeVisible();
        await expect(page.locator('.mapstore-widget-card').filter({ hasText: '2748000' })).toHaveCount(0);
    });

    test('The ticks of a chart axis are set by value and text', fromScenario('Maps/TOC/Widget — Chart Widget: Custom Tick Labels in Chart Axis'), async({ page, data }) => {
        // The tick values and texts typed in the Axes tab change neither the preview nor
        // the saved widget, while the prefix of the same panel does. To be verified.
        test.fail();
        await openMap(page, data);
        await newWidget(page, 'Chart');
        await selectComboByLabel(page, 'X Attribute', 'name');
        await selectComboByLabel(page, 'Y Attribute', 'population');
        await selectComboByLabel(page, 'Operation', 'No Operation');
        const plot = page.locator('.js-plotly-plot').first();
        await expect(plot.getByText('Roma')).toBeVisible({ timeout: 30000 });

        await page.getByText('Axes', { exact: true }).first().click();
        const tickValues = page.getByPlaceholder('e.g. 1,2,3,4').first();
        await tickValues.click();
        await tickValues.pressSequentially('1000000,2000000', { delay: 20 });
        const tickText = page.getByPlaceholder('e.g. A,B,C,D').first();
        await tickText.click();
        await tickText.pressSequentially('one million,two millions', { delay: 20 });
        await page.keyboard.press('Tab');
        await expect(plot.getByText('two millions')).toBeVisible({ timeout: 10000 });
    });

    test('A date axis shows the current time', fromScenario('Maps/TOC/Widget — Chart Widget: Show current time on the axis (@GH-11377 @GH-11326)'), async({ page, data }) => {
        // The time to highlight is the current one of the timeline, driven by the layer.
        await openMap(page, data, [fixtureTableLayer('e2e_events', {
            dimensions: [{ name: 'time', source: { type: 'multidim-extension', url: `${getServiceUrl('geoserver')}/gwc/service/wmts` } }]
        })]);
        await newWidget(page, 'Chart', 'e2e_events');
        await selectComboByLabel(page, 'X Attribute', 'event_time');
        await selectComboByLabel(page, 'Y Attribute', 'id');
        await selectComboByLabel(page, 'Operation', 'No Operation');
        const plot = page.locator('.js-plotly-plot').first();
        await expect(plot).toBeVisible({ timeout: 30000 });

        await page.getByText('Axes', { exact: true }).first().click();
        // The option is offered once the X axis type is Date.
        await page.getByText('X axis', { exact: true }).locator('xpath=following::*[normalize-space(text())="Type"][1]/following::*[contains(@class,"Select-control")][1]').click();
        await page.locator('.Select-menu-outer').getByText('Date', { exact: true }).click();
        await page.getByText('Highlight selected time', { exact: true }).click();
        // The current time is drawn as a shape across the plot.
        await expect(plot.locator('.shapelayer path, .layer-above .shapelayer path').first()).toBeAttached({ timeout: 20000 });
    });

    test('New widgets take the initial size of the configuration', fromScenario('Maps/TOC/Widget — Set widgets size (@GH-9622)'), async({ page, data }) => {
        const payload = await viewerContextPayload(page, {
            layers: [background(), fixtureLayer()],
            cfg: { Widgets: { cols: { md: 48, xxs: 1 }, rowHeight: 10, defaults: { initialSize: { h: 30, w: 20 } } } }
        });
        const context = await data.context({ data: payload });

        await openAppTarget(page, `#/context/${context.name}`);
        await newWidget(page, 'Counter');
        await selectComboByLabel(page, 'Use', 'population');
        await selectComboByLabel(page, 'Operation', 'SUM');
        await saveWithTitle(page, 'E2E sized counter');
        const box = await page.locator('.mapstore-widget-card').first().boundingBox();
        // 30 rows of 10 px with a 10 px margin between them: 590 px.
        expect(box.height).toBeGreaterThan(560);
        expect(box.height).toBeLessThan(620);
        expect(box.width).toBeGreaterThan(200);
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
