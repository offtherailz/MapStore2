import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { openAppTarget } from './helpers/navigation.js';
import {
    fixtureLayer,
    fixtureTableLayer,
    mapConfig,
    openMapViewer,
    openLayersDrawer,
    selectLayerNode,
    layerToolbarButton,
    FIXTURE_FEATURES,
    FIXTURE_LAYER_TITLE
} from './helpers/map.js';
import { viewerContextPayload } from './helpers/content.js';
import { insertFeature, deleteFeatures, findFeatures } from './api/wfs.js';

const background = () => fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined, visibility: false });

const grid = (page) => page.locator('.feature-grid-container');
const rows = (page) => page.locator('.react-grid-Row');
const row = (page, text) => rows(page).filter({ hasText: text });
const toolbar = (page, id) => page.locator(`#${id}`);

/** Opens the attribute table of a layer of the open map. */
async function openAttributeTable(page, title) {
    await openLayersDrawer(page);
    await selectLayerNode(page, title);
    await layerToolbarButton(page, 'features-grid').click();
    await expect(grid(page)).toBeVisible({ timeout: 30000 });
    await expect(rows(page).first().or(page.getByText('No Features Available')).first()).toBeVisible({ timeout: 30000 });
}

/**
 * Horizontal centre of a column. The grid renders its cells out of the column order, so
 * columns are found by the position of their header.
 */
async function columnX(page, column) {
    const header = page.locator('.react-grid-HeaderCell').filter({ hasText: new RegExp(`^${column}$`) }).first();
    const box = await header.boundingBox();

    return box.x + box.width / 2;
}

/** Quick filter cell of a column, below its header. */
async function filterCell(page, column) {
    const x = await columnX(page, column);
    const cells = page.locator('.react-grid-HeaderRow').nth(1).locator('.react-grid-HeaderCell');
    const count = await cells.count();

    for (let index = 0; index < count; index++) {
        const box = await cells.nth(index).boundingBox();
        if (box && box.x <= x && x <= box.x + box.width) {
            return cells.nth(index);
        }
    }
    throw new Error(`No quick filter for column ${column}`);
}

/** Types in the quick filter of a column. */
async function quickFilter(page, column, text) {
    const cell = await filterCell(page, column);
    await cell.locator('input[type="text"]').last().fill(text);
}

/** Picks the operator of a quick filter: '=', '>', 'isNull'... */
async function quickFilterOperator(page, column, operator) {
    const cell = await filterCell(page, column);
    await cell.locator('.rw-dropdownlist').click();
    await page.locator('.rw-list-option').filter({ visible: true }).filter({ hasText: new RegExp(`^${operator.replace(/[<>]/g, '\\$&')}$`) }).first().click();

    return cell;
}

/** Double clicks the cell of a column in a row, which starts editing it. */
async function openCell(page, rowLocator, column) {
    const x = await columnX(page, column);
    const editor = page.locator('.rdg-editor-container input');

    // Selecting an unselected row re-renders it and can swallow the double click.
    for (let attempt = 0; attempt < 3 && !await editor.first().isVisible(); attempt++) {
        const box = await rowLocator.boundingBox();
        await page.mouse.dblclick(x, box.y + box.height / 2);
        await editor.first().waitFor({ timeout: 2000 }).catch(() => {});
    }
    await expect(editor.first()).toBeVisible();
}

/** Edits a cell of a row in edit mode: double click, new value, Enter. */
async function editCell(page, rowText, column, value) {
    await openCell(page, row(page, rowText), column);
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(String(value));
    await page.keyboard.press('Enter');
}

/** Ticks the selection box of a row. */
async function selectRow(rowLocator) {
    await rowLocator.locator('.react-grid-checkbox-container').first().click();
    await expect(rowLocator.locator('input[type="checkbox"]').first()).toBeChecked();
}

async function saveChanges(page) {
    // The table reloads its features after a save.
    const reload = page.waitForResponse((r) => r.request().method() === 'POST' && /GetFeature/.test(r.request().postData() ?? ''));
    await toolbar(page, 'fg-save-feature').click();
    const confirm = page.getByRole('button', { name: /^(Save|Yes|Confirm)$/ });
    if (await confirm.last().isVisible().catch(() => false)) {
        await confirm.last().click();
    }
    await expect(toolbar(page, 'fg-save-feature')).toBeHidden({ timeout: 20000 });
    await reload;
}

