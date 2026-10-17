import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature, getServiceUrl } from './config.js';
import { login } from './helpers/auth.js';
import { fixtureLayer, fixtureTableLayer, mapConfig, openMapViewer, openLayersDrawer, selectLayerNode, layerToolbarButton, FIXTURE_LAYER_NAME, FIXTURE_LAYER_TITLE } from './helpers/map.js';
import { saveFromViewer } from './helpers/details.js';

const background = () => fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined, visibility: false });

/** The next GetMap of a layer, decoded, with its CQL filter if any. */
function nextGetMap(page, layerName = FIXTURE_LAYER_NAME) {
    return page.waitForRequest((r) => /request=GetMap/i.test(r.url()) && r.url().includes(encodeURIComponent(layerName)))
        .then((r) => new URL(r.url()).searchParams.get('CQL_FILTER') ?? '');
}

/** Names of the fixture cities matching a CQL filter, as GeoServer resolves it. */
async function featureNames(cql) {
    const params = new URLSearchParams({ service: 'WFS', version: '1.1.0', request: 'GetFeature', typeName: FIXTURE_LAYER_NAME, outputFormat: 'application/json', CQL_FILTER: cql });
    const response = await fetch(`${getServiceUrl('geoserver')}/wfs?${params}`);

    return (await response.json()).features.map((feature) => feature.properties.name);
}

async function openFilter(page, title = FIXTURE_LAYER_TITLE) {
    await openLayersDrawer(page);
    await selectLayerNode(page, title);
    await layerToolbarButton(page, 'filter-layer').click();
    await expect(page.locator('#query-toolbar-query')).toBeVisible();
}

const layout = (page) => page.locator('.ms-map-viewer-layout');

/**
 * Picks the option of a react-widgets dropdown list. Opening the list scrolls the whole
 * viewer layout sideways (see the dedicated test below): the scroll is restored so the
 * rest of the test sees the page as laid out.
 */
async function pickFromList(page, dropdown, option) {
    await dropdown.click();
    await page.locator('.rw-list-option').filter({ visible: true }).filter({ hasText: new RegExp(`^${option.replace(/[<>=]/g, '\\$&')}$`) }).first().click();
    await layout(page).evaluate((element) => { element.scrollLeft = 0; });
}

/** Adds an attribute condition: attribute, operator and value. */
async function addCondition(page, attribute, operator, value) {
    await page.getByText('of the following conditions:').locator('xpath=ancestor::*[.//button][1]').locator('button:has(.glyphicon-plus)').click();
    const row = page.locator('.filter-field-row').filter({ has: page.locator('.filter-field-attribute') }).filter({ visible: true }).last();
    await pickFromList(page, row.locator('.filter-field-attribute .rw-dropdownlist'), attribute);
    await pickFromList(page, row.locator('.filter-field-operator .rw-dropdownlist'), operator);
    const input = row.locator('.filter-field-value input').first();
    await input.fill(value);
    await input.press('Tab');

    return row;
}

async function applyAndSave(page) {
    const apply = page.locator('#query-toolbar-query');
    // A reset applies itself: the apply button is then disabled.
    if (await apply.isEnabled()) {
        await apply.click();
    }
    await page.locator('#query-toolbar-save').click();
}

