import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { fixtureLayer, mapConfig, openMapViewer, openLayersDrawer, selectLayerNode, layerToolbarButton, FIXTURE_FEATURES, FIXTURE_LAYER_TITLE } from './helpers/map.js';

const background = () => fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined, visibility: false });

async function readDownload(download) {
    return Buffer.concat(await (await download.createReadStream()).toArray()).toString();
}

/** Opens the export panel of a layer and picks the format. */
async function openExport(page, title, format) {
    await openLayersDrawer(page);
    await selectLayerNode(page, title);
    await layerToolbarButton(page, 'download').click();
    const panel = page.locator('.modal-dialog').filter({ hasText: 'Export Data' }).last();
    await panel.locator('.Select-control .Select-arrow-zone').first().click();
    await page.locator('.Select-option').filter({ hasText: new RegExp(`^${format}$`) }).click();

    return panel;
}

describeIfFeature('geoserverIntegration', 'Export data', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('The features of a WFS layer are exported, also cropped to the viewport', fromScenario('Maps/TOC/Export_Data — Export vector data (@GH-8545 @GH-11531)'), async({ page, data }) => {
        const config = mapConfig([background(), fixtureLayer()]);
        config.map.center = { x: 12.4964, y: 41.9028, crs: 'EPSG:4326' };
        config.map.zoom = 10;
        const map = await data.map({ data: config });

        await openMapViewer(page, map.id);
        let panel = await openExport(page, FIXTURE_LAYER_TITLE, 'CSV');
        let download = page.waitForEvent('download');
        await panel.getByRole('button', { name: 'Export' }).click();
        let csv = await readDownload(await download);
        for (const city of FIXTURE_FEATURES) {
            expect(csv).toContain(city);
        }

        await test.step('Cropped to the viewport, on Rome', async() => {
            await panel.locator('button:has(.glyphicon-1-close), .close').first().click().catch(() => {});
            panel = await openExport(page, FIXTURE_LAYER_TITLE, 'CSV');
            await panel.getByText('Advanced options').click();
            // The option is a switch next to its label.
            await panel.getByText('Crop dataset to current viewport').locator('xpath=..').locator('label, .mapstore-switch-btn, input').first().click({ force: true });
            const crop = page.waitForRequest((r) => /outputFormat=csv/i.test(r.url()) && /BBOX|Envelope|Intersects/i.test(r.postData() ?? ''));
            download = page.waitForEvent('download');
            await panel.getByRole('button', { name: 'Export' }).click();
            await crop;
            csv = await readDownload(await download);
            expect(csv).toContain('Roma');
            expect(csv).not.toContain('Milano');
        });
    });

    test('An imported vector layer is exported as GeoJSON', fromScenario('Maps/TOC/Export_Data — Export GeoJSON file for vector layer (@GH-11762)'), async({ page, data }) => {
        const map = await data.map({ data: mapConfig([background()]) });
        const geojson = {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', properties: { name: 'E2E exported point' }, geometry: { type: 'Point', coordinates: [12.5, 41.9] } }]
        };

        await openMapViewer(page, map.id);
        await page.locator('button:has(.glyphicon-upload)').first().click();
        await page.locator('input[type="file"]').setInputFiles({ name: 'e2e_to_export.geojson', mimeType: 'application/geo+json', buffer: Buffer.from(JSON.stringify(geojson)) });
        await page.locator('[role="dialog"]').filter({ hasText: 'Add local vector files' }).getByRole('button', { name: 'Finish' }).click();

        await openLayersDrawer(page);
        await selectLayerNode(page, 'e2e_to_export');
        const download = page.waitForEvent('download');
        await layerToolbarButton(page, 'download').click();
        const exported = JSON.parse(await readDownload(await download));
        expect(exported.features[0].properties.name).toBe('E2E exported point');
    });
});
