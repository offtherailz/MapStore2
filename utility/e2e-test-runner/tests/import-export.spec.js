import { test, expect, fromScenario } from './fixtures.js';
import { login } from './helpers/auth.js';
import { openMapViewer, openLayersDrawer } from './helpers/map.js';
import { moveAwayFromTooltips } from './helpers/navigation.js';
import { annotationLayer } from './helpers/content.js';

function romeMap(layers = []) {
    return { version: 2, map: { projection: 'EPSG:900913', center: { x: 12.5, y: 41.9, crs: 'EPSG:4326' }, zoom: 6, layers } };
}

async function readDownload(download) {
    return Buffer.concat(await (await download.createReadStream()).toArray()).toString();
}

/** Exports the open map in the given format and returns the file content. */
async function exportMap(page, format) {
    await page.locator('button:has(.glyphicon-download)').first().click();
    const panel = page.locator('.export-panel');
    await panel.getByRole('button', { name: format }).click();
    const download = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Export' }).click();

    return readDownload(await download);
}

/** Imports a file through the import panel, accepting the replacement of the map. */
async function importFile(page, file) {
    await page.locator('button:has(.glyphicon-upload)').first().click();
    await expect(page.getByText('Drop your map context or vector files here')).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(file);
}

async function tocLayer(page, title) {
    await openLayersDrawer(page);

    return page.locator('.ms-node-layer').filter({ hasText: title });
}

test.describe('Map import and export', () => {
    test.beforeEach(async({ page }) => {
        await login(page);
    });

    test('A map is exported in the MapStore format', fromScenario('Maps/Options/Export — Export a MapStore file'), async({ page, data }) => {
        const map = await data.map({ data: romeMap([annotationLayer({ title: 'E2E exported layer', point: [12.5, 41.9] })]) });

        await openMapViewer(page, map.id);
        const exported = JSON.parse(await exportMap(page, 'MapStore'));
        expect(exported.map.layers.map((layer) => layer.title)).toContain('E2E exported layer');
    });

    test('A map is exported as WMC', fromScenario('Maps/Options/Export — Export a WMC map'), async({ page, data }) => {
        // WMC holds WMS layers only: with none, the export produces no file.
        const wms = { id: 'e2e_wms', type: 'wms', url: 'http://localhost:8082/geoserver/wms', name: 'e2e:e2e_points', title: 'E2E WMS layer', visibility: true };
        const map = await data.map({ data: romeMap([wms]) });

        await openMapViewer(page, map.id);
        const wmc = await exportMap(page, 'WMC');
        expect(wmc).toMatch(/<(\w+:)?ViewContext/);
    });

    test('An exported map is imported in another map', fromScenario('Maps/Options/Import — Import a map'), async({ page, data }) => {
        const source = await data.map({ data: romeMap([annotationLayer({ title: 'E2E imported map layer', point: [12.5, 41.9] })]) });
        const target = await data.map({ data: romeMap() });

        await openMapViewer(page, source.id);
        const exported = await exportMap(page, 'MapStore');

        await openMapViewer(page, target.id);
        await importFile(page, { name: 'e2e-map.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
        await expect(await tocLayer(page, 'E2E imported map layer')).toBeVisible({ timeout: 20000 });
    });

    test('Exported annotations are imported in another map', fromScenario('Maps/Options/Import — Import an annotation'), async({ page, data }) => {
        const source = await data.map({ data: romeMap([annotationLayer({ title: 'E2E imported annotation', point: [12.5, 41.9] })]) });
        const target = await data.map({ data: romeMap() });

        await openMapViewer(page, source.id);
        await (await tocLayer(page, 'E2E imported annotation')).click();
        await moveAwayFromTooltips(page);
        const download = page.waitForEvent('download');
        await page.locator('button.toc-toolbar-button:has(.glyphicon-download-comment)').click();
        const annotations = await readDownload(await download);

        await openMapViewer(page, target.id);
        await importFile(page, { name: 'e2e-annotations.json', mimeType: 'application/json', buffer: Buffer.from(annotations) });
        await expect(await tocLayer(page, 'E2E imported annotation')).toBeVisible({ timeout: 20000 });
    });

    test('A GeoJSON file is imported as a vector layer', fromScenario('Maps/Options/Import — Import a vector layer (@GH-10750)'), async({ page, data }) => {
        const map = await data.map({ data: romeMap() });
        const geojson = {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', properties: { name: 'E2E point' }, geometry: { type: 'Point', coordinates: [12.5, 41.9] } }]
        };

        await openMapViewer(page, map.id);
        await page.locator('button:has(.glyphicon-upload)').first().click();
        // The panel tells which formats are accepted and their reference system.
        await expect(page.getByText(/Reference System must be EPSG:4326/)).toBeVisible();
        await page.locator('input[type="file"]').setInputFiles({ name: 'e2e_points_import.geojson', mimeType: 'application/geo+json', buffer: Buffer.from(JSON.stringify(geojson)) });
        // Each vector file gets a style step before it is added.
        const styleDialog = page.locator('[role="dialog"]').filter({ hasText: 'Add local vector files' });
        await expect(styleDialog).toBeVisible();
        await styleDialog.getByRole('button', { name: 'Finish' }).click();
        await expect(await tocLayer(page, 'e2e_points_import')).toBeVisible({ timeout: 20000 });
    });
});
