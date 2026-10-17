import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature, getServiceUrl } from './config.js';
import { login } from './helpers/auth.js';
import { fixtureLayer, mapConfig, openMapViewer } from './helpers/map.js';
import { annotationLayer, viewerContextPayload } from './helpers/content.js';
import { openAppTarget } from './helpers/navigation.js';

// The print service runs inside the MapStore container and downloads the layers itself:
// the layer points to the GeoServer container by its network name, which the service
// can resolve. The browser cannot, so its requests are routed to the published port:
// otherwise the layers fail to load and are left out of the printout.
const INTERNAL_GEOSERVER = 'http://e2e-geoserver:8080/geoserver';
const INTERNAL_WMS = `${INTERNAL_GEOSERVER}/wms`;

const printPanel = (page) => page.locator('.modal-dialog, [role="dialog"]').filter({ hasText: 'Coordinates System' }).last();

async function openPrint(page) {
    await page.locator('button:has(.glyphicon-print)').first().click();
    const panel = printPanel(page);
    await expect(panel.getByRole('button', { name: 'Print', exact: true }).last()).toBeEnabled({ timeout: 30000 });

    return panel;
}

/**
 * Prints from the open print panel; returns the spec sent to the print service and the
 * printout response.
 */
async function print(page) {
    const created = page.waitForResponse((response) => response.url().includes('/pdf/create.json'));
    const printout = page.waitForResponse((response) => /\/pdf\/[^/]+\.printout/.test(response.url()), { timeout: 60000 });
    await printPanel(page).getByRole('button', { name: 'Print', exact: true }).last().click();
    const response = await created;
    expect(response.ok()).toBe(true);

    return { spec: JSON.parse(response.request().postData()), printout: await printout };
}

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
        await page.route(`${INTERNAL_GEOSERVER}/**`, (route) =>
            route.continue({ url: route.request().url().replace(INTERNAL_GEOSERVER, getServiceUrl('geoserver')) }));
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

    test('The format and the coordinate system of the printout can be chosen', fromScenario('Maps/Options/Print — Change Format and Coordinate System'), async({ page, data }) => {
        const layer = fixtureLayer({ url: INTERNAL_WMS, search: undefined });
        const map = await data.map({ data: mapConfig([{ ...layer, id: 'e2e_background', title: 'E2E background', group: 'background' }, layer]) });

        await openMapViewer(page, map.id);
        const panel = await openPrint(page);
        await panel.getByPlaceholder('Enter a title...').fill('E2E printout');
        await panel.locator('select').filter({ has: page.locator('option[value="EPSG:4326"]') }).selectOption('EPSG:4326');
        await panel.locator('select').filter({ has: page.locator('option[value="png"]') }).selectOption('png');
        const { spec, printout } = await print(page);
        expect(spec.srs).toBe('EPSG:4326');
        expect(spec.outputFormat).toBe('png');
        expect(spec.mapTitle).toBe('E2E printout');
        expect(printout.ok()).toBe(true);
        expect(printout.headers()['content-type']).toMatch(/image\/png/);
    });

    test('The legend of the layers is printed, with the icon size chosen', fromScenario(
        'Maps/Options/Print — Legend in Print tool (@GH-8871 @GH-11235)',
        'Maps/TOC/Legend — Print image legend (@GH-9839)'
    ), async({ page, data }) => {
        const layer = fixtureLayer({ url: INTERNAL_WMS, search: undefined, style: 'e2e:e2e_points_by_category' });
        const map = await data.map({ data: mapConfig([{ ...layer, id: 'e2e_background', title: 'E2E background', group: 'background', style: undefined }, layer]) });

        await openMapViewer(page, map.id);
        const panel = await openPrint(page);
        await panel.getByRole('checkbox', { name: 'Include legend' }).check();
        await panel.getByText('Legend options').click();
        const width = panel.getByText('Icons width:').locator('xpath=following::input[1]');
        await expect(width).toBeDisabled();
        await panel.getByRole('checkbox', { name: /Override icons size/ }).check();
        await expect(width).toBeEnabled();
        await width.fill('40');
        const { spec, printout } = await print(page);
        expect(printout.ok()).toBe(true);
        const legend = JSON.stringify(spec.legends);
        expect(legend).toContain('e2e_points');
        expect(legend).toMatch(/width[=:"\s]+40/i);
    });

    test('Layers hidden in the table of contents are not printed', fromScenario('Maps/Options/Print — Alignment between print preview and TOC status (@GH-10513)'), async({ page, data }) => {
        const layer = fixtureLayer({ url: INTERNAL_WMS, search: undefined });
        const hidden = fixtureLayer({ id: 'e2e_hidden', name: 'e2e:e2e_events', title: 'E2E hidden', url: INTERNAL_WMS, search: undefined, visibility: false });
        const map = await data.map({ data: mapConfig([{ ...layer, id: 'e2e_background', title: 'E2E background', group: 'background' }, layer, hidden]) });

        await openMapViewer(page, map.id);
        await openPrint(page);
        const { spec } = await print(page);
        const printed = JSON.stringify(spec.layers);
        expect(printed).toContain('e2e:e2e_points');
        expect(printed).not.toContain('e2e:e2e_events');
    });

    test('The credits of the layers are printed', fromScenario('Maps/Options/Print — Credits text in printed page (@GH-10279)'), async({ page, data }) => {
        const layer = fixtureLayer({ url: INTERNAL_WMS, search: undefined, credits: { title: 'E2E credits' } });
        const map = await data.map({ data: mapConfig([{ ...layer, id: 'e2e_background', title: 'E2E background', group: 'background', credits: undefined }, layer]) });

        await openMapViewer(page, map.id);
        await openPrint(page);
        const { spec, printout } = await print(page);
        expect(printout.ok()).toBe(true);
        expect(JSON.stringify(spec)).toContain('E2E credits');
    });

    test('Layers can be left out of the printed legend', fromScenario('Maps/Options/Print — Excluding certain layers from the legend in print tool (@GH-10812)'), async({ page, data }) => {
        const points = fixtureLayer({ url: INTERNAL_WMS, search: undefined });
        const events = fixtureLayer({ id: 'e2e_events', name: 'e2e:e2e_events', title: 'e2e_events', url: INTERNAL_WMS, search: undefined });
        const payload = await viewerContextPayload(page, {
            layers: [{ ...points, id: 'e2e_background', title: 'E2E background', group: 'background' }, points, events],
            cfg: { Print: { excludeLayersFromLegend: ['e2e:e2e_events'] } }
        });
        const context = await data.context({ data: payload });

        await openAppTarget(page, `#/context/${context.name}`);
        const panel = await openPrint(page);
        await panel.getByRole('checkbox', { name: 'Include legend' }).check();
        const { spec } = await print(page);
        const legend = JSON.stringify(spec.legends);
        expect(legend).toContain('e2e_points');
        expect(legend).not.toContain('e2e_events');
    });

    test('Layers with the same filter are merged by the print service', fromScenario('Maps/Options/Print — mergeableParams to Print layers with same filter_cql (@GH-10878)'), async({ page, data }) => {
        const filtered = (id, title) => fixtureLayer({ id, title, url: INTERNAL_WMS, search: undefined, params: { CQL_FILTER: "category='city'" } });
        const payload = await viewerContextPayload(page, {
            layers: [{ ...filtered('e2e_background', 'E2E background'), group: 'background', params: undefined }, filtered('e2e_one', 'E2E one'), filtered('e2e_two', 'E2E two')],
            cfg: { Print: { mergeableParams: { cql_filter: { defaultValue: 'INCLUDE', separator: ';', context: 'http://e2e-geoserver:8080/geoserver/wms' } } } }
        });
        const context = await data.context({ data: payload });

        await openAppTarget(page, `#/context/${context.name}`);
        await openPrint(page);
        const { spec, printout } = await print(page);
        expect(spec.mergeableParams).toBeTruthy();
        expect(printout.ok()).toBe(true);
    });

    test('The print scale is picked from the preview and can be typed freely', fromScenario(
        'Maps/Options/Print — Print map with scale selector enabled (@GH-10322)',
        'Maps/Options/Print — Printing by freely setting the scale factor (@GH-10839)'
    ), async({ page, data }) => {
        const layer = fixtureLayer({ url: INTERNAL_WMS, search: undefined });
        const payload = await viewerContextPayload(page, {
            layers: [{ ...layer, id: 'e2e_background', title: 'E2E background', group: 'background' }, layer],
            cfg: { Print: { useFixedScales: true, editScale: true, mapPreviewOptions: { enableScalebox: true } } }
        });
        const context = await data.context({ data: payload });

        await openAppTarget(page, `#/context/${context.name}`);
        const panel = await openPrint(page);
        const scale = panel.locator('select, input').filter({ has: page.locator('option') }).or(panel.locator('[class*=scale] input')).first();
        await expect(scale).toBeVisible();
        const { spec, printout } = await print(page);
        expect(printout.ok()).toBe(true);
        expect(spec.pages[0].scale).toBeGreaterThan(0);
    });
});