describeIfFeature('geoserverIntegration', 'Filter layer', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('An attribute filter is applied, changed and removed', fromScenario(
        'Maps/TOC/Filter_a_layer — Add a filter',
        'Maps/TOC/Filter_a_layer — Edit a filter',
        'Maps/TOC/Filter_a_layer — Remove a layer filter'
    ), async({ page, api, data }) => {
        const map = await data.map({ data: mapConfig([background(), fixtureLayer()]) });

        await openMapViewer(page, map.id);
        await openFilter(page);

        await test.step('Add a filter', async() => {
            await addCondition(page, 'name', '=', 'Roma');
            const getMap = nextGetMap(page);
            await applyAndSave(page);
            expect(await getMap).toContain('Roma');
        });

        await test.step('Edit the filter', async() => {
            await page.locator('#reset').click();
            await addCondition(page, 'name', '=', 'Milano');
            const getMap = nextGetMap(page);
            await applyAndSave(page);
            const cql = await getMap;
            expect(cql).toContain('Milano');
            expect(cql).not.toContain('Roma');
        });

        await test.step('The filter is saved with the map', async() => {
            await page.locator('#toc-query-close-button').click();
            await saveFromViewer(page);
            const layer = (await api.getData(map.id)).map.layers.find((item) => item.name === FIXTURE_LAYER_NAME && item.group !== 'background');
            expect(JSON.stringify(layer.layerFilter)).toContain('Milano');
        });

        await test.step('Remove the filter', async() => {
            const indicator = page.locator('.ms-node-layer').filter({ hasText: FIXTURE_LAYER_TITLE }).locator('.glyphicon-filter');
            await openLayersDrawer(page);
            await expect(indicator).toBeVisible();
            // Without filter the map asks the tiles it already has: the browser cache
            // answers, so the filter indicator of the layer is what tells the change.
            await openFilter(page);
            await page.locator('#reset').click();
            await applyAndSave(page);
            await page.locator('#toc-query-close-button').click();
            await openLayersDrawer(page);
            await expect(indicator).toHaveCount(0);
        });
    });

    test('The filter lists the attributes by their alias', fromScenario('Maps/TOC/Filter_a_layer — Alias support for Filter Layer (@GH-9144)'), async({ page, data }) => {
        const layer = fixtureLayer({ fields: [{ name: 'category', alias: 'E2E kind', type: 'string' }] });
        const map = await data.map({ data: mapConfig([background(), layer]) });

        await openMapViewer(page, map.id);
        await openFilter(page);
        await page.getByText('of the following conditions:').locator('xpath=ancestor::*[.//button][1]').locator('button:has(.glyphicon-plus)').click();
        await page.locator('.filter-field-row .filter-field-attribute .rw-dropdownlist').last().click();
        await expect(page.locator('.rw-list-option').filter({ visible: true }).filter({ hasText: /^E2E kind$/ })).toBeVisible();
    });

    test('A time attribute is filtered by a range', fromScenario('Maps/TOC/Filter_a_layer — Time range filtering for Filter Layer tool (@GH-9915)'), async({ page, data }) => {
        const events = fixtureTableLayer('e2e_events');
        const map = await data.map({ data: mapConfig([background(), events]) });

        await openMapViewer(page, map.id);
        await openFilter(page, 'e2e_events');
        await page.getByText('of the following conditions:').locator('xpath=ancestor::*[.//button][1]').locator('button:has(.glyphicon-plus)').click();
        const row = page.locator('.filter-field-row').filter({ has: page.locator('.filter-field-attribute') }).filter({ visible: true }).last();
        await pickFromList(page, row.locator('.filter-field-attribute .rw-dropdownlist'), 'event_time');
        await pickFromList(page, row.locator('.filter-field-operator .rw-dropdownlist'), '><');
        // The range is picked from the calendar, here through one of its shortcuts.
        await row.locator('.filter-field-value button.rw-btn-calendar').click();
        await page.getByRole('button', { name: 'This month' }).click();
        await layout(page).evaluate((element) => { element.scrollLeft = 0; });
        const getMap = nextGetMap(page, 'e2e:e2e_events');
        await applyAndSave(page);
        const month = new Date().toISOString().slice(0, 7);
        expect(await getMap).toMatch(new RegExp(`event_time.*${month}`));
    });

    test('The features are filtered by the geometries of another layer', fromScenario(
        'Maps/TOC/Filter_a_layer — Add Layer Filter',
        'Maps/TOC/Filter_a_layer — Add Layer Filter filter'
    ), async({ page, data }) => {
        const map = await data.map({ data: mapConfig([background(), fixtureLayer(), fixtureTableLayer('e2e_multigeom')]) });

        await openMapViewer(page, map.id);
        await openFilter(page);
        const panel = page.locator('.panel').filter({ hasText: 'Layer filter' }).last();
        // A click on the switch label reaches its input twice and leaves it unchanged.
        await panel.locator('.panel-heading label.mapstore-switch-btn input').evaluate((input) => input.click());
        await expect(panel.getByText('Target layer')).toBeVisible({ timeout: 20000 });
        await panel.locator('.Select-arrow-zone').first().click();
        await page.locator('.Select-option').filter({ hasText: /^e2e_multigeom$/ }).click();
        await pickFromList(page, panel.getByText('Operation', { exact: true }).locator('xpath=following::*[@role="combobox"][1]'), 'Intersects');

        await test.step('A condition on the target layer', async() => {
            await panel.locator('button:has(.glyphicon-plus)').first().click();
            const row = panel.locator('.filter-field-row').filter({ has: page.locator('.filter-field-attribute') }).last();
            await pickFromList(page, row.locator('.filter-field-attribute .rw-dropdownlist'), 'name');
            await pickFromList(page, row.locator('.filter-field-operator .rw-dropdownlist'), '=');
            await row.locator('.filter-field-value input').first().fill('Roma area');
            await row.locator('.filter-field-value input').first().press('Tab');
        });

        const getMap = nextGetMap(page);
        await page.locator('#query-toolbar-query').click();
        const cql = await getMap;
        expect(cql).toMatch(/INTERSECTS/i);
        expect(cql).toMatch(/queryCollection\('e2e:e2e_multigeom'/);
        expect(cql).toContain('Roma area');
        // GeoServer resolves the filter to the city inside the area.
        expect(await featureNames(cql)).toEqual(['Roma']);
    });

    test('An area drawn on the map and a layer filter are combined', fromScenario('Maps/TOC/Filter_a_layer — Cascading search (@GH-11461 @GH-11532)'), async({ page, data }) => {
        const map = await data.map({ data: mapConfig([background(), fixtureLayer(), fixtureTableLayer('e2e_multigeom')]) });

        await openMapViewer(page, map.id);
        await openFilter(page);

        await test.step('Draw a rectangle on the map', async() => {
            const area = page.locator('.panel').filter({ hasText: 'Area of interest' }).last();
            await pickFromList(page, area.getByText('Filter type', { exact: true }).locator('xpath=following::*[@role="combobox"][1]'), 'Rectangle');
            const box = await page.locator('.ol-viewport').boundingBox();
            // The rectangle is drawn by two clicks on its corners, right of the filter panel.
            await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.2);
            await page.mouse.click(box.x + box.width * 0.9, box.y + box.height * 0.8);
            await expect(page.locator('#query-toolbar-query')).toBeEnabled();
        });

        const panel = page.locator('.panel').filter({ hasText: 'Layer filter' }).last();
        await panel.locator('.panel-heading label.mapstore-switch-btn input').evaluate((input) => input.click());
        await panel.locator('.Select-arrow-zone').first().click();
        await page.locator('.Select-option').filter({ hasText: /^e2e_multigeom$/ }).click();
        await pickFromList(page, panel.getByText('Operation', { exact: true }).locator('xpath=following::*[@role="combobox"][1]'), 'Intersects');

        const getMap = nextGetMap(page);
        await page.locator('#query-toolbar-query').click();
        const cql = await getMap;
        expect(cql).toMatch(/queryCollection\('e2e:e2e_multigeom'/);
        // The drawn area adds a spatial condition of its own.
        expect(cql.match(/INTERSECTS/gi).length).toBeGreaterThanOrEqual(2);
    });

    test('Choosing a filter operator does not move the map sideways', async({ page, data }) => {
        // The operator list scrolls the viewer layout by about the width of the drawer,
        // shifting the map and the side bar. To be fixed in the filter layout.
        test.fail();
        const map = await data.map({ data: mapConfig([background(), fixtureLayer()]) });

        await openMapViewer(page, map.id);
        await openFilter(page);
        await page.getByText('of the following conditions:').locator('xpath=ancestor::*[.//button][1]').locator('button:has(.glyphicon-plus)').click();
        const row = page.locator('.filter-field-row').filter({ has: page.locator('.filter-field-attribute') }).filter({ visible: true }).last();
        await row.locator('.filter-field-attribute .rw-dropdownlist').click();
        await page.locator('.rw-list-option').filter({ visible: true }).filter({ hasText: /^name$/ }).click();
        await row.locator('.filter-field-operator .rw-dropdownlist').click();
        await page.locator('.rw-list-option').filter({ visible: true }).filter({ hasText: /^=$/ }).click();
        expect(await layout(page).evaluate((element) => element.scrollLeft)).toBe(0);
    });
});
