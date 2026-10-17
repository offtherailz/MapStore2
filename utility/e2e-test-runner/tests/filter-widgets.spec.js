import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature, getServiceUrl } from './config.js';
import { openAppTarget } from './helpers/navigation.js';
import { viewerContextPayload } from './helpers/content.js';
import { login } from './helpers/auth.js';
import { fixtureLayer, fixtureTableLayer, mapConfig, openMapViewer, openLayersDrawer, selectLayerNode, layerToolbarButton, FIXTURE_FEATURES, FIXTURE_LAYER_NAME, FIXTURE_LAYER_TITLE } from './helpers/map.js';
import { wizardNext, saveWidget, selectComboByLabel, openDashboard, addWidget, pickFixtureLayer } from './helpers/dashboard.js';

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

async function saveSlider(page, title) {
    await wizardNext(page);
    await page.getByText('Title', { exact: true }).locator('xpath=following::input[1]').fill(title);
    await saveWidget(page);
    const widget = page.locator('.mapstore-widget-card').filter({ hasText: 'Event 3' }).last();
    await expect(widget).toBeVisible({ timeout: 20000 });
    // The new widget is too small for its ticks to be clicked.
    await widget.locator('.glyphicon-resize-full').first().click();
    await expect(widget.getByText('Event 3', { exact: true })).toBeVisible();

    return widget;
}

async function saveFilter(page, title) {
    await wizardNext(page);
    await page.getByText('Title', { exact: true }).locator('xpath=following::input[1]').fill(title);
    await saveWidget(page);
    const widget = page.locator('.mapstore-widget-card').filter({ has: page.locator('.ms-filter-checkbox-list') }).last();
    await expect(widget).toBeVisible({ timeout: 20000 });

    return widget;
}

/** e2e_events, one event a day from 2024-01-01 to 2024-01-05, with its time dimension. */
function eventsLayer() {
    return fixtureTableLayer('e2e_events', {
        dimensions: [{ name: 'time', source: { type: 'multidim-extension', url: `${getServiceUrl('geoserver')}/gwc/service/wmts` } }]
    });
}

/** The time of the next GetMap of the events. */
function nextEventsTime(page) {
    return page.waitForRequest((r) => /request=GetMap/i.test(r.url()) && r.url().includes('e2e_events') && /[?&]time=/i.test(r.url()))
        .then((r) => new URL(r.url()).searchParams.get('time') ?? new URL(r.url()).searchParams.get('TIME'));
}

/**
 * Builds a single selection slider of the event times, labelled by the event names, and
 * adds the "Apply dimension" interaction.
 */
