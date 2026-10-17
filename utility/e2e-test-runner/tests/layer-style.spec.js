import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { openAppTarget } from './helpers/navigation.js';
import { fixtureLayer, fixtureTableLayer, mapConfig, openMapViewer, openLayersDrawer, selectLayerNode, layerToolbarButton } from './helpers/map.js';
import { viewerContextPayload } from './helpers/content.js';
import { saveFromViewer } from './helpers/details.js';
import { mapPixels } from './helpers/pixels.js';
import { authorizeGeoServerRest, addLayerStyle, setDefaultStyle, layerStyles, styleBody, resetStyles } from './api/geoserver.js';

/** Cities layer whose styles this suite creates and removes. */
const LAYER = 'e2e_styled';

const RED = '#ff0000';
const BLUE = '#0000ff';

function pointSld(title, fill) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc">
  <NamedLayer><Name>${LAYER}</Name><UserStyle><Title>${title}</Title><FeatureTypeStyle><Rule>
    <PointSymbolizer><Graphic><Mark><WellKnownName>square</WellKnownName><Fill><CssParameter name="fill">${fill}</CssParameter></Fill></Mark><Size>14</Size></Graphic></PointSymbolizer>
  </Rule></FeatureTypeStyle></UserStyle></NamedLayer>
</StyledLayerDescriptor>`;
}

const background = () => fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined, visibility: false });

const panel = (page) => page.locator('.ms-side-panel').filter({ has: page.locator('.ms-style-editor-container, .ms-style-editor-list, .ms-style-editor-templates') }).first();
const toolbarButton = (page, glyph) => panel(page).locator(`button:has(.glyphicon-${glyph})`).first();
/** The toolbar marks its disabled buttons with a class only. */
const DISABLED = /\bdisabled\b/;
const styleCard = (page, title) => panel(page).locator('.mapstore-side-card').filter({ hasText: title }).first();

/** Field of a symbolizer of the visual editor, with its constant/property menu. */
const symbolizerField = (page, label) => page.locator('.ms-symbolizer-field-wrapper').filter({ has: page.locator('.ms-symbolizer-label', { hasText: new RegExp(`^${label}\\s*$`) }) }).first();

async function useProperty(page, label, property) {
    const field = symbolizerField(page, label);
    await field.locator('button:has(.glyphicon-option-vertical)').last().click();
    await field.getByRole('menuitem', { name: 'Property value' }).click();
    await field.locator('.Select-control').first().click();
    // Options read "<attribute> {<type>}".
    await page.locator('.Select-option').filter({ hasText: new RegExp(`^${property} \\{`) }).click();
}

async function openVectorStyle(page, title) {
    await openLayersDrawer(page);
    await selectLayerNode(page, title);
    await layerToolbarButton(page, 'wrench').click();
    await page.locator('a:has(.glyphicon-dropper)').filter({ visible: true }).first().click();
    await expect(page.locator('.ms-style-rules-editor')).toBeVisible({ timeout: 20000 });
}

async function openStyleTab(page) {
    await openLayersDrawer(page);
    await selectLayerNode(page, LAYER);
    await layerToolbarButton(page, 'wrench').click();
    await page.locator('a:has(.glyphicon-dropper)').filter({ visible: true }).first().click();
    await expect(panel(page).getByPlaceholder('Filter styles by name, title or abstract')).toBeVisible({ timeout: 20000 });
}

/**
 * Replaces a text in the SLD of the code editor and waits for the map preview, which
 * the editor updates in a temporary `*_ms_*` style once the typing is over: a style
 * saved before that keeps the previous code.
 */
function previewContaining(page, text) {
    return page.waitForRequest((r) => /_ms_/.test(r.url()) && r.method() === 'PUT' && (r.postData() || '').includes(text));
}

async function editCode(page, from, to) {
    const editor = panel(page).locator('.CodeMirror').first();
    await expect(editor).toBeVisible({ timeout: 20000 });
    const preview = previewContaining(page, to);
    await editor.evaluate((element, [search, replacement]) => {
        const codeMirror = element.CodeMirror;
        codeMirror.setValue(codeMirror.getValue().split(search).join(replacement));
    }, [from, to]);
    await preview;
}

/** Opens the visual editor of a style of the layer. */
async function openVisualEditor(page, title) {
    await openStyleTab(page);
    await styleCard(page, title).click();
    await toolbarButton(page, 'code').click();
    await panel(page).getByRole('button', { name: 'Visual editor' }).click();
    await page.getByRole('button', { name: 'Yes, switch to visual editor' }).click();
    await expect(panel(page).locator('.ms-style-rule').first()).toBeVisible();
}

/** Zoom level, read from the scale selector of the footer (its values are zoom levels). */
async function setZoom(page, zoom) {
    const scale = page.getByRole('combobox', { name: 'Scale:' });
    await scale.selectOption(String(zoom));
    await expect(scale).toHaveValue(String(zoom));
}

/** Closes the layer settings, which cover part of the map. */
async function closeSettings(page) {
    await panel(page).locator('.ms-close').click();
    await expect(panel(page)).toHaveCount(0);
}

async function saveStyle(page) {
    const saved = page.waitForResponse((r) => /\/rest\/workspaces\/e2e\/styles\//.test(r.url()) && !/_ms_/.test(r.url())
        && r.request().method() === 'PUT' && r.ok());
    await toolbarButton(page, 'ok').click();
    await saved;
}

describeIfFeature('geoserverIntegration', 'Layer style', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await resetStyles(LAYER);
        await authorizeGeoServerRest(page);
        await login(page);
    });

    test.afterEach(async() => {
        await resetStyles(LAYER);
    });

    test('A style is created from a template and edited', fromScenario('Maps/TOC/Layer_style — Add style'), async({ page, data }) => {
        const map = await data.map({ data: mapConfig([background(), fixtureTableLayer(LAYER)]) });

        await openMapViewer(page, map.id);
        await openStyleTab(page);
        await toolbarButton(page, '1-stilo').click();
        await panel(page).getByText('Base SLD', { exact: true }).click();
        await toolbarButton(page, 'plus').click();
        const dialog = page.locator('.modal-dialog').filter({ hasText: 'Create new style' });
        await dialog.getByPlaceholder('Enter title (alphanumeric)').fill('E2E new style');
        await dialog.getByRole('button', { name: 'Save' }).click();

        await styleCard(page, 'E2E new style').click();
        await expect(styleCard(page, 'E2E new style')).toHaveClass(/\bselected\b/);
        await toolbarButton(page, 'code').click();
        await editCode(page, '#FF0000', '#0000FF');
        await saveStyle(page);

        await expect.poll(() => mapPixels(page, BLUE), { timeout: 20000 }).toBeGreaterThan(50);
        const [created] = (await layerStyles(LAYER)).filter((name) => name.startsWith('e2e_new_style'));
        expect(await styleBody(created)).toMatch(/#0000FF/i);
    });

    test('A style is edited and the map shows the change', fromScenario('Maps/TOC/Layer_style — Edit style'), async({ page, data }) => {
        await addLayerStyle(LAYER, 'e2e_style_to_edit', pointSld('E2E style to edit', RED));
        const map = await data.map({ data: mapConfig([background(), fixtureTableLayer(LAYER, { style: 'e2e:e2e_style_to_edit' })]) });

        await openMapViewer(page, map.id);
        await expect.poll(() => mapPixels(page, RED), { timeout: 20000 }).toBeGreaterThan(50);
        await openStyleTab(page);
        await styleCard(page, 'E2E style to edit').click();
        await toolbarButton(page, 'code').click();
        await editCode(page, RED, BLUE);
        await saveStyle(page);

        await expect.poll(() => mapPixels(page, BLUE), { timeout: 20000 }).toBeGreaterThan(50);
        await expect.poll(() => mapPixels(page, RED)).toBeLessThan(10);
        expect(await styleBody('e2e_style_to_edit')).toMatch(/#0000ff/i);
    });

    test('A style is deleted', fromScenario('Maps/TOC/Layer_style — Delete style'), async({ page, data }) => {
        await addLayerStyle(LAYER, 'e2e_style_to_delete', pointSld('E2E style to delete', RED));
        const map = await data.map({ data: mapConfig([background(), fixtureTableLayer(LAYER)]) });

        await openMapViewer(page, map.id);
        await openStyleTab(page);
        await styleCard(page, 'E2E style to delete').click();
        await toolbarButton(page, 'trash').click();
        await page.locator('.modal-dialog').filter({ hasText: /delete/i }).last().getByRole('button', { name: /^(Delete|Yes|Confirm)$/ }).click();

        await expect(styleCard(page, 'E2E style to delete')).toHaveCount(0, { timeout: 20000 });
        expect(await layerStyles(LAYER)).not.toContain('e2e_style_to_delete');
    });

    test('The default style is not editable when the context disables it', fromScenario('Maps/TOC/Layer_style — Configure editing default style (@GH-10902)'), async({ page, data }) => {
        await addLayerStyle(LAYER, 'e2e_default_style', pointSld('E2E default style', RED));
        await setDefaultStyle(LAYER, 'e2e_default_style');
        await addLayerStyle(LAYER, 'e2e_other_style', pointSld('E2E other style', BLUE));
        const payload = await viewerContextPayload(page, {
            layers: [background(), fixtureTableLayer(LAYER)],
            cfg: { StyleEditor: { enableEditDefaultStyle: false } }
        });
        const context = await data.context({ data: payload });

        await openAppTarget(page, `#/context/${context.name}`);
        await expect(page.locator('.ol-viewport')).toBeVisible({ timeout: 30000 });
        await openStyleTab(page);
        await expect(toolbarButton(page, 'code')).toHaveClass(DISABLED);
        await styleCard(page, 'E2E other style').click();
        await expect(toolbarButton(page, 'code')).not.toHaveClass(DISABLED);
        await styleCard(page, 'E2E default style').click();
        await expect(toolbarButton(page, 'code')).toHaveClass(DISABLED);
    });
    test('A style rule is applied only to the features of its filter', fromScenario('Maps/TOC/Layer_style — Filter a style rule'), async({ page, data }) => {
        await addLayerStyle(LAYER, 'e2e_style_filtered', pointSld('E2E style filtered', RED));
        const map = await data.map({ data: mapConfig([background(), fixtureTableLayer(LAYER, { style: 'e2e:e2e_style_filtered' })]) });

        await openMapViewer(page, map.id);
        const all = await expect.poll(() => mapPixels(page, RED), { timeout: 20000 }).toBeGreaterThan(500).then(() => mapPixels(page, RED));
        await openVisualEditor(page, 'E2E style filtered');
        await panel(page).locator('.ms-style-rule-head-tools button:has(.glyphicon-filter)').click();
        await page.locator('#add-filter-field').click();
        const condition = page.locator('.filter-field-row').last();
        await condition.locator('.filter-field-attribute [role="combobox"]').click();
        await page.getByRole('option', { name: 'category', exact: true }).click();
        await condition.locator('.filter-field-operator [role="combobox"]').click();
        await page.getByRole('option', { name: '=', exact: true }).click();
        const preview = previewContaining(page, 'capital');
        await condition.locator('.filter-field-value input').fill('capital');
        await preview;
        await saveStyle(page);
        await closeSettings(page);

        // Only Rome, the capital, keeps the symbol.
        await expect.poll(() => mapPixels(page, RED), { timeout: 20000 }).toBeLessThan(all / 3);
        expect(await mapPixels(page, RED)).toBeGreaterThan(50);
        expect(await styleBody('e2e_style_filtered')).toMatch(/PropertyIsEqualTo[\s\S]*capital/);
    });

    test('A style rule is drawn only between its scale denominators', fromScenario('Maps/TOC/Layer_style — Add scale denominator for style rule'), async({ page, data }) => {
        await addLayerStyle(LAYER, 'e2e_style_scales', pointSld('E2E style scales', RED));
        const map = await data.map({ data: mapConfig([background(), fixtureTableLayer(LAYER, { style: 'e2e:e2e_style_scales' })]) });

        await openMapViewer(page, map.id);
        await openVisualEditor(page, 'E2E style scales');
        await panel(page).locator('.ms-style-rule-head-tools button:has(.glyphicon-1-ruler)').click();
        const preview = previewContaining(page, 'MinScaleDenominator');
        // Visible from zoom 7 (1:4,622,334) to zoom 9 (1:1,155,584).
        const scaleSelects = page.locator('.Select-control').filter({ hasText: 'Select scale' });
        await scaleSelects.first().click();
        await page.locator('.Select-option').filter({ hasText: /^1 : 4622/ }).click();
        await page.locator('.Select-control').filter({ hasText: 'Select scale' }).first().click();
        await page.locator('.Select-option').filter({ hasText: /^1 : 1155/ }).click();
        await preview;
        await saveStyle(page);
        await closeSettings(page);

        for (const [zoom, visible] of [[6, false], [8, true], [10, false]]) {
            await setZoom(page, zoom);
            if (visible) {
                await expect.poll(() => mapPixels(page, RED), { timeout: 20000, message: `zoom ${zoom}` }).toBeGreaterThan(50);
            } else {
                await expect.poll(() => mapPixels(page, RED), { timeout: 20000, message: `zoom ${zoom}` }).toBeLessThan(10);
            }
        }
    });

    test('A classification style uses custom parameters', fromScenario('Maps/TOC/Layer_style — Thematic layer integration in Visual Style Editor (@GH-803)'), async({ page, data }) => {
        await addLayerStyle(LAYER, 'e2e_style_thematic', pointSld('E2E style thematic', RED));
        const map = await data.map({ data: mapConfig([background(), fixtureTableLayer(LAYER, { style: 'e2e:e2e_style_thematic' })]) });
        const params = { params: [{
            title: 'CATEGORY', field: 'category', defaultValue: 'city',
            values: [{ name: 'capital', value: 'capital' }, { name: 'city', value: 'city' }]
        }] };

        await openMapViewer(page, map.id);
        await openVisualEditor(page, 'E2E style thematic');
        await panel(page).locator('.ms-symbolizer-info button:has(.glyphicon-option-vertical)').first().click();
        await page.getByRole('menuitem', { name: 'Classification style' }).click();
        await panel(page).locator('button:has(.glyphicon-cog)').first().click();
        const custom = page.getByText('Custom Parameters', { exact: true }).locator('xpath=ancestor::*[.//*[contains(@class,"CodeMirror")]][1]');
        await custom.locator('.CodeMirror').evaluate((element, value) => element.CodeMirror.setValue(value), JSON.stringify(params, null, 2));
        await custom.locator('button:has(.glyphicon-1-close)').click();
        await expect(symbolizerField(page, 'CATEGORY')).toBeVisible();

        await symbolizerField(page, 'Attribute').locator('.Select-control').click();
        await page.locator('.Select-option').filter({ hasText: /^population$/ }).click();
        // The custom parameters reach the SLD service as view parameters, for SQL view layers.
        const classify = page.waitForRequest((r) => /\/sldservice\/.*classify/.test(r.url()) && /viewparams=category(:|%3A)/.test(r.url()));
        await symbolizerField(page, 'CATEGORY').locator('.Select-control').click();
        await page.locator('.Select-option').filter({ hasText: /^capital$/ }).click();
        expect(decodeURIComponent((await classify).url())).toContain("viewparams=category:'capital'");
        await expect(panel(page).locator('.ms-classification-row, input[type="number"]').first()).toBeVisible();
        await page.waitForTimeout(1000);
        await saveStyle(page);
        await closeSettings(page);

        // Rome, the most populated city, takes the last colour of the OrRd ramp.
        await expect.poll(() => mapPixels(page, '#7f0000', 20), { timeout: 20000 }).toBeGreaterThan(50);
        expect((await styleBody('e2e_style_thematic')).match(/<(\w+:)?Rule>/g)).toHaveLength(5);
    });
});

