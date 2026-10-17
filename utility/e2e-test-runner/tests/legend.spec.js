import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { openAppTarget } from './helpers/navigation.js';
import { fixtureLayer, mapConfig, openMapViewer, openLayersDrawer, FIXTURE_LAYER_NAME, FIXTURE_LAYER_TITLE } from './helpers/map.js';
import { saveFromViewer } from './helpers/details.js';
import { viewerContextPayload } from './helpers/content.js';

// e2e:e2e_points_by_category (profiles/geoserver/seed-geoserver.sh) has a rule for the
// capital, Rome, and one for the other cities.
const STYLE = 'e2e:e2e_points_by_category';

const background = () => fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined, visibility: false });
const classified = (overrides = {}) => fixtureLayer({ style: STYLE, ...overrides });

const node = (page) => page.locator('.ms-node-layer').filter({ hasText: FIXTURE_LAYER_TITLE });
const rules = (page) => node(page).locator('.wms-json-legend-rule');

/** Map centred on a point, at a zoom level. */
function mapOn(layers, [x, y], zoom) {
    const config = mapConfig(layers);
    config.map.center = { x, y, crs: 'EPSG:4326' };
    config.map.zoom = zoom;

    return config;
}

async function expandLegend(page) {
    await openLayersDrawer(page);
    await node(page).locator('.ms-node-expand').click();
}

describeIfFeature('geoserverIntegration', 'Legend', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('An open legend stays open in the saved map', fromScenario('Maps/TOC/Legend — Legend state (@GH-9552 @GH-10727)'), async({ page, data }) => {
        const map = await data.map({ data: mapConfig([background(), classified()]) });
        const legend = () => node(page).locator(`img[src*="GetLegendGraphic"]`);

        await openMapViewer(page, map.id);
        await expandLegend(page);
        await expect(legend()).toBeVisible();
        await saveFromViewer(page);

        await openMapViewer(page, map.id);
        await openLayersDrawer(page);
        await expect(legend()).toBeVisible({ timeout: 20000 });
    });

    test('The interactive legend filters the map by its rules', fromScenario('Maps/TOC/Legend — Interactive legend (WMS, WFS and vector layers) (@GH-10026)'), async({ page, data }) => {
        const map = await data.map({ data: mapConfig([background(), classified({ enableInteractiveLegend: true })]) });

        await openMapViewer(page, map.id);
        await expandLegend(page);
        await expect(rules(page)).toHaveCount(2, { timeout: 20000 });
        const getMap = page.waitForRequest((r) => /request=GetMap/i.test(r.url()) && r.url().includes(encodeURIComponent(FIXTURE_LAYER_NAME)) && /CQL_FILTER/i.test(r.url()));
        await rules(page).filter({ hasText: 'capital' }).click();
        const cql = new URL((await getMap).url()).searchParams.get('CQL_FILTER');
        expect(cql).toMatch(/category\s*=\s*'capital'/);
        await expect(rules(page).filter({ hasText: 'capital' })).toHaveClass(/active/);
    });

    test('The legend lists only the rules of the visible features', fromScenario('Maps/TOC/Legend — Legend filtering for WMS layers (@GH-10684 @GH-10236 @GH-10241)'), async({ page, data }) => {
        // Zoomed on Milan: the capital is out of the view.
        const map = await data.map({ data: mapOn([background(), classified({ enableInteractiveLegend: true })], [9.19, 45.4642], 11) });

        await openMapViewer(page, map.id);
        await expandLegend(page);
        await expect(rules(page)).toHaveCount(1, { timeout: 20000 });
        await expect(rules(page)).toContainText('city');

        await page.getByRole('combobox', { name: 'Scale:' }).selectOption('5');
        await expect(rules(page)).toHaveCount(2, { timeout: 20000 });
    });

    test('The interactive legend draws an icon for each rule', fromScenario('Maps/TOC/Legend — Icons on the interactive legend (@GH-11814)'), async({ page, data }) => {
        const map = await data.map({ data: mapConfig([background(), classified({ enableInteractiveLegend: true })]) });

        await openMapViewer(page, map.id);
        await expandLegend(page);
        await expect(rules(page)).toHaveCount(2, { timeout: 20000 });
        for (const rule of await rules(page).all()) {
            await expect(rule.locator('.ms-legend-icon svg, .ms-legend-icon img, .ms-legend-icon canvas').first()).toBeVisible();
        }
    });

    test('The floating legend follows the view and the visible layers', fromScenario('Maps/TOC/Legend — Floating Dynamic Legend Plugin (@GH-11075 @GH-12542 @GH-12543)'), async({ page, data }) => {
        const payload = await viewerContextPayload(page, {
            layers: [background(), classified({ enableInteractiveLegend: true })],
            plugins: [{ name: 'DynamicLegend' }]
        });
        payload.mapConfig.map.center = { x: 9.19, y: 45.4642, crs: 'EPSG:4326' };
        payload.mapConfig.map.zoom = 11;
        const context = await data.context({ data: payload });

        await openAppTarget(page, `#/context/${context.name}`);
        await page.locator('button:has(.glyphicon-align-left)').filter({ visible: true }).first().click();
        // The panel shows the legend image of the layer, limited to the features in view.
        const legend = page.locator('li').filter({ hasText: FIXTURE_LAYER_TITLE }).locator('img[src*="GetLegendGraphic"]').first();
        await expect(legend).toBeVisible({ timeout: 20000 });
        const src = decodeURIComponent(await legend.getAttribute('src'));
        expect(src).toMatch(/BBOX=/i);
        expect(src).toMatch(/hideEmptyRules:true/);

        await openLayersDrawer(page);
        await node(page).locator('.ms-visibility-check').click();
        await expect(page.getByText('No legend to display')).toBeVisible({ timeout: 20000 });
    });
});
