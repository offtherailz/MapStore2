import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature, getServiceUrl } from './config.js';
import { login } from './helpers/auth.js';
import { openAppTarget } from './helpers/navigation.js';
import {
    fixtureLayer,
    mapConfig,
    openMapViewer,
    openLayersDrawer,
    selectLayerNode,
    layerToolbarButton,
    FIXTURE_LAYER_NAME
} from './helpers/map.js';
import { contextPayload } from './helpers/content.js';

/** Rome, the first city of the PostGIS fixture: the maps of this suite are centred on it. */
const ROME = { x: 12.4964, y: 41.9028 };

function romeMap(layers, groups) {
    const config = mapConfig(layers);
    config.map.center = { ...ROME, crs: 'EPSG:4326' };
    config.map.zoom = 10;
    if (groups) {
        config.map.groups = groups;
    }

    return config;
}

const background = () => fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined, visibility: false });

async function center(page) {
    const box = await page.locator('.ol-viewport').boundingBox();

    return [box.x + box.width / 2, box.y + box.height / 2];
}

/** Clicks the centre of the map, on Rome, and returns the GetFeatureInfo response, if any. */
async function identifyCenter(page) {
    const response = page.waitForResponse((r) => /request=GetFeatureInfo/i.test(r.url()) || /GetFeature/i.test(r.url()), { timeout: 15000 })
        .catch(() => null);
    await page.mouse.click(...await center(page));

    return response;
}

