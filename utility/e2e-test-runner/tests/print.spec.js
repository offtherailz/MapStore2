import { test, expect, describeIfFeature } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { fixtureLayer, mapConfig, openMapViewer } from './helpers/map.js';

// The print service runs inside the MapStore container and downloads the layers itself:
// the layer points to the GeoServer container by its network name, which the service
// can resolve (the browser cannot, so the viewer does not draw it).
const INTERNAL_WMS = 'http://e2e-geoserver:8080/geoserver/wms';

describeIfFeature('printing', 'Printing', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('A map is printed to PDF', async({ page, data }) => {
        const layer = fixtureLayer({ url: INTERNAL_WMS, search: undefined });
        const background = { ...layer, id: 'e2e_background', title: 'E2E background', group: 'background' };
        const map = await data.map({ data: mapConfig([background, layer]) });

        await openMapViewer(page, map.id);
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
    });
});
