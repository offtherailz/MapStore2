import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature, getServiceUrl } from './config.js';
import { login } from './helpers/auth.js';
import { openAppTarget } from './helpers/navigation.js';
import { fixtureLayer, fixtureTableLayer, mapConfig, openMapViewer, openLayersDrawer, selectLayerNode, layerToolbarButton, FIXTURE_LAYER_TITLE } from './helpers/map.js';
import { viewerContextPayload } from './helpers/content.js';

const background = () => fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined, visibility: false });

/** Reads the ISO metadata linked by e2e_points (see profiles/geoserver/seed-geoserver.sh). */
const METADATA_OPTIONS = {
    xmlNamespaces: { gmd: 'http://www.isotc211.org/2005/gmd', gco: 'http://www.isotc211.org/2005/gco' },
    extractors: [{
        properties: {
            title: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:citation/gmd:CI_Citation/gmd:title/gco:CharacterString',
            'abstract': '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:abstract/gco:CharacterString'
        }
    }]
};

describeIfFeature('geoserverIntegration', 'Interoperability', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('The metadata linked by the WMS capabilities are shown for the layer', fromScenario('Interoperability — Show metadata URL (@GH-9030)'), async({ page, data }) => {
        const payload = await viewerContextPayload(page, {
            layers: [background(), fixtureLayer(), fixtureTableLayer('e2e_edit')],
            plugins: [{ name: 'MetadataInfo', cfg: { metadataOptions: METADATA_OPTIONS } }]
        });
        const context = await data.context({ data: payload });
        const modal = page.locator('.modal-dialog-container').filter({ hasText: 'Layer metadata' });

        await openAppTarget(page, `#/context/${context.name}`);
        await openLayersDrawer(page);

        await test.step('A layer with an ISO metadata link', async() => {
            const metadata = page.waitForRequest((r) => r.url().includes('e2e_points_metadata.xml'));
            await selectLayerNode(page, FIXTURE_LAYER_TITLE);
            await layerToolbarButton(page, 'info-sign').click();
            await metadata;
            await expect(modal.getByText('E2E cities metadata')).toBeVisible({ timeout: 15000 });
            await expect(modal.getByText('Italian cities used by the E2E suites')).toBeVisible();
            const link = modal.getByRole('link', { name: `${getServiceUrl('geoserver')}/www/e2e/e2e_points_metadata.xml` });
            await expect(link).toBeVisible();
            await expect(link).toHaveAttribute('target', '_blank');
            await modal.locator('button:has(.glyphicon-1-close)').first().click();
        });

        await test.step('A layer without metadata links', async() => {
            await selectLayerNode(page, 'e2e_edit');
            await layerToolbarButton(page, 'info-sign').click();
            await expect(modal).toBeVisible({ timeout: 15000 });
            await expect(modal.getByText('Metadata URL')).toHaveCount(0);
        });
    });

    test('Cesium requests the WMS layers in version 1.1.1', fromScenario('Interoperability — Cesium and WMS requests to version 1.1.1 (@GH-10592)'), async({ page, data }) => {
        test.skip(!hasFeature('cesium'), 'Requires feature cesium');
        const map = await data.map({ data: mapConfig([background(), fixtureLayer()]) });

        await openMapViewer(page, map.id);
        const getMap = page.waitForResponse((r) => /request=GetMap/i.test(r.url()) && /version=1\.1\.1/i.test(r.url()));
        await page.locator('button:has(.glyphicon-3d)').click();
        await expect(page.locator('.cesium-widget canvas')).toBeVisible({ timeout: 30000 });
        const response = await getMap;
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toMatch(/^image\//);
    });

    test('A graticule layer draws a grid over the map', fromScenario('Maps — Graticule on map viewer'), async({ page, data }) => {
        const graticule = { id: 'e2e_graticule', type: 'graticule', title: 'E2E graticule', visibility: true, labels: true, frame: true };
        const map = await data.map({ data: mapConfig([background(), graticule]) });
        // The part of the map right of the layers drawer, which stays open.
        const mapArea = () => page.screenshot({ clip: { x: 420, y: 120, width: 600, height: 450 } });

        await openMapViewer(page, map.id);
        await openLayersDrawer(page);
        const visibility = page.locator('.ms-node-layer').filter({ hasText: 'E2E graticule' }).locator('.ms-visibility-check');
        const withGrid = await mapArea();

        await visibility.click();
        await expect.poll(async() => Buffer.compare(await mapArea(), withGrid) !== 0).toBe(true);

        // The grid follows the map when it is moved and zoomed out.
        await visibility.click();
        await expect.poll(async() => Buffer.compare(await mapArea(), withGrid)).toBe(0);
        await page.mouse.move(700, 350);
        await page.mouse.down();
        await page.mouse.move(850, 430, { steps: 5 });
        await page.mouse.up();
        await page.mouse.wheel(0, 400);
        await expect.poll(async() => Buffer.compare(await mapArea(), withGrid) !== 0).toBe(true);
    });
});
