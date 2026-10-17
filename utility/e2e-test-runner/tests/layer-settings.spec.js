import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature, getServiceUrl } from './config.js';
import { login } from './helpers/auth.js';
import { fixtureLayer, mapConfig, openMapViewer, openLayersDrawer, selectLayerNode, layerToolbarButton, FIXTURE_LAYER_NAME, FIXTURE_LAYER_TITLE } from './helpers/map.js';

const background = () => fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined, visibility: false });

function romeMap(layers) {
    const config = mapConfig(layers);
    config.map.center = { x: 12.4964, y: 41.9028, crs: 'EPSG:4326' };
    config.map.zoom = 10;

    return config;
}

/**
 * Opens a tab of the settings of a layer. The tabs carry only a glyph: wrench General,
 * eye-open Display, list Fields, dropper Style, map-marker Feature Info.
 */
async function openSettings(page, title, glyph) {
    await openLayersDrawer(page);
    await selectLayerNode(page, title);
    await layerToolbarButton(page, 'wrench').click();
    await page.locator(`a:has(.glyphicon-${glyph})`).filter({ visible: true }).first().click();
}

/** Picks an option of the react-select following a label of the settings panel. */
async function pickOption(page, label, option) {
    const control = page.getByText(label, { exact: true }).locator('xpath=following::*[contains(@class,"Select-control")][1]');
    await control.locator('.Select-arrow-zone').click();
    await page.locator('.Select-option').filter({ hasText: new RegExp(`^${option}$`) }).first().click();
}

async function closeSettings(page) {
    await page.locator('.ms-close:has(.glyphicon-1-close)').filter({ visible: true }).first().click();
}

function nextGetMap(page, predicate = () => true) {
    return page.waitForRequest((r) => /request=GetMap/i.test(r.url()) && r.url().includes(encodeURIComponent(FIXTURE_LAYER_NAME)) && predicate(new URL(r.url())));
}