describeIfFeature('geoserverIntegration', 'Identify', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('Identify opens on a feature and ignores the layers of a hidden group', fromScenario('Maps/Options/Get_Feature_Info — View GFI (@GH-10632)'), async({ page, data }) => {
        const map = await data.map({ data: romeMap([background(), fixtureLayer({ group: 'e2e_group' })], [{ id: 'e2e_group', title: 'E2E group', expanded: true }]) });

        await openMapViewer(page, map.id);
        await identifyCenter(page);
        await expect(page.getByText('Roma').first()).toBeVisible({ timeout: 20000 });

        await openLayersDrawer(page);
        const groupCheck = page.locator('.ms-node-group').filter({ hasText: 'E2E group' }).first().locator('.ms-visibility-check').first();
        await groupCheck.click();
        await expect(groupCheck).not.toHaveClass(/active/);

        // A new identify on the same point finds nothing: the layer of the hidden group is skipped.
        await page.mouse.click(...await center(page));
        await expect(page.getByText('Roma')).toHaveCount(0, { timeout: 10000 });
    });

    test('Identify names the layer of an imported vector file', fromScenario('Maps/Options/Get_Feature_Info — View GFI for imported layer (@GH-9625)'), async({ page, data }) => {
        const map = await data.map({ data: romeMap([background()]) });
        const geojson = {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', properties: { name: 'E2E imported point' }, geometry: { type: 'Point', coordinates: [ROME.x, ROME.y] } }]
        };

        await openMapViewer(page, map.id);
        await page.locator('button:has(.glyphicon-upload)').first().click();
        await page.locator('input[type="file"]').setInputFiles({ name: 'e2e_identified.geojson', mimeType: 'application/geo+json', buffer: Buffer.from(JSON.stringify(geojson)) });
        const styleDialog = page.locator('[role="dialog"]').filter({ hasText: 'Add local vector files' });
        await styleDialog.getByRole('checkbox', { name: /Zoom on the vector files/ }).uncheck().catch(() => {});
        await styleDialog.getByRole('button', { name: 'Finish' }).click();

        await page.mouse.click(...await center(page));
        await expect(page.getByText('e2e_identified').first()).toBeVisible({ timeout: 20000 });
    });

    test('A WFS layer is identified in HTML when set so', fromScenario('Maps/Options/Get_Feature_Info — HTML response for WFS layer (@GH-10233)'), async({ page, data }) => {
        const wfs = {
            id: 'e2e_wfs',
            type: 'wfs',
            url: `${getServiceUrl('geoserver')}/wfs`,
            name: FIXTURE_LAYER_NAME,
            title: 'E2E WFS layer',
            visibility: true,
            // HTML is offered for WFS layers only when the service declares it.
            infoFormats: ['text/html', 'application/json']
        };
        const map = await data.map({ data: romeMap([background(), wfs]) });

        await openMapViewer(page, map.id);
        await openLayersDrawer(page);
        await selectLayerNode(page, 'E2E WFS layer');
        await layerToolbarButton(page, 'wrench').click();
        // The settings tabs carry only a glyph: the feature info one is the marker.
        await page.locator('a:has(.glyphicon-map-marker)').filter({ visible: true }).first().click();
        await page.getByRole('button', { name: 'Add new identify view' }).click();
        await page.locator('.ms-feature-info-views .Select-arrow-zone').click();
        await page.locator('.Select-option').filter({ hasText: 'HTML' }).click();
        await page.locator('.ms-close:has(.glyphicon-1-close)').filter({ visible: true }).first().click();

        // The default GeoServer has no HTML output for WFS: the request is what MapStore controls.
        const request = page.waitForRequest((r) => /request=GetFeature/i.test(r.url()) && /outputFormat=text%2Fhtml/i.test(r.url()));
        await page.mouse.click(...await center(page));
        await request;
    });

    test('The coordinate format chosen in identify does not change the shared link', fromScenario('Maps/Options/Get_Feature_Info — Coordinate system in the GFI and Share tool (@GH-11777)'), async({ page, data }) => {
        const map = await data.map({ data: romeMap([background(), fixtureLayer()]) });

        await openMapViewer(page, map.id);
        await identifyCenter(page);
        await expect(page.getByText('Roma').first()).toBeVisible({ timeout: 20000 });
        // The coordinate editor of the identify panel has its own format menu.
        await page.locator('button:has(.glyphicon-search-coords)').first().click();
        await page.getByText('Lat', { exact: true }).locator('xpath=ancestor::*[.//*[contains(@class,"glyphicon-cog")]][1]')
            .locator('.glyphicon-cog').first().click();
        await page.getByRole('menuitem', { name: 'Aeronautical' }).click();

        await page.locator('button:has(.glyphicon-share-alt)').first().click();
        const share = page.locator('[role="dialog"]').filter({ has: page.getByRole('tab', { name: 'Embed' }) }).last();
        await share.getByRole('tab', { name: 'Link', exact: true }).click();
        await share.getByRole('checkbox', { name: 'Add center and zoom to sharing link' }).check();
        const link = await share.getByRole('tabpanel', { name: 'Link', exact: true }).getByRole('textbox').inputValue();
        // The link keeps decimal degrees whatever the format shown in identify.
        expect(link).toMatch(/center=[-\d.]+,[-\d.]+/);
    });

    test('A context can highlight identified features by default', fromScenario('Maps/Options/Get_Feature_Info — GFI - MapInfo highlight by default (@GH-9825)'), async({ page, data }) => {
        const payload = contextPayload({
            layers: [background(), fixtureLayer()],
            plugins: [{ name: 'Identify', cfg: { showHighlightFeatureButton: true, highlightEnabledFromTheStart: true } }]
        });
        payload.mapConfig.map.center = { ...ROME, crs: 'EPSG:4326' };
        payload.mapConfig.map.zoom = 10;
        const context = await data.context({ data: payload });

        await openAppTarget(page, `#/context/${context.name}`);
        await expect(page.locator('.ol-viewport')).toBeVisible({ timeout: 30000 });
        await page.mouse.click(...await center(page));
        await expect(page.getByText('Lat: 41.903').first()).toBeVisible({ timeout: 20000 });
        const highlight = page.locator('button:has(.glyphicon-map-filter)').filter({ visible: true }).first();
        await expect(highlight).toHaveClass(/btn-success/);
    });

    test('Hover identify shows a popup on features only', fromScenario('Maps/Options/Get_Feature_Info — Disable identify popup in case of no results (@GH-10545)'), async({ page, data }) => {
        // The context gets the plugins of the standard viewer, with the identify popup hidden on no results.
        const localConfig = await (await page.request.get('configs/localConfig.json')).json();
        const plugins = localConfig.plugins.desktop
            .map((plugin) => typeof plugin === 'string' ? { name: plugin } : plugin)
            .map((plugin) => plugin.name === 'Identify' ? { ...plugin, cfg: { ...plugin.cfg, hidePopupIfNoResults: true } } : plugin);
        const payload = contextPayload({ layers: [background(), fixtureLayer()] });
        payload.plugins.desktop = plugins;
        payload.mapConfig.map.center = { ...ROME, crs: 'EPSG:4326' };
        payload.mapConfig.map.zoom = 10;
        const context = await data.context({ data: payload });

        await openAppTarget(page, `#/context/${context.name}`);
        await expect(page.locator('.ol-viewport')).toBeVisible({ timeout: 30000 });
        await page.locator('button.btn-tray:has(.glyphicon-cog)').click();
        await page.locator('select').filter({ has: page.locator('option', { hasText: 'Hover' }) }).selectOption('hover');
        await page.getByText('Map settings').locator('xpath=ancestor::*[.//*[contains(@class,"glyphicon-1-close")]][1]')
            .locator('.glyphicon-1-close').first().click();

        const [x, y] = await center(page);
        await page.mouse.move(x - 40, y);
        await page.mouse.move(x, y, { steps: 5 });
        await expect(page.locator('.ms-map-popup').filter({ hasText: 'Roma' })).toBeVisible({ timeout: 20000 });

        const empty = page.waitForRequest((r) => /request=GetFeatureInfo/i.test(r.url()));
        await page.mouse.move(x - 250, y + 150, { steps: 5 });
        await empty;
        await expect(page.getByText(/There is no information available/)).toHaveCount(0);
    });
});
