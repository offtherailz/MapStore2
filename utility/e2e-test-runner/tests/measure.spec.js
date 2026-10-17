import { test, expect, fromScenario } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { openMapViewer } from './helpers/map.js';
import { moveAwayFromTooltips } from './helpers/navigation.js';

function romeMap() {
    return { version: 2, map: { projection: 'EPSG:900913', center: { x: 12.5, y: 41.9, crs: 'EPSG:4326' }, zoom: 6, layers: [] } };
}

/** Measure toolbar: it appears under the search bar when the tool is on. */
async function openMeasure(page) {
    await page.locator('button:has(.glyphicon-1-ruler)').first().click();
    await expect(page.locator('button:has(.glyphicon-1-measure-length)')).toBeVisible();
}

/** The measure toolbar: the innermost element holding both its first tool and its close button. */
function measureToolbar(page) {
    return page.locator('div')
        .filter({ has: page.locator('button:has(.glyphicon-1-measure-length)') })
        .filter({ has: page.locator('button:has(.glyphicon-1-close)') })
        .last();
}

function measureButton(page, glyph) {
    return measureToolbar(page).locator(`button:has(.glyphicon-${glyph})`).first();
}

/** Point in the map at an offset from the centre of the viewport. */
async function mapPoint(page, dx, dy) {
    const box = await page.locator('.ol-viewport').boundingBox();

    return [box.x + box.width / 2 + dx, box.y + box.height / 2 + dy];
}

async function drawLine(page) {
    await page.mouse.click(...await mapPoint(page, -100, -50));
    await page.mouse.dblclick(...await mapPoint(page, 100, 50));
}

async function drawPolygon(page) {
    await page.mouse.click(...await mapPoint(page, -100, -80));
    await page.mouse.click(...await mapPoint(page, 100, -80));
    await page.mouse.dblclick(...await mapPoint(page, 0, 80));
}

/**
 * The labels the measure tool draws on the map, e.g. "406,694.36 m". Scoped to the map:
 * the scale bar of the footer has the same format.
 */
function measureLabels(page, unit = '(m|km)(²)?') {
    return page.locator('.ol-viewport').getByText(new RegExp(`^[\\d,.]+ ${unit}$`));
}

function measureLabel(page, unit) {
    return measureLabels(page, unit).first();
}

test.describe('Measure', () => {
    test.beforeEach(async({ page, data }, testInfo) => {
        await login(page);
        const map = await data.map({ data: romeMap() });
        testInfo.annotations.push({ type: 'map', description: String(map.id) });
        await openMapViewer(page, map.id);
        await openMeasure(page);
    });

    test('Lengths, areas and bearings are measured, in the selected unit', fromScenario('Maps/Options/Measure — Add Measure'), async({ page }) => {
        await test.step('Length, then in kilometres', async() => {
            await drawLine(page);
            await expect(measureLabel(page, 'm')).toBeVisible();
            await measureToolbar(page).getByRole('combobox').click();
            await page.getByRole('option', { name: 'km', exact: true }).click();
            await expect(measureLabel(page, 'km')).toBeVisible();
        });

        await test.step('Area', async() => {
            await measureButton(page, '1-measure-area').click();
            await drawPolygon(page);
            await expect(measureLabel(page, '(m|km)²')).toBeVisible();
        });

        await test.step('Bearing', async() => {
            await measureButton(page, '1-measure-bearing').click();
            await drawLine(page);
            await expect(page.locator('.ol-viewport').getByText(/[NS] [\d.]+° [\d.']*.*[EW]/).first()).toBeVisible();
        });

        await test.step('Closing the tool clears the measures', async() => {
            await measureButton(page, '1-close').click();
            await expect(measureLabels(page)).toHaveCount(0);
        });
    });

    test('A measure is exported as GeoJSON', fromScenario('Maps/Options/Measure — Download a measure'), async({ page }) => {
        await drawLine(page);
        await expect(measureLabel(page, 'm')).toBeVisible();
        const download = page.waitForEvent('download');
        await measureButton(page, 'ext-json').click();
        const file = await download;
        const geojson = JSON.parse(Buffer.concat(await (await file.createReadStream()).toArray()).toString());
        expect(geojson.type).toMatch(/Feature/);
        expect(JSON.stringify(geojson)).toContain('LineString');
    });

    test('A measure is added to the map as a layer', fromScenario('Maps/Options/Measure — Add measure as layer'), async({ page }) => {
        await drawLine(page);
        await expect(measureLabel(page, 'm')).toBeVisible();
        await measureButton(page, 'add-layer').click();

        await page.locator('button.ms-drawer-menu-button:has(.glyphicon-1-layer)').click();
        await moveAwayFromTooltips(page);
        await expect(page.locator('.ms-node-layer').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('.ms-node-layer').filter({ hasText: /measure/i })).toHaveCount(1);
    });

    test('A measure is turned into an annotation', fromScenario('Maps/Options/Measure — Add measure as annotation (@GH-8536)'), async({ page }) => {
        await drawLine(page);
        await expect(measureLabel(page, 'm')).toBeVisible();
        await measureButton(page, 'comment').click();

        await expect(page.getByRole('button', { name: /Geometries/ })).toBeVisible({ timeout: 15000 });
        await page.getByRole('button', { name: /Geometries/ }).click();
        // The measured line becomes a geometry of the annotation, named after the measure.
        await expect(page.locator('input[value="length"]')).toBeVisible();
        // The measure tool stays on: it is the annotation drawing that waits for it to close.
        await expect(page.getByText(/annotation drawing interactions has been deactivated/i)).toBeVisible();
    });

    test('Measures work on the 3D viewer', fromScenario('Maps/Options/Measure — 3D Measurement tools (@GH-8488 @GH-10000)'), async({ page }) => {
        test.skip(!hasFeature('cesium'), 'Requires feature cesium');
        await page.locator('button:has(.glyphicon-1-close)').last().click().catch(() => {});
        await page.locator('button:has(.glyphicon-3d)').click();
        await expect(page.locator('.cesium-widget canvas')).toBeVisible({ timeout: 30000 });
        await page.locator('button:has(.glyphicon-1-ruler)').first().click();
        await expect(page.locator('button:has(.glyphicon-1-measure-length), button:has(.glyphicon-measure-distance)').first()).toBeVisible({ timeout: 15000 });

        // The 3D toolbar offers seven tools: length, geodesic length, area, point
        // coordinates, height from terrain, angle and slope.
        await expect(page.locator('button:has(.glyphicon-1-measure-length)').locator('xpath=..').locator('button'))
            .toHaveCount(7);

        // Measures, labels and hints are drawn in the 3D canvas, not in the DOM: the drawing
        // is checked to end without errors.
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const canvas = page.locator('.cesium-widget canvas');
        const box = await canvas.boundingBox();
        await page.mouse.click(box.x + box.width / 2 - 100, box.y + box.height / 2);
        await page.mouse.dblclick(box.x + box.width / 2 + 100, box.y + box.height / 2);
        await expect(canvas).toBeVisible();
        expect(errors.filter((message) => !/checkBrowser/.test(message))).toEqual([]);
    });
});