describeIfFeature('geoserverIntegration', 'Layer settings', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('The image format of a layer is used by its requests', fromScenario('Maps/TOC — Change Format'), async({ page, data }) => {
        const map = await data.map({ data: romeMap([background(), fixtureLayer()]) });

        await openMapViewer(page, map.id);
        await openSettings(page, FIXTURE_LAYER_TITLE, 'eye-open');
        const getMap = nextGetMap(page, (url) => url.searchParams.get('FORMAT') === 'image/jpeg');
        await pickOption(page, 'Format', 'image/jpeg');
        await getMap;
    });

    test('The tile size of a layer is used by its requests', fromScenario('Maps/TOC — Change Layer Tile Size'), async({ page, data }) => {
        const map = await data.map({ data: romeMap([background(), fixtureLayer()]) });

        await openMapViewer(page, map.id);
        await openSettings(page, FIXTURE_LAYER_TITLE, 'eye-open');
        const getMap = nextGetMap(page, (url) => url.searchParams.get('WIDTH') === '512' && url.searchParams.get('HEIGHT') === '512');
        await pickOption(page, 'Tile size (WMS)', '512');
        await getMap;
    });

    test('Single tile asks the whole view in one request', fromScenario('Maps/TOC — Set Single Tile and Force proxy options'), async({ page, data }) => {
        const map = await data.map({ data: romeMap([background(), fixtureLayer()]) });

        await openMapViewer(page, map.id);
        await openSettings(page, FIXTURE_LAYER_TITLE, 'eye-open');
        const getMap = nextGetMap(page, (url) => url.searchParams.get('TILED') === 'false' && Number(url.searchParams.get('WIDTH')) > 512);
        await page.getByRole('checkbox', { name: 'Single Tile' }).check();
        await getMap;
    });

    test('The remote tile grids of the service are used when enabled', fromScenario('Maps/TOC — Use remote custom tiles grid options'), async({ page, data }) => {
        const map = await data.map({ data: romeMap([background(), fixtureLayer()]) });

        await openMapViewer(page, map.id);
        await openSettings(page, FIXTURE_LAYER_TITLE, 'eye-open');
        await expect(page.getByRole('checkbox', { name: 'Use cache options' })).toBeChecked();
        // The grids are read from the WMTS capabilities of the GeoServer tile cache.
        const remoteGrids = page.locator('.ms-wms-cache-options-toolbar button:has(.glyphicon-grid-regular)');
        const capabilities = page.waitForRequest((r) => /gwc\/service\/wmts/i.test(r.url()) && /GetCapabilities/i.test(r.url()));
        await remoteGrids.click();
        await capabilities;
        await expect(page.locator('.ms-wms-cache-options-toolbar button.active')).toBeVisible();
    });

    test('A layer is hidden outside its visibility limits', fromScenario('Maps/TOC — Enable Visibility limits (@GH-9775 @GH-10355 @GH-10739)'), async({ page, data }) => {
        const map = await data.map({ data: romeMap([background(), fixtureLayer()]) });

        await openMapViewer(page, map.id);
        await openSettings(page, FIXTURE_LAYER_TITLE, 'eye-open');
        // The limits are on by default: only the values are set.
        await expect(page.locator('.ms-visibility-limits-form-title input[type="checkbox"]')).toBeChecked();
        // Visible below 1:1,155,583: the map at zoom 10 (about 1:577,792) shows it.
        await page.locator('.Select').filter({ hasText: 'Select max value' }).locator('.Select-arrow-zone').click();
        await page.locator('.Select-option').filter({ hasText: /^1 : 1155583\s*$/ }).click();
        await closeSettings(page);

        const node = page.locator('.ms-node-layer').filter({ hasText: FIXTURE_LAYER_TITLE });
        await page.getByRole('combobox', { name: 'Scale:' }).selectOption('6');
        await expect(node).toHaveClass(/\binactive\b/);
        await page.getByRole('combobox', { name: 'Scale:' }).selectOption('10');
        await expect(node).not.toHaveClass(/\binactive\b/);
    });

    test('The description of a layer stays when moving between tabs', fromScenario('Maps/TOC — Change layer description (@GH-11397)'), async({ page, data }) => {
        const map = await data.map({ data: romeMap([background(), fixtureLayer({ description: 'E2E layer description' })]) });

        await openMapViewer(page, map.id);
        await openSettings(page, FIXTURE_LAYER_TITLE, 'wrench');
        await expect(page.locator('textarea').first()).toHaveValue('E2E layer description');
        await page.locator('a:has(.glyphicon-dropper)').filter({ visible: true }).first().click();
        await page.locator('a:has(.glyphicon-wrench)').filter({ visible: true }).first().click();
        await expect(page.locator('textarea').first()).toHaveValue('E2E layer description');
    });

    test('Field aliases are shown by the attribute table and kept by the exported map', fromScenario('Maps/TOC/Fields — Fields tab (@GH-9127 @GH-9136)'), async({ page, data }) => {
        const map = await data.map({ data: romeMap([background(), fixtureLayer()]) });

        await openMapViewer(page, map.id);
        await openSettings(page, FIXTURE_LAYER_TITLE, 'list');
        // Each field is a row of inputs: name, alias, type.
        const alias = page.locator('input[value="category"]').locator('xpath=following::input[1]');
        await alias.fill('E2E kind');
        await closeSettings(page);

        await layerToolbarButton(page, 'features-grid').click();
        await expect(page.locator('.react-grid-HeaderCell').filter({ hasText: /^E2E kind$/ })).toBeVisible({ timeout: 30000 });

        // The export tool of the side bar, not the layer one of the table of contents.
        await page.locator('button.btn-tray:has(.glyphicon-download)').click();
        const exportPanel = page.locator('.export-panel');
        await exportPanel.getByRole('button', { name: 'MapStore' }).click();
        const download = page.waitForEvent('download');
        await exportPanel.getByRole('button', { name: 'Export' }).click();
        const exported = JSON.parse(Buffer.concat(await (await (await download).createReadStream()).toArray()).toString());
        const layer = exported.map.layers.find((item) => item.name === FIXTURE_LAYER_NAME && item.group !== 'background');
        expect(JSON.stringify(layer.fields)).toContain('E2E kind');
    });

    test('An identify template shows an image whose URL depends on the feature', fromScenario('Maps/TOC/Template — Parametric image (@GH-9254)'), async({ page, data }) => {
        const map = await data.map({ data: romeMap([background(), fixtureLayer()]) });
        const imageUrl = `${getServiceUrl('geoserver')}/wms?SERVICE=WMS&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${FIXTURE_LAYER_NAME}&e2e=\${properties.name}`;

        await openMapViewer(page, map.id);
        await openSettings(page, FIXTURE_LAYER_TITLE, 'map-marker');
        await page.getByRole('button', { name: 'Add new identify view' }).click();
        await page.locator('.ms-feature-info-views .Select-arrow-zone').click();
        await page.locator('.Select-option').filter({ hasText: 'TEMPLATE' }).click();
        await page.locator('.ms-feature-info-views button:has(.glyphicon-pencil)').first().click();
        const editor = page.locator('.ms-feature-info-editor');
        await editor.locator('.public-DraftEditor-content').click();
        await page.keyboard.type('E2E picture of ${properties.name}', { delay: 10 });
        await editor.locator('.rdw-image-wrapper .rdw-option-wrapper').first().click();
        await page.locator('.rdw-image-modal-url-input').fill(imageUrl);
        await page.locator('.rdw-image-modal-btn').filter({ hasText: 'Add' }).click();
        await expect(editor.locator('.public-DraftEditor-content img')).toHaveCount(1);
        // The editor forwards its content after a debounce: closing it before drops the last edits.
        await page.waitForTimeout(1000);
        await editor.getByRole('button', { name: 'Close', exact: true }).click();
        await expect(editor).toBeHidden();
        await closeSettings(page);

        const box = await page.locator('.ol-viewport').boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await expect(page.getByText('E2E picture of Roma')).toBeVisible({ timeout: 20000 });
        await expect(page.locator('img[src*="e2e=Roma"]')).toBeVisible();
    });
});
