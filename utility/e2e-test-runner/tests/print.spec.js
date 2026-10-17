import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { fixtureLayer, mapConfig, openMapViewer } from './helpers/map.js';
import { annotationLayer } from './helpers/content.js';

// The print service runs inside the MapStore container and downloads the layers itself:
// the layer points to the GeoServer container by its network name, which the service
// can resolve (the browser cannot, so the viewer does not draw it).
const INTERNAL_WMS = 'http://e2e-geoserver:8080/geoserver/wms';

/** Prints the open map and checks that a PDF comes back. */
async function printToPdf(page) {
    await page.locator('button:has(.glyphicon-print)').first().click();
    const printButton = page.getByRole('button', { name: 'Print', exact: true }).last();
    await expect(printButton).toBeEnabled({ timeout: 30000 });

    const created = page.waitForResponse((response) => response.url().includes('/pdf/create.json'));
    const printout = page.waitForResponse((response) => /\/pdf\/[^/]+\.printout/.test(response.url()), { timeout: 60000 });
    await printButton.click();

    expect((await created).ok()).toBe(true);
    const pdf = await printout;
    expect(pdf.ok()).toBe(true);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
    await expect(page.getByText('Failed to load PDF file')).toHaveCount(0);
}

describeIfFeature('printing', 'Printing', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('Annotations are printed with the map', fromScenario('Maps/Options/Annotations — Print annotations (@GH-10342)'), async({ page, data }) => {
        const layer = fixtureLayer({ url: INTERNAL_WMS, search: undefined });
        const background = { ...layer, id: 'e2e_background', title: 'E2E background', group: 'background' };
        const annotations = annotationLayer({ title: 'E2E printed annotation', point: [12.5, 41.9] });
        const map = await data.map({ data: mapConfig([background, annotations]) });

        await openMapViewer(page, map.id);
        await printToPdf(page);
    });

    test('A map is printed to PDF', fromScenario('Maps/Options/Print — Print a map'), async({ page, data }) => {
        const layer = fixtureLayer({ url: INTERNAL_WMS, search: undefined });
        const background = { ...layer, id: 'e2e_background', title: 'E2E background', group: 'background' };
        const map = await data.map({ data: mapConfig([background, layer]) });

        await openMapViewer(page, map.id);
        await printToPdf(page);
    });
});
