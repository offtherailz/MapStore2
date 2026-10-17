import { test, expect, fromScenario } from './fixtures.js';
import { login } from './helpers/auth.js';
import { openMapViewer } from './helpers/map.js';
import { moveAwayFromTooltips } from './helpers/navigation.js';
import { annotationLayer } from './helpers/content.js';

/** Rome: maps of this suite are centred on it, and seeded annotations put their marker there. */
const ROME = [12.5, 41.9];

function romeMap(layers = []) {
    return { version: 2, map: { projection: 'EPSG:900913', center: { x: ROME[0], y: ROME[1], crs: 'EPSG:4326' }, zoom: 6, layers } };
}

async function openToc(page) {
    await page.locator('button.ms-drawer-menu-button:has(.glyphicon-1-layer)').click();
    await moveAwayFromTooltips(page);
}

/** Opens the annotations editor on an annotations layer of the TOC. */
async function editAnnotations(page, title) {
    await openToc(page);
    await page.locator('.ms-node-layer').filter({ hasText: title }).click();
    await moveAwayFromTooltips(page);
    await page.locator('button.toc-toolbar-button:has(.glyphicon-pencil)').click();
    await expect(page.getByRole('button', { name: /Geometries/ })).toBeVisible({ timeout: 15000 });
}

/** Applies the edited annotations, closes the editor, then saves the map. */
async function applyAndSave(page) {
    await page.locator('[class*="annotation"] button:has(.glyphicon-download)').first().click();
    // Applying keeps the editor open.
    await page.locator('[class*="annotation"] button:has(.glyphicon-1-close)').first().click();
    const discard = page.getByRole('dialog').getByRole('button', { name: /^(Close|Yes|Confirm)$/ });
    if (await discard.isVisible().catch(() => false)) {
        await discard.click();
    }
    await expect(page.getByRole('button', { name: /Geometries/ })).toHaveCount(0, { timeout: 15000 });
    await page.locator('.ms-brand-navbar button:has(.glyphicon-floppy-disk)').first().click();
    await expect(page.getByText('Saved successfully')).toBeVisible({ timeout: 20000 });
}

async function savedAnnotations(api, mapId) {
    const data = await (await api.context.get(`data/${mapId}`)).json();

    return data.map.layers.filter((layer) => String(layer.id).startsWith('annotations:'));
}

/** Point in the map area at an offset from the centre of the viewport. */
async function mapPoint(page, dx, dy) {
    const box = await page.locator('.ol-viewport').boundingBox();

    return [box.x + box.width / 2 + dx, box.y + box.height / 2 + dy];
}