test.describe('Vector layer style', () => {
    test.beforeEach(async({ page }) => {
        await login(page);
    });

    test('Symbol colour and size are read from the feature properties', fromScenario('Maps/TOC/Layer_style — Style with properties for Vector and WFS layers (@GH-9539)'), async({ page, data }) => {
        const GREEN = '#00ff00';
        const vector = {
            id: 'e2e_vector', type: 'vector', title: 'E2E vector layer', visibility: true,
            features: [[12.5, 41.9], [9.19, 45.46]].map((coordinates) => ({
                type: 'Feature', properties: { color: GREEN, size: 30 }, geometry: { type: 'Point', coordinates }
            }))
        };
        const map = await data.map({ data: mapConfig([background(), vector]) });

        await openMapViewer(page, map.id);
        await openVectorStyle(page, 'E2E vector layer');
        await page.locator('.ms-style-rules-editor button:has(.glyphicon-1-point-add)').click();
        await useProperty(page, 'Fill color', 'color');
        await expect.poll(() => mapPixels(page, GREEN), { timeout: 20000 }).toBeGreaterThan(100);
        const small = await mapPixels(page, GREEN);

        await useProperty(page, 'Radius', 'size');
        await expect.poll(() => mapPixels(page, GREEN), { timeout: 20000 }).toBeGreaterThan(small * 2);
    });

    test('A WFS layer is styled in the visual editor and its legend follows', fromScenario('Maps/TOC/Layer_style — WFS layer style and legend (@GH-8306)'), async({ page, data }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        const wfs = { id: 'e2e_wfs', type: 'wfs', url: fixtureLayer().url.replace(/wms$/, 'wfs'), name: 'e2e:e2e_points', title: 'E2E WFS layer', visibility: true };
        const map = await data.map({ data: mapConfig([background(), wfs]) });

        const features = page.waitForResponse((r) => /request=GetFeature/i.test(r.url()));
        await openMapViewer(page, map.id);
        await features;
        await openVectorStyle(page, 'E2E WFS layer');
        await page.locator('.ms-style-rules-editor button:has(.glyphicon-1-point-add)').click();
        await page.locator('.ms-style-rule').last().getByPlaceholder('Enter legend label').fill('E2E WFS cities');
        await symbolizerField(page, 'Fill color').locator('.ms-color-picker-swatch').click();
        const hex = page.locator('.ms-sketch-picker input').first();
        await hex.fill('0000FF');
        await hex.press('Enter');
        // The picker applies the colour when it closes.
        await page.mouse.click(250, 30);
        await expect.poll(() => mapPixels(page, BLUE), { timeout: 20000 }).toBeGreaterThan(100);
        // Closing the settings right after an edit, within the debounce of the editor, drops the edit.
        await page.waitForTimeout(1000);
        await page.locator('.ms-side-panel .ms-close').first().click();
        await expect.poll(() => mapPixels(page, BLUE), { timeout: 20000 }).toBeGreaterThan(100);

        const node = page.locator('.ms-node-layer').filter({ hasText: 'E2E WFS layer' }).first();
        await node.locator('.ms-node-expand, button:has(.glyphicon-next)').first().click();
        await expect(node.getByText('E2E WFS cities')).toBeVisible();
    });
});