/** Deletes the selected rows, confirming it. */
async function removeSelected(page, count) {
    await toolbar(page, 'fg-remove-features').click();
    const dialog = page.locator('.modal-dialog, [role="dialog"]').filter({ hasText: `delete ${count} features` });
    await dialog.getByRole('button', { name: 'Delete' }).click();
}

describeIfFeature('geoserverIntegration', 'Attribute table', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test.describe('Editing', () => {
        const name = `E2E edit ${Date.now()}`;

        test.beforeEach(async() => {
            await insertFeature('e2e_edit', { name, category: 'town', population: 10 }, [10.5, 44.5]);
        });

        test.afterEach(async() => {
            for (const value of [name, `${name} edited`, `${name} new`]) {
                await deleteFeatures('e2e_edit', 'name', value);
            }
        });

        test('Several attributes of a feature are edited and saved', fromScenario(
            'Maps/TOC/Attribute_Table — Edit Attribute Table (@GH-9956 @GH-11489)',
            'Maps/TOC/Attribute_Table — Editing multiple fields in Attribute Table (@GH-10648)'
        ), async({ page, data }) => {
            const map = await data.map({ data: mapConfig([background(), fixtureTableLayer('e2e_edit')]) });

            await openMapViewer(page, map.id);
            await openAttributeTable(page, 'e2e_edit');
            await quickFilter(page, 'name', name);
            await expect(rows(page)).toHaveCount(1);
            await toolbar(page, 'fg-edit-mode').click();
            await editCell(page, name, 'category', 'village');
            await editCell(page, name, 'population', 25);
            await saveChanges(page);

            await expect.poll(async() => (await findFeatures('e2e_edit', 'name', name))[0]?.properties)
                .toMatchObject({ category: 'village', population: 25 });
        });

        test('A feature is deleted', fromScenario('Maps/TOC/Attribute_Table — Delete a feature'), async({ page, data }) => {
            const map = await data.map({ data: mapConfig([background(), fixtureTableLayer('e2e_edit')]) });

            await openMapViewer(page, map.id);
            await openAttributeTable(page, 'e2e_edit');
            await quickFilter(page, 'name', name);
            await expect(rows(page)).toHaveCount(1);
            await toolbar(page, 'fg-edit-mode').click();
            await selectRow(row(page, name));
            await removeSelected(page, 1);

            await expect.poll(async() => (await findFeatures('e2e_edit', 'name', name)).length, { timeout: 20000 }).toBe(0);
        });

        test('A new feature is drawn on the map and saved with its attributes', fromScenario('Maps/TOC/Attribute_Table — Create new geometry'), async({ page, data }) => {
            const map = await data.map({ data: mapConfig([background(), fixtureTableLayer('e2e_edit')]) });

            await openMapViewer(page, map.id);
            await openAttributeTable(page, 'e2e_edit');
            await toolbar(page, 'fg-edit-mode').click();
            await toolbar(page, 'fg-add-feature').click();
            await toolbar(page, 'fg-draw-feature').click();
            await page.mouse.click(700, 250);
            // The new row gets its geometry: the toolbar offers to delete it.
            await expect(toolbar(page, 'fg-delete-geometry')).toBeVisible();
            await openCell(page, rows(page).first(), 'name');
            await page.keyboard.type(`${name} new`);
            await page.keyboard.press('Enter');
            await expect(rows(page).first()).toContainText(`${name} new`);
            await saveChanges(page);

            await expect.poll(async() => (await findFeatures('e2e_edit', 'name', `${name} new`))[0]?.geometry?.type, { timeout: 20000 }).toBe('Point');
        });
    });

    test('Snapping is offered while editing', fromScenario('Maps/TOC/Attribute_Table — Support Editing with snapping (@GH-7869)'), async({ page, data }) => {
        const map = await data.map({ data: mapConfig([background(), fixtureTableLayer('e2e_edit')]) });

        await openMapViewer(page, map.id);
        await openAttributeTable(page, 'e2e_edit');
        await toolbar(page, 'fg-edit-mode').click();
        const snap = toolbar(page, 'snap-button');
        await expect(snap).toBeVisible();
        await snap.click();
        await expect(snap).toHaveClass(/active|success/);
    });

    test('Editing can be disabled for a layer', fromScenario('Maps/TOC/Attribute_Table — Attribute Table in read only mode (@GH-9180)'), async({ page, data }) => {
        const map = await data.map({ data: mapConfig([background(), fixtureTableLayer('e2e_edit')]) });

        await openMapViewer(page, map.id);
        await openLayersDrawer(page);
        await selectLayerNode(page, 'e2e_edit');
        await layerToolbarButton(page, 'wrench').click();
        await page.getByRole('checkbox', { name: /Disable editing on Attribute table/i }).check();
        await page.locator('.ms-close:has(.glyphicon-1-close)').filter({ visible: true }).first().click();

        await layerToolbarButton(page, 'features-grid').click();
        await expect(grid(page)).toBeVisible({ timeout: 30000 });
        await expect(toolbar(page, 'fg-search')).toBeVisible();
        await expect(toolbar(page, 'fg-edit-mode')).toHaveCount(0);
    });

    test('Hidden columns are kept with the map', fromScenario('Maps/TOC/Attribute_Table — Configure hidden columns (@GH-9219 @GH-10570)'), async({ page, data }) => {
        const map = await data.map({ data: mapConfig([background(), fixtureLayer()]) });

        await openMapViewer(page, map.id);
        await openAttributeTable(page, FIXTURE_LAYER_TITLE);
        await toolbar(page, 'fg-grid-settings').click();
        await page.getByRole('checkbox', { name: 'category' }).uncheck();
        await expect(page.locator('.react-grid-HeaderCell').filter({ hasText: /^category$/ })).toHaveCount(0);
        await page.locator('.ms-brand-navbar button:has(.glyphicon-floppy-disk)').first().click();
        await expect(page.getByText('Saved successfully')).toBeVisible({ timeout: 20000 });

        await openMapViewer(page, map.id);
        await openAttributeTable(page, FIXTURE_LAYER_TITLE);
        await expect(page.locator('.react-grid-HeaderCell').filter({ hasText: /^name$/ }).first()).toBeVisible();
        await expect(page.locator('.react-grid-HeaderCell').filter({ hasText: /^category$/ })).toHaveCount(0);
    });

    test('The features are filtered by the viewport', fromScenario('Maps/TOC/Attribute_Table — Filter data with the current viewport'), async({ page, data }) => {
        // Zoomed on Rome, far from the other cities.
        const config = mapConfig([background(), fixtureLayer()]);
        config.map.center = { x: 12.4964, y: 41.9028, crs: 'EPSG:4326' };
        config.map.zoom = 11;
        const map = await data.map({ data: config });

        await openMapViewer(page, map.id);
        await openAttributeTable(page, FIXTURE_LAYER_TITLE);
        await expect(rows(page)).toHaveCount(FIXTURE_FEATURES.length);
        await toolbar(page, 'fg-viewportFilter-button').click();
        await expect(rows(page)).toHaveCount(1, { timeout: 20000 });
        await expect(row(page, 'Roma')).toBeVisible();

        await page.getByRole('combobox', { name: 'Scale:' }).selectOption('5');
        await expect(rows(page)).toHaveCount(FIXTURE_FEATURES.length, { timeout: 20000 });
    });

    test('The map shows only the features of the quick filter when synced', fromScenario('Maps/TOC/Attribute_Table — Sync map with filter'), async({ page, data }) => {
        const map = await data.map({ data: mapConfig([background(), fixtureLayer()]) });

        await openMapViewer(page, map.id);
        await openAttributeTable(page, FIXTURE_LAYER_TITLE);
        await quickFilter(page, 'name', 'Roma');
        await expect(rows(page)).toHaveCount(1);
        const getMap = page.waitForRequest((r) => /request=GetMap/i.test(r.url()) && /CQL_FILTER|FILTER=/i.test(r.url()));
        await toolbar(page, 'fg-grid-map-filter').click();
        expect(decodeURIComponent((await getMap).url())).toMatch(/roma/i);
    });

    test('The map zooms to a feature of the table', fromScenario('Maps/TOC/Attribute_Table — Zoom to feature'), async({ page, data }) => {
        const map = await data.map({ data: mapConfig([background(), fixtureLayer()]) });
        const zoom = () => page.getByRole('combobox', { name: 'Scale:' }).inputValue().then(Number);

        await openMapViewer(page, map.id);
        await openAttributeTable(page, FIXTURE_LAYER_TITLE);
        const start = await zoom();
        await row(page, 'Roma').locator('.glyphicon-zoom-to').click();
        await expect.poll(zoom, { timeout: 20000 }).toBeGreaterThan(start);
    });

    test('A feature clicked on the map filters the table', fromScenario('Maps/TOC/Attribute_Table — Attribute Table filter with click on map a feature/Alt + Mouse/Ctrl + click features in map'), async({ page, data }) => {
        const config = mapConfig([background(), fixtureLayer()]);
        config.map.center = { x: 12.4964, y: 41.9028, crs: 'EPSG:4326' };
        config.map.zoom = 10;
        const map = await data.map({ data: config });

        await openMapViewer(page, map.id);
        await openAttributeTable(page, FIXTURE_LAYER_TITLE);
        await page.locator('.react-grid-HeaderRow').nth(1).locator('button:has(.glyphicon-map-marker), .glyphicon-map-marker').first().click();
        // The table covers the bottom of the map only: Rome stays at the centre of the viewport.
        const box = await page.locator('.ol-viewport').boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await expect(rows(page)).toHaveCount(1, { timeout: 20000 });
        await expect(row(page, 'Roma')).toBeVisible();
    });

    test('Quick filters compare numbers and dates and find empty values', fromScenario('Maps/TOC/Attribute_Table — Time range filtering for Attribute Table quick filter (@GH-9706)'), async({ page, data }) => {
        const map = await data.map({ data: mapConfig([background(), fixtureTableLayer('e2e_events'), fixtureTableLayer('e2e_stats', { type: 'wfs', url: fixtureTableLayer('e2e_stats').search.url })]) });

        await openMapViewer(page, map.id);
        await openAttributeTable(page, 'e2e_events');
        await expect(rows(page)).toHaveCount(5);

        await test.step('Greater than a date', async() => {
            const cell = await quickFilterOperator(page, 'event_time', '>');
            const input = cell.locator('input.rw-input');
            await input.fill('01/03/2024');
            await input.press('Enter');
            await expect(rows(page)).toHaveCount(3, { timeout: 20000 });
            await expect(row(page, 'Event 3')).toBeVisible();
            await expect(row(page, 'Event 2')).toHaveCount(0);
        });

        await test.step('Greater than a number, together with the date', async() => {
            await quickFilterOperator(page, 'id', '>');
            await quickFilter(page, 'id', '4');
            await expect(rows(page)).toHaveCount(1, { timeout: 20000 });
            await expect(row(page, 'Event 5')).toBeVisible();
        });

        await test.step('Empty values', async() => {
            await grid(page).locator('button:has(.glyphicon-1-close)').last().click();
            await openAttributeTable(page, 'e2e_stats');
            await quickFilterOperator(page, 'visitors', 'isNull');
            await expect(rows(page)).toHaveCount(1, { timeout: 20000 });
            await expect(row(page, 'Liguria')).toBeVisible();
        });
    });

    test('A layer with a second geometry among its attributes opens in the table', fromScenario('Maps/TOC/Attribute_Table — Layer with additional geometries in attributes (@GH-10699)'), async({ page, data }) => {
        const map = await data.map({ data: mapConfig([background(), fixtureTableLayer('e2e_multigeom')]) });

        await openMapViewer(page, map.id);
        await openAttributeTable(page, 'e2e_multigeom');
        await expect(row(page, 'Roma area')).toBeVisible();
        await expect(page.locator('.ol-viewport')).toBeVisible();
    });

    test('All the columns of an empty layer can be reached', fromScenario('Maps/TOC/Attribute_Table — View empty layer (@GH-11855)'), async({ page, data }) => {
        const map = await data.map({ data: mapConfig([background(), fixtureTableLayer('e2e_empty')]) });

        await openMapViewer(page, map.id);
        await openAttributeTable(page, 'e2e_empty');
        await expect(page.getByText('No Features Available')).toBeVisible();
        const last = page.locator('.react-grid-HeaderCell').filter({ hasText: /^column_20$/ }).first();
        await last.scrollIntoViewIfNeeded();
        await expect(last).toBeInViewport();
    });

    test('The values of an attribute are suggested from another layer', fromScenario('Maps/TOC/Attribute_Table — Use another layer as input for attribute table dropdown (@GH-11143)'), async({ page, data }) => {
        const payload = await viewerContextPayload(page, {
            layers: [background(), fixtureTableLayer('e2e_edit')],
            cfg: {
                FeatureEditor: {
                    customEditorsOptions: {
                        rules: [{
                            regex: { attribute: 'category', typeName: 'e2e:e2e_edit' },
                            editor: 'CustomAutocompleteEditor',
                            editorProps: {
                                filterProps: { blacklist: [], maxFeatures: 3, queriableAttributes: ['name'], predicate: 'ILIKE', typeName: 'e2e:e2e_points' }
                            }
                        }]
                    }
                }
            }
        });
        const context = await data.context({ data: payload });

        await openAppTarget(page, `#/context/${context.name}`);
        await openAttributeTable(page, 'e2e_edit');
        await toolbar(page, 'fg-edit-mode').click();
        await openCell(page, row(page, 'Torino'), 'category');
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.type('Mi', { delay: 100 });
        await expect(page.getByText('Milano').first()).toBeVisible({ timeout: 20000 });
        // Nothing is saved: the fixture row keeps its value.
        await page.keyboard.press('Escape');
    });

    test.describe('Non spatial layer', () => {
        const region = `E2E region ${Date.now()}`;


        test.afterEach(async() => {
            for (const value of [region, `${region} edited`]) {
                await deleteFeatures('e2e_stats', 'region', value);
            }
        });

        test('A table without geometry is browsed and edited', fromScenario('Maps/Options/Catalog — Non-spatial Dataset (@GH-11746)'), async({ page, data }) => {
            const map = await data.map({ data: mapConfig([background()]) });

            // Added from the WFS catalog, as a user does.
            await openMapViewer(page, map.id);
            await page.locator('button.ms-drawer-menu-button:has(.glyphicon-1-layer)').click();
            await page.mouse.move(640, 360);
            await page.locator('button.toc-toolbar-button:has(.glyphicon-add-layer)').click();
            const catalog = page.locator('.ms-catalog-panel');
            await catalog.locator('.Select input[role="combobox"]').first().fill('Local GeoServer WFS');
            await page.keyboard.press('Enter');
            await catalog.getByRole('textbox', { name: 'Search' }).fill('e2e_stats');
            await page.keyboard.press('Enter');
            await catalog.locator('.ms-catalog-card').filter({ hasText: 'e2e:e2e_stats' }).locator('button:has(.glyphicon-plus)').first().click();
            await catalog.locator('button:has(.glyphicon-1-close)').first().click();
            await openAttributeTable(page, 'e2e_stats');
            await expect(row(page, 'Lazio')).toBeVisible();
            await expect(toolbar(page, 'fg-viewportFilter-button')).toHaveCount(0);
            await expect(toolbar(page, 'fg-grid-map-filter')).toHaveCount(0);
            await expect(page.locator('.react-grid-Row .glyphicon-zoom-to')).toHaveCount(0);

            await toolbar(page, 'fg-edit-mode').click();
            await expect(toolbar(page, 'fg-draw-feature')).toHaveCount(0);
            await toolbar(page, 'fg-add-feature').click();
            // The new row is the one without values yet.
            const newRow = rows(page).filter({ hasNotText: /[A-Za-z0-9]/ });
            await expect(newRow).toHaveCount(1);
            await openCell(page, newRow, 'region');
            await page.keyboard.type(region);
            await page.keyboard.press('Enter');
            await expect(row(page, region)).toHaveCount(1);
            await saveChanges(page);
            await expect.poll(async() => (await findFeatures('e2e_stats', 'region', region)).length, { timeout: 20000 }).toBe(1);

            // The saved row moves to the end of the table: the quick filter brings it back.
            await toolbar(page, 'fg-back-view').click();
            await quickFilter(page, 'region', region);
            await expect(rows(page)).toHaveCount(1);
            await toolbar(page, 'fg-edit-mode').click();
            await editCell(page, region, 'region', `${region} edited`);
            await saveChanges(page);
            await expect.poll(async() => (await findFeatures('e2e_stats', 'region', `${region} edited`)).length, { timeout: 20000 }).toBe(1);

            // Deleting in the same editing session as the insert sends an empty transaction:
            // the table is opened again first.
            await grid(page).locator('button:has(.glyphicon-1-close)').last().click();
            await openAttributeTable(page, 'e2e_stats');
            await quickFilter(page, 'region', `${region} edited`);
            await expect(rows(page)).toHaveCount(1);
            await toolbar(page, 'fg-edit-mode').click();
            await selectRow(row(page, `${region} edited`));
            await removeSelected(page, 1);
            await expect.poll(async() => (await findFeatures('e2e_stats', 'region', `${region} edited`)).length, { timeout: 20000 }).toBe(0);
        });
    });
});