test.describe('Annotations', () => {
    test.beforeEach(async({ page }) => {
        await login(page);
    });

    test('An annotation with every geometry type is drawn, titled and saved', fromScenario('Maps/Options/Annotations — Create an Annotation (@GH-10930)'), async({ page, api, data }) => {
        const map = await data.map({ data: romeMap() });

        await openMapViewer(page, map.id);
        await openToc(page);
        await page.locator('button:has(.glyphicon-add-comment)').first().click();
        await page.getByRole('button', { name: /Geometries/ }).click();

        // The editor covers the left part of the viewport: drawings stay on the right.
        const draw = {
            'point-plus': async() => page.mouse.click(...await mapPoint(page, 250, 0)),
            'polyline-plus': async() => {
                await page.mouse.click(...await mapPoint(page, 180, -150));
                await page.mouse.click(...await mapPoint(page, 260, -100));
                await page.mouse.dblclick(...await mapPoint(page, 340, -150));
            },
            'polygon-plus': async() => {
                await page.mouse.click(...await mapPoint(page, 180, 100));
                await page.mouse.click(...await mapPoint(page, 300, 100));
                await page.mouse.dblclick(...await mapPoint(page, 240, 200));
            },
            'font-add': async() => page.mouse.click(...await mapPoint(page, 450, -100)),
            '1-circle-add': async() => {
                await page.mouse.click(...await mapPoint(page, 450, 150));
                await page.mouse.click(...await mapPoint(page, 500, 150));
            }
        };
        for (const [glyph, action] of Object.entries(draw)) {
            await page.locator(`button:has(.glyphicon-${glyph})`).first().click();
            await action();
        }
        for (const type of ['Point', 'LineString', 'Polygon', 'Text', 'Circle']) {
            await expect(page.locator(`input[value="${type}"]`)).toHaveCount(1);
        }

        await test.step('Change the circle radius', async() => {
            const radius = page.getByRole('textbox', { name: 'radius' });
            await radius.fill('50000');
            await radius.press('Enter');
        });

        await page.getByRole('button', { name: /Properties/ }).click();
        await page.getByRole('textbox', { name: 'Title' }).fill('E2E drawn annotation');
        await applyAndSave(page);

        await expect(page.locator('.ms-node-layer').filter({ hasText: 'E2E drawn annotation' })).toBeVisible();
        const [layer] = await savedAnnotations(api, map.id);
        expect(layer.title).toBe('E2E drawn annotation');
        expect(layer.features.map((feature) => feature.properties.annotationType).sort())
            .toEqual(['Circle', 'LineString', 'Point', 'Polygon', 'Text']);
    });

    test('Identify on an annotation shows its title and description', fromScenario('Maps/Options/Annotations — GFI for Annotation'), async({ page, data }) => {
        const layer = annotationLayer({ title: 'E2E identified annotation', description: '<p>E2E annotation description</p>', point: ROME });
        const map = await data.map({ data: romeMap([layer]) });

        await openMapViewer(page, map.id);
        // The marker icon stands on the point: its body is just above the centre.
        await page.mouse.click(...await mapPoint(page, 0, -15));
        await expect(page.getByText('E2E annotation description').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('E2E identified annotation').first()).toBeVisible();
    });

    test('The coordinates of an annotation point are edited', fromScenario('Maps/Options/Annotations — Edit Annotation geometry'), async({ page, api, data }) => {
        const layer = annotationLayer({ title: 'E2E moved annotation', point: ROME });
        const map = await data.map({ data: romeMap([layer]) });

        await openMapViewer(page, map.id);
        await editAnnotations(page, 'E2E moved annotation');
        await page.getByRole('button', { name: /Geometries/ }).click();
        await page.locator('input[value="Point"]').click();
        const lon = page.getByRole('textbox', { name: 'lon' }).first();
        await lon.fill('14.25');
        await lon.press('Enter');
        await applyAndSave(page);

        const [saved] = await savedAnnotations(api, map.id);
        const point = saved.features.find((feature) => feature.geometry.type === 'Point');
        expect(point.geometry.coordinates[0]).toBeCloseTo(14.25, 2);
    });

    test('The style of an annotation geometry is edited', fromScenario('Maps/Options/Annotations — Edit Style for Annotation'), async({ page, api, data }) => {
        const layer = annotationLayer({ title: 'E2E restyled annotation', point: ROME });
        const map = await data.map({ data: romeMap([layer]) });

        await openMapViewer(page, map.id);
        await editAnnotations(page, 'E2E restyled annotation');
        await page.getByRole('button', { name: /Geometries/ }).click();
        await page.locator('input[value="Polygon"]').click();
        await page.getByRole('tab', { name: 'Style' }).or(page.getByText('Style', { exact: true })).first().click();
        await page.locator('.ms-color-picker-swatch').first().click();
        const hex = page.locator('input[spellcheck="false"]').first();
        await hex.fill('FF0000');
        await hex.press('Enter');
        await page.mouse.click(...await mapPoint(page, 400, 250));
        await applyAndSave(page);

        const [saved] = await savedAnnotations(api, map.id);
        const colors = saved.style.body.rules.flatMap((rule) => rule.symbolizers.map((symbolizer) => String(symbolizer.color).toLowerCase()));
        expect(colors).toContain('#ff0000');
    });

    test('An annotations layer is deleted', fromScenario('Maps/Options/Annotations — Delete an Annotation'), async({ page, data }) => {
        const layer = annotationLayer({ title: 'E2E deleted annotation', point: ROME });
        const map = await data.map({ data: romeMap([layer]) });

        await openMapViewer(page, map.id);
        await openToc(page);
        await page.locator('.ms-node-layer').filter({ hasText: 'E2E deleted annotation' }).click();
        await moveAwayFromTooltips(page);
        await page.locator('button.toc-toolbar-button:has(.glyphicon-trash)').click();
        const confirm = page.getByRole('dialog').getByRole('button', { name: /^(Delete|Yes|Confirm)$/ });
        if (await confirm.isVisible().catch(() => false)) {
            await confirm.click();
        }
        await expect(page.locator('.ms-node-layer').filter({ hasText: 'E2E deleted annotation' })).toHaveCount(0);
    });
});