/**
 * Binary glTF holding a tetrahedron, the smallest model the 3D model symbolizer can load.
 */
function tetrahedronGlb() {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const indices = new Uint16Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]);
    const bin = Buffer.concat([Buffer.from(positions.buffer), Buffer.from(indices.buffer)]);
    const json = Buffer.from(JSON.stringify({
        asset: { version: '2.0' },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ mesh: 0 }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
        accessors: [
            { bufferView: 0, componentType: 5126, count: 4, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 1] },
            { bufferView: 1, componentType: 5123, count: 12, type: 'SCALAR' }
        ],
        bufferViews: [
            { buffer: 0, byteOffset: 0, byteLength: positions.byteLength, target: 34962 },
            { buffer: 0, byteOffset: positions.byteLength, byteLength: indices.byteLength, target: 34963 }
        ],
        buffers: [{ byteLength: bin.length }]
    }));
    const pad = (buffer, filler) => Buffer.concat([buffer, Buffer.alloc((4 - buffer.length % 4) % 4, filler)]);
    const jsonChunk = pad(json, 0x20);
    const binChunk = pad(bin, 0);
    const chunk = (data, type) => {
        const head = Buffer.alloc(8);
        head.writeUInt32LE(data.length, 0);
        head.writeUInt32LE(type, 4);
        return Buffer.concat([head, data]);
    };
    const body = Buffer.concat([chunk(jsonChunk, 0x4E4F534A), chunk(binChunk, 0x004E4942)]);
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546C67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(12 + body.length, 8);

    return Buffer.concat([header, body]);
}