async function newEventsTimeSlider(page) {
    await openLayersDrawer(page);
    await selectLayerNode(page, 'e2e_events');
    await layerToolbarButton(page, 'widgets').click();
    await page.getByText('Filter selector', { exact: true }).first().click();
    await page.getByText('Values From').locator('xpath=following::*[contains(@class,"Select-control")][1]').click();
    await page.locator('.Select-menu-outer').getByText('Attributes', { exact: true }).click();
    await selectComboByLabel(page, 'Value Attribute', 'event_time');
    await selectComboByLabel(page, 'Label Attribute', 'name');

    await page.getByText('Layout', { exact: true }).click();
    const variant = page.getByText('Variant', { exact: true }).locator('xpath=following::*[contains(@class,"Select-control")][1]');
    await variant.click();
    // The slider needs a single selection.
    await expect(page.locator('.Select-option').filter({ hasText: 'Checkbox' })).toBeVisible();
    await expect(page.locator('.Select-option').filter({ hasText: 'Slider' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await selectComboByLabel(page, 'Selection Mode', 'Single');
    await variant.click();
    await page.locator('.Select-option').filter({ hasText: 'Slider' }).click();
    await expect(page.getByText('Event 3', { exact: true }).first()).toBeVisible();

    await page.getByText('Interactions', { exact: true }).click();
    await page.getByText('On Selection Change').locator('xpath=following::button[1]').click();
    await page.getByText('Apply dimension').click();
}

/** The connect button of a row of the interactions tree. */
function interactionConnect(page, label) {
    return page.locator('.ms-connection-row').filter({ hasText: new RegExp(`^${label}$`) }).locator('button:has(.glyphicon-unplug)');
}

/** Moves the slider of a filter widget to the tick with the given label. */
async function slideTo(widget, label) {
    await widget.getByText(label, { exact: true }).click();
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

    test('A style list switches the style of the connected layer', fromScenario('Maps/TOC/Widget — Apply Style on  Filter Widget (@GH-11869 @GH-11870 @GH-12017)'), async({ page, data }) => {
        const map = await data.map({ data: mapConfig([background(), fixtureLayer()]) });
        await openMapViewer(page, map.id);
        await openLayersDrawer(page);
        await selectLayerNode(page, FIXTURE_LAYER_TITLE);
        await layerToolbarButton(page, 'widgets').click();
        await page.getByText('Filter selector', { exact: true }).first().click();
        await selectComboByLabel(page, 'Data Source', 'User Defined');
        await selectComboByLabel(page, 'Type', 'Style list');
        // Each row of the table of styles pairs a label with one style of the layer.
        await page.getByText('Styles', { exact: true }).locator('xpath=following::button[.//*[contains(@class,"glyphicon-plus")]][1]').click();
        await page.locator('.ms-layer-styles-list button:has(.glyphicon-chevron-down)').last().click();
        await page.getByText(/e2e_points_by_category|E2E cities by category/).first().click();
        await expect(items(preview(page))).toHaveCount(1, { timeout: 20000 });

        await connectToLayer(page);
        const widget = await saveFilter(page, 'E2E styles filter');
        const styled = page.waitForRequest((r) => /request=GetMap/i.test(r.url()) && r.url().includes(encodeURIComponent(FIXTURE_LAYER_NAME))
            && /e2e_points_by_category/.test(decodeURIComponent(r.url())));
        await items(widget).first().click();
        await styled;
    });

    test('A defined "is null" filter keeps the attribute table working', fromScenario('Maps/TOC/Widget — Dynamic Filter Widget and Attribute Table interaction'), async({ page, data }) => {
        await page.setViewportSize({ width: 1280, height: 1100 });
        const map = await data.map({ data: mapConfig([background(), fixtureLayer()]) });
        await openMapViewer(page, map.id);
        await openLayersDrawer(page);
        await selectLayerNode(page, FIXTURE_LAYER_TITLE);
        await layerToolbarButton(page, 'widgets').click();
        await page.getByText('Filter selector', { exact: true }).first().click();
        await selectComboByLabel(page, 'Data Source', 'User Defined');
        await selectComboByLabel(page, 'Type', 'Filter list');
        await page.getByText('Filters', { exact: true }).locator('xpath=following::button[.//*[contains(@class,"glyphicon-plus")]][1]').click();
        await page.locator('tr, [class*=row]').filter({ hasText: 'Defined filter1' }).locator('button:has(.glyphicon-filter)').first().click();
        await page.locator('#add-filter-field').click();
        const condition = page.locator('.filter-field-row').filter({ has: page.locator('.filter-field-attribute') }).filter({ visible: true }).last();
        await condition.locator('.filter-field-attribute .rw-dropdownlist').click();
        await page.locator('.rw-list-option').filter({ visible: true }).filter({ hasText: /^name$/ }).click();
        await condition.locator('.filter-field-operator .rw-dropdownlist').click();
        await page.locator('.rw-list-option').filter({ visible: true }).filter({ hasText: /^isNull$/ }).click();
        await page.locator('button:has(.glyphicon-ok)').filter({ visible: true }).first().click();
        await expect(items(preview(page))).toHaveCount(1, { timeout: 20000 });
        await connectToLayer(page);
        const widget = await saveFilter(page, 'E2E defined filter');

        const table = async() => {
            await openLayersDrawer(page);
            await selectLayerNode(page, FIXTURE_LAYER_TITLE);
            await layerToolbarButton(page, 'features-grid').click();
            await expect(page.locator('.feature-grid-container')).toBeVisible({ timeout: 30000 });
        };
        const closeTable = () => page.locator('.feature-grid-container button:has(.glyphicon-1-close)').first().click();
        /** Toggles the defined filter, in the widget maximized: the new widget is too small for it. */
        const toggleFilter = async(checked) => {
            await widget.locator('.glyphicon-resize-full').first().click();
            const box = widget.locator('input[type="checkbox"]').last();
            if (await box.isChecked() !== checked) {
                await items(widget).last().click();
            }
            await expect(box).toBeChecked({ checked });
            await widget.locator('.glyphicon-resize-small').first().click();
        };

        await test.step('With the filter on, the table asks the features with no name: none', async() => {
            await toggleFilter(true);
            // The filter reaches the WFS query as the isNull function.
            const query = page.waitForRequest((r) => /<wfs:GetFeature/.test(r.postData() ?? '') && /<ogc:Function name="isNull">/.test(r.postData()));
            await table();
            await query;
            await expect(page.getByText('No Features Available')).toBeVisible({ timeout: 30000 });
            await closeTable();
        });

        await test.step('With the filter off, the table lists every feature', async() => {
            await toggleFilter(false);
            await table();
            await expect(page.locator('.react-grid-Row')).toHaveCount(FIXTURE_FEATURES.length, { timeout: 30000 });
        });
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

describeIfFeature('geoserverIntegration', 'Filter widgets in dashboards', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    /** Adds a table widget on the fixture layer, the target of the filters. */
    async function addTable(page) {
        await addWidget(page, 'Table');
        await pickFixtureLayer(page, FIXTURE_LAYER_TITLE);
        await wizardNext(page);
        await wizardNext(page);
        await page.getByText('Title', { exact: true }).locator('xpath=following::input[1]').fill('E2E target table');
        await saveWidget(page);
        await expect(page.getByText(`${FIXTURE_FEATURES.length} Items`)).toBeVisible({ timeout: 30000 });
    }

    /** Starts a filter selector on the city names of the fixture layer. */
    async function newDashboardCityFilter(page) {
        await addWidget(page, 'Filter selector');
        await page.getByText('Layer', { exact: true }).locator('xpath=following::button[.//*[contains(@class,"glyphicon-folder-open")]][1]').click();
        await pickFixtureLayer(page, FIXTURE_LAYER_TITLE);
        // The selected layer is used through the next arrow of the layer selector.
        await wizardNext(page);
        await selectComboByLabel(page, 'Value Attribute', 'name');
        await expect(items(preview(page))).toHaveCount(FIXTURE_FEATURES.length, { timeout: 30000 });
    }

    test('A filter selector filters the table widget it is connected to', fromScenario('Dashboard/Widget — Filter Widget in dashboard (@GH-11633)'), async({ page, data }) => {
        const dashboard = await data.dashboard();

        await openDashboard(page, dashboard.id);
        await addTable(page);
        await newDashboardCityFilter(page);
        await page.getByText('Interactions', { exact: true }).click();
        const target = page.getByText('E2E target table').locator('xpath=ancestor::*[.//button][1]');
        await target.locator('button').last().click();
        const widget = await saveFilter(page, 'E2E dashboard filter');
        await items(widget).filter({ hasText: 'Roma' }).click();
        await expect(page.getByText('1 Item', { exact: true })).toBeVisible({ timeout: 30000 });
    });

    test('A style list switches the style of a map widget layer', fromScenario('Dashboard/Widget — Apply Style on  Filter Widget in dashboard'), async({ page, data }) => {
        const map = await data.map({ data: mapConfig([background(), fixtureLayer()]) });
        const dashboard = await data.dashboard();

        await openDashboard(page, dashboard.id);
        await addWidget(page, 'Map');
        await page.getByText(map.name, { exact: true }).first().click();
        await wizardNext(page);
        await wizardNext(page);
        await page.getByText('Title', { exact: true }).locator('xpath=following::input[1]').fill('E2E styled map');
        await saveWidget(page);

        await addWidget(page, 'Filter selector');
        await selectComboByLabel(page, 'Data Source', 'User Defined');
        await selectComboByLabel(page, 'Type', 'Style list');
        await page.getByText('Layer', { exact: true }).locator('xpath=following::button[.//*[contains(@class,"glyphicon-folder-open")]][1]').click();
        await page.locator('.Select input[role="combobox"]').filter({ visible: true }).first().fill('Local GeoServer WMS');
        await page.keyboard.press('Enter');
        await page.locator('.ms-catalog-card').filter({ hasText: FIXTURE_LAYER_NAME }).first().click();
        await wizardNext(page);
        await page.getByText('Styles', { exact: true }).locator('xpath=following::button[.//*[contains(@class,"glyphicon-plus")]][1]').click();
        await page.locator('.ms-layer-styles-list button:has(.glyphicon-chevron-down)').last().click();
        await page.getByText(/e2e_points_by_category|E2E cities by category/).first().click();

        await page.getByText('Interactions', { exact: true }).click();
        const target = page.getByText(FIXTURE_LAYER_TITLE, { exact: true }).last().locator('xpath=ancestor::*[.//button][1]');
        await target.locator('button').last().click();
        const widget = await saveFilter(page, 'E2E dashboard styles');
        const styled = page.waitForRequest((r) => /request=GetMap/i.test(r.url()) && /e2e_points_by_category/.test(decodeURIComponent(r.url())));
        await items(widget).first().click();
        await styled;
    });

    test('A filter selector without targets warns in a dashboard', fromScenario('Dashboard/Widget — Target message option on Filter Widget in dashboard'), async({ page, data }) => {
        const dashboard = await data.dashboard();

        await openDashboard(page, dashboard.id);
        await newDashboardCityFilter(page);
        const widget = await saveFilter(page, 'E2E lonely filter');
        await widget.locator('[class*=warning]').first().hover();
        await expect(page.getByText(/No target connected/)).toBeVisible();
    });

    test('Force selection works in a dashboard filter', fromScenario('Dashboard/Widget — Force selection and No selection mode options on Filter Widget in dashboard'), async({ page, data }) => {
        const dashboard = await data.dashboard();

        await openDashboard(page, dashboard.id);
        await newDashboardCityFilter(page);
        await page.getByText('Layout', { exact: true }).click();
        await layoutOption(page, 'Force Selection').evaluate((input) => input.click());
        await expect(page.getByText('Clear', { exact: true })).toHaveCount(0);
        await items(preview(page)).filter({ hasText: 'Genova' }).click();
        const widget = await saveFilter(page, 'E2E forced dashboard filter');
        const checked = widget.locator('.ms-filter-checkbox-list-items label').filter({ has: page.locator('input:checked') });
        await expect(checked).toHaveText('Genova');
    });
});

describeIfFeature('geoserverIntegration', 'Filter widgets on time', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('A time slider drives the timeline of the map', fromScenario('Maps/TOC/Widget — Filter Widget with Time dimension and Slider option'), async({ page, data }) => {
        const map = await data.map({ data: mapConfig([background(), eventsLayer()]) });
        await openMapViewer(page, map.id);
        await newEventsTimeSlider(page);
        // With the timeline on the map the layer follows it: the slider drives the timeline.
        await interactionConnect(page, 'Timeline').click();
        const widget = await saveSlider(page, 'E2E events slider');

        const time = nextEventsTime(page);
        await slideTo(widget, 'Event 2');
        expect(await time).toMatch(/^2024-01-02/);
    });

    test('A time slider filters a layer and highlights the time on a chart', fromScenario('Maps/TOC/Widget — Filter Widget and Chart Widget connection with Time dimension'), async({ page, data }) => {
        const context = await data.context({ data: await viewerContextPayload(page, { layers: [background(), eventsLayer()], exclude: ['Timeline'] }) });
        await openAppTarget(page, `#/context/${context.name}`);
        await expect(page.locator('.ol-viewport')).toBeVisible({ timeout: 30000 });

        await test.step('Line chart of the events highlighting the selected time', async() => {
            await openLayersDrawer(page);
            await selectLayerNode(page, 'e2e_events');
            await layerToolbarButton(page, 'widgets').click();
            await page.getByText('Chart', { exact: true }).first().click();
            await selectComboByLabel(page, 'X Attribute', 'event_time');
            await selectComboByLabel(page, 'Y Attribute', 'id');
            await selectComboByLabel(page, 'Operation', 'No Operation');
            await page.getByText('Axes', { exact: true }).first().click();
            await page.getByText('X axis', { exact: true }).locator('xpath=following::*[normalize-space(text())="Type"][1]/following::*[contains(@class,"Select-control")][1]').click();
            await page.locator('.Select-menu-outer').getByText('Date', { exact: true }).click();
            await page.getByText('Highlight selected time', { exact: true }).click();
            const title = page.getByText('Title', { exact: true }).locator('xpath=following::input[1]');
            await expect(async() => {
                await wizardNext(page);
                await expect(title).toBeVisible({ timeout: 2000 });
            }).toPass({ timeout: 15000 });
            await title.fill('E2E events chart');
            await saveWidget(page);
            await expect(page.locator('.mapstore-widget-card .js-plotly-plot').first()).toBeVisible({ timeout: 20000 });
        });

        await newEventsTimeSlider(page);
        await interactionConnect(page, 'Time').click();
        const rows = await page.locator('.ms-connection-row').allInnerTexts();
        const highlight = rows.find((text) => /highlight/i.test(text));
        expect(highlight, `interaction rows: ${rows.join(' | ')}`).toBeTruthy();
        await interactionConnect(page, highlight.trim()).click();
        const widget = await saveSlider(page, 'E2E events slider');

        const time = nextEventsTime(page);
        await slideTo(widget, 'Event 4');
        expect(await time).toMatch(/^2024-01-04/);
        await widget.locator('.glyphicon-resize-small, .glyphicon-resize-full').first().click();
        const shape = page.locator('.mapstore-widget-card .js-plotly-plot .shapelayer path').first();
        await expect(shape).toBeAttached({ timeout: 20000 });
        const before = await shape.getAttribute('d');
        await widget.locator('.glyphicon-resize-full').first().click();
        await slideTo(widget, 'Event 2');
        await widget.locator('.glyphicon-resize-small, .glyphicon-resize-full').first().click();
        await expect.poll(() => shape.getAttribute('d'), { timeout: 20000 }).not.toBe(before);
    });
});

