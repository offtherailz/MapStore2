import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { fixtureLayer, mapConfig, openMapViewer, openLayersDrawer, selectLayerNode, layerToolbarButton, FIXTURE_FEATURES, FIXTURE_LAYER_NAME, FIXTURE_LAYER_TITLE } from './helpers/map.js';
import { wizardNext, saveWidget, selectComboByLabel } from './helpers/dashboard.js';

const background = () => fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined, visibility: false });

const items = (container) => container.locator('.ms-filter-checkbox-list-item-label');
const preview = (page) => page.locator('.ms-filter-checkbox-list').first();

/** The CQL filter of the next GetMap of the fixture layer. */
function nextFilter(page) {
    return page.waitForRequest((r) => /request=GetMap/i.test(r.url()) && r.url().includes(encodeURIComponent(FIXTURE_LAYER_NAME)))
        .then((r) => new URL(r.url()).searchParams.get('CQL_FILTER') ?? '');
}

/** Opens the filter selector builder on the fixture layer, listing the city names. */
async function newCityFilter(page, data) {
    const map = await data.map({ data: mapConfig([background(), fixtureLayer()]) });
    await openMapViewer(page, map.id);
    await openLayersDrawer(page);
    await selectLayerNode(page, FIXTURE_LAYER_TITLE);
    await layerToolbarButton(page, 'widgets').click();
    await page.getByText('Filter selector', { exact: true }).first().click();
    await selectComboByLabel(page, 'Value Attribute', 'name');
    await expect(items(preview(page))).toHaveCount(FIXTURE_FEATURES.length, { timeout: 30000 });
}

/** The switch of an option of the Layout tab, found by its label. */
function layoutOption(page, label) {
    return page.getByText(new RegExp(`^${label}\\s*$`)).locator('xpath=following::input[@type="checkbox"][1]');
}

/** Connects the filter to the fixture layer in the Interactions tab. */
async function connectToLayer(page) {
    await page.getByText('Interactions', { exact: true }).click();
    const target = page.getByText(FIXTURE_LAYER_TITLE, { exact: true }).locator('xpath=ancestor::*[.//button][1]');
    await target.locator('button').last().click();
}

async function saveFilter(page, title) {
    await wizardNext(page);
    await page.getByText('Title', { exact: true }).locator('xpath=following::input[1]').fill(title);
    await saveWidget(page);
    const widget = page.locator('.mapstore-widget-card').filter({ has: page.locator('.ms-filter-checkbox-list') }).last();
    await expect(widget).toBeVisible({ timeout: 20000 });

    return widget;
}

describeIfFeature('geoserverIntegration', 'Filter widgets', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('A filter of the values of an attribute filters the connected layer', fromScenario('Maps/TOC/Widget — Filter Widget (@GH-11633 @GH-11892 @GH-11894)'), async({ page, data }) => {
        await newCityFilter(page, data);

        await test.step('The values are sorted in descending order', async() => {
            await selectComboByLabel(page, 'Sort By Attribute', 'name');
            await expect(items(preview(page))).toHaveText([...FIXTURE_FEATURES].sort(), { timeout: 20000 });
            // Ascending and descending buttons follow the sort attribute. The order goes
            // in the features query of gs:PagedUnique, whose own unique values lose it:
            // only the request is checked.
            const descending = page.waitForRequest((r) => /PagedUnique/.test(r.postData() ?? '') && /<ogc:SortOrder>DESC<\/ogc:SortOrder>/.test(r.postData()));
            await page.getByText('Sort By Attribute', { exact: true }).locator('xpath=ancestor::*[.//button[contains(@class,"square-button")]][1]')
                .locator('button.square-button').nth(1).click();
            await descending;
        });

        await connectToLayer(page);
        const widget = await saveFilter(page, 'E2E cities filter');
        const filter = nextFilter(page);
        await items(widget).filter({ hasText: 'Roma' }).click();
        expect(await filter).toContain('Roma');
    });

    test('A filter without targets warns about it', fromScenario('Maps/TOC/Widget — Target message option on Filter Widget (@GH-11871)'), async({ page, data }) => {
        await newCityFilter(page, data);
        await page.getByText('Layout', { exact: true }).click();
        await expect(layoutOption(page, 'No target message')).toBeChecked();
        const widget = await saveFilter(page, 'E2E unconnected filter');
        const warning = widget.locator('.glyphicon-warning-sign, .text-warning, [class*=warning]').first();
        await expect(warning).toBeVisible();
        await warning.hover();
        await expect(page.getByText(/No target connected/)).toBeVisible();
    });

    test('Force selection keeps an item selected', fromScenario('Maps/TOC/Widget — Force selection and No selection mode options on Filter Widget (@GH-11868 @GH-11984)'), async({ page, data }) => {
        await newCityFilter(page, data);
        await page.getByText('Layout', { exact: true }).click();
        await layoutOption(page, 'Force Selection').evaluate((input) => input.click());
        // Only Select All is offered, and a warning asks for a selection.
        const selectAll = page.getByText('Select All', { exact: true }).first();
        await expect(selectAll).toBeVisible();
        await expect(page.getByText('Clear', { exact: true })).toHaveCount(0);
        // The warning icon sits before Select All in the header of the preview.
        const box = await selectAll.boundingBox();
        await page.mouse.move(box.x - 22, box.y + box.height / 2);
        await expect(page.getByText(/at least one item must be selected/)).toBeVisible();
        await items(preview(page)).filter({ hasText: 'Milano' }).click();

        await connectToLayer(page);
        const widget = await saveFilter(page, 'E2E forced filter');
        const checked = widget.locator('.ms-filter-checkbox-list-items label').filter({ has: page.locator('input:checked') });
        await expect(checked).toHaveCount(1);
        await expect(checked).toHaveText('Milano');
    });

    test('With nothing selected the filter can exclude every feature', fromScenario('Maps/TOC/Widget — Force selection and No selection mode options on Filter Widget (@GH-11868 @GH-11984)'), async({ page, data }) => {
        await newCityFilter(page, data);
        await selectComboByLabel(page, 'No selection mode', 'Exclude');
        await connectToLayer(page);
        const filter = nextFilter(page);
        await saveFilter(page, 'E2E exclusive filter');
        expect(await filter).toMatch(/EXCLUDE|1\s*=\s*0|false/i);
    });
});
