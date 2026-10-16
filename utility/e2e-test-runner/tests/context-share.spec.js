import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { config, hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { openAppTarget } from './helpers/navigation.js';
import { fixtureLayer, FIXTURE_LAYER_TITLE } from './helpers/map.js';
import { contextPayload } from './helpers/content.js';

/** Rome, the first city of the PostGIS fixture: the context map is centred on it. */
const ROME = { lon: 12.4964, lat: 41.9028 };

/** Context with the fixture layer and the tools the share scenarios use. */
function sharedContext() {
    const payload = contextPayload({
        windowTitle: 'E2E shared context',
        layers: [
            fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined }),
            fixtureLayer()
        ],
        plugins: [
            { name: 'DrawerMenu' },
            { name: 'TOC' },
            { name: 'Identify' },
            { name: 'SidebarMenu' },
            { name: 'Share' }
        ]
    });
    payload.mapConfig.map.center = { x: ROME.lon, y: ROME.lat, crs: 'EPSG:4326' };
    payload.mapConfig.map.zoom = 10;

    return payload;
}

async function openShare(page) {
    await page.locator('button:has(.glyphicon-share-alt)').first().click();
    const dialog = page.locator('[role="dialog"]').filter({ has: page.getByRole('tab', { name: 'Embed' }) }).last();
    await expect(dialog).toBeVisible();

    return dialog;
}

/**
 * Clicks the centre of the map, on Rome, and checks the identify result. The result is
 * read from the GetFeatureInfo response: a context renders it in a format of its own.
 */
async function identifyCenter(page, scope = page) {
    const viewport = scope.locator('.ol-viewport').first();
    await expect(viewport).toBeVisible({ timeout: 30000 });
    const box = await viewport.boundingBox();
    const featureInfo = page.waitForResponse((response) => /request=GetFeatureInfo/i.test(response.url()));
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    expect(await (await featureInfo).text()).toContain('Roma');
    await expect(scope.getByText('Lat: 41.903').first()).toBeVisible({ timeout: 20000 });
}

describeIfFeature('geoserverIntegration', 'Context sharing', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('The direct link opens the context with its layers and identify', fromScenario(
        'Context/Share — Share via direct link a context',
        'Context/Share — Show layer and GFI on shared context'
    ), async({ page, data }) => {
        const context = await data.context({ data: sharedContext() });

        await openAppTarget(page, `#/context/${context.name}`);
        const dialog = await openShare(page);
        await dialog.getByRole('tab', { name: 'Link', exact: true }).click();
        const link = await dialog.getByRole('tabpanel', { name: 'Link', exact: true }).getByRole('textbox').inputValue();
        expect(link).toContain(`#/context/${context.name}`);

        const shared = await page.context().newPage();
        await shared.goto(link);
        await identifyCenter(shared);
        await shared.locator('button.ms-drawer-menu-button:has(.glyphicon-1-layer)').click();
        await expect(shared.locator('.ms-node-layer').filter({ hasText: FIXTURE_LAYER_TITLE })).toBeVisible({ timeout: 15000 });
        await shared.close();
    });

    test('The embed code opens the context with its layers and identify', fromScenario(
        'Context/Share — Share via Embed code a context',
        'Context/Share — Show layer and GFI on embed context'
    ), async({ page, data }) => {
        const context = await data.context({ data: sharedContext() });
        await data.publish(context);

        await openAppTarget(page, `#/context/${context.name}`);
        const dialog = await openShare(page);
        await dialog.getByRole('tab', { name: 'Embed' }).click();
        // A context is embedded whole: its TOC comes from its plugins, not from an option.
        const code = await dialog.locator('pre').filter({ hasText: '<iframe' }).first().innerText();

        // The embedding page is on the MapStore origin: the context page is served with
        // X-Frame-Options SAMEORIGIN, so another origin would not display it.
        const host = await page.context().newPage();
        await host.goto(config.baseURL);
        await host.setContent(`<!DOCTYPE html><html><body style="margin:0">${code}</body></html>`);
        const frame = host.frameLocator('iframe');
        await expect(frame.locator('.ol-viewport')).toBeVisible({ timeout: 30000 });
        await expect(frame.locator('button.ms-drawer-menu-button:has(.glyphicon-1-layer)')).toBeVisible();
        await identifyCenter(host, frame);
        await host.close();
    });
});