/** Style rules of a layer, as saved in the map. */
async function savedRules(api, mapId, layerId) {
    const layer = (await api.getData(mapId)).map.layers.find(({ id }) => id === layerId);

    return layer.style.body.rules;
}

/**
 * Pause between edits of the visual editor: an edit made while the previous one is still
 * being applied is discarded, and the field goes back to its previous value.
 */
const EDIT_PAUSE = 1500;

async function setNumber(page, label, value) {
    const input = symbolizerField(page, label).locator('input[type="number"]').first();
    await input.click();
    await input.press('ControlOrMeta+a');
    await input.pressSequentially(String(value), { delay: 50 });
    await input.press('Tab');
    await page.waitForTimeout(EDIT_PAUSE);
    await expect(input).toHaveValue(String(value));
}

describeIfFeature('cesium', '3D layer style', () => {
    const area = (coordinates) => ({ type: 'Feature', properties: { name: 'E2E area' }, geometry: { type: 'Polygon', coordinates: [coordinates] } });
    const point = (coordinates) => ({ type: 'Feature', properties: { name: 'E2E point' }, geometry: { type: 'Point', coordinates } });

    async function open3DStyle(page, data, features) {
        const vector = { id: 'e2e_vector', type: 'vector', title: 'E2E vector layer', visibility: true, features };
        const map = await data.map({ data: mapConfig([background(), vector]) });
        await openMapViewer(page, map.id);
        await page.locator('button:has(.glyphicon-3d)').click();
        await expect(page.locator('.cesium-widget canvas')).toBeVisible({ timeout: 30000 });
        await openVectorStyle(page, 'E2E vector layer');

        return map;
    }

    test.beforeEach(async({ page }) => {
        await login(page);
    });

    test('A 3D model symbolizer is scaled, rotated and coloured', fromScenario('Maps/TOC/Layer_style — 3D Model Symbolizer for WFS and vector layer (@GH-8734)'), async({ page, data, api }) => {
        // Served by the test itself: the style editor accepts only URLs with a valid host.
        const MODEL_URL = 'http://localhost:8082/geoserver/www/e2e/tetrahedron.glb';
        await page.route(MODEL_URL, (route) => route.fulfill({ body: tetrahedronGlb(), contentType: 'model/gltf-binary', headers: { 'Access-Control-Allow-Origin': '*' } }));
        const map = await open3DStyle(page, data, [point([12.5, 41.9])]);

        await page.locator('.ms-style-rules-editor button:has(.glyphicon-model-plus)').click();
        await page.waitForTimeout(EDIT_PAUSE);
        await symbolizerField(page, '3D Model').locator('input').first().fill(MODEL_URL);
        await page.waitForTimeout(EDIT_PAUSE);
        await setNumber(page, 'Scale', 5);
        await setNumber(page, 'Z axis rotation', 45);
        await symbolizerField(page, 'Color').locator('.ms-color-picker-swatch').click();
        const hex = page.locator('.ms-sketch-picker input').first();
        await hex.fill('00FF00');
        await hex.press('Enter');
        await page.mouse.click(250, 30);
        await page.waitForTimeout(1000);
        await page.locator('.ms-side-panel .ms-close').first().click();
        await saveFromViewer(page);

        const [symbolizer] = (await savedRules(api, map.id, 'e2e_vector'))[0].symbolizers;
        expect(symbolizer).toMatchObject({ kind: 'Model', model: MODEL_URL, scale: 5, heading: 45 });
        expect(symbolizer.color.toLowerCase()).toBe('#00ff00');
    });

    test('Polygons are extruded in 3D', fromScenario('Maps/TOC/Layer_style — Extruded features in Cesium 3D (@GH-9807)'), async({ page, data, api }) => {
        const map = await open3DStyle(page, data, [area([[12.4, 41.8], [12.6, 41.8], [12.6, 42.0], [12.4, 42.0], [12.4, 41.8]])]);

        await page.locator('.ms-style-rules-editor button:has(.glyphicon-polygon-plus)').click();
        await page.waitForTimeout(EDIT_PAUSE);
        await symbolizerField(page, 'Clamp to ground').locator('input[type="checkbox"]').uncheck();
        await page.waitForTimeout(EDIT_PAUSE);
        await symbolizerField(page, 'Extrusion relative to geometry').locator('input[type="checkbox"]').check();
        await page.waitForTimeout(EDIT_PAUSE);
        await setNumber(page, 'Extruded height', 5000);
        await page.waitForTimeout(1000);
        await page.locator('.ms-side-panel .ms-close').first().click();
        await saveFromViewer(page);

        const [symbolizer] = (await savedRules(api, map.id, 'e2e_vector'))[0].symbolizers;
        expect(symbolizer).toMatchObject({ kind: 'Fill', msClampToGround: false, msExtrusionRelativeToGeometry: true, msExtrudedHeight: 5000 });
    });
});
