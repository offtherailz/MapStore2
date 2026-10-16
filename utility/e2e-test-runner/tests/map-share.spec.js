import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { fixtureLayer, mapConfig, openMapViewer, FIXTURE_LAYER_TITLE } from './helpers/map.js';

/** Rome, the first city of the PostGIS fixture. */
const ROME = { lon: 12.4964, lat: 41.9028 };

/** Map centred on Rome at zoom 10, with the fixture layer also as background. */
function romeMap() {
    const background = fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined });
    const config = mapConfig([background, fixtureLayer()]);
    config.map.center = { x: ROME.lon, y: ROME.lat, crs: 'EPSG:4326' };
    config.map.zoom = 10;

    return config;
}

async function openShare(page) {
    await page.locator('button:has(.glyphicon-share-alt)').first().click();
    const dialog = page.locator('[role="dialog"]').filter({ has: page.getByRole('tab', { name: 'Permalink' }) }).last();
    await expect(dialog).toBeVisible();

    return dialog;
}

async function shareLink(dialog) {
    // The dialog reopens on the tab used last.
    await dialog.getByRole('tab', { name: 'Link', exact: true }).click();
    const input = dialog.getByRole('tabpanel', { name: 'Link', exact: true }).getByRole('textbox');
    await expect(input).toHaveValue(/#\/viewer\//);

    return input.inputValue();
}

async function embedCode(dialog) {
    await dialog.getByRole('tab', { name: 'Embed' }).click();
    const code = dialog.locator('pre').filter({ hasText: '<iframe' }).first();
    await expect(code).toBeVisible();

    return code.innerText();
}

/**
 * Clicks the centre of the map, where the views of these tests put Rome, and returns the
 * identify panel. The click is on the feature only because the view is centred on it.
 */
async function identifyCenter(page, scope = page) {
    const viewport = scope.locator('.ol-viewport').first();
    await expect(viewport).toBeVisible({ timeout: 30000 });
    const box = await viewport.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const result = scope.getByText('Roma', { exact: false }).first();
    await expect(result).toBeVisible({ timeout: 20000 });

    return result;
}

describeIfFeature('geoserverIntegration', 'Map sharing', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('The direct link opens the map, its layers and identify', fromScenario(
        'Maps/Options/Share — Share via direct link',
        'Maps/Options/Share — Show layer and GFI on shared map'
    ), async({ page, data }) => {
        const map = await data.map({ data: romeMap() });

        await openMapViewer(page, map.id);
        const link = await shareLink(await openShare(page));

        const shared = await page.context().newPage();
        await shared.goto(link);
        await expect(shared.locator('.ms-drawer-menu-button')).toBeVisible({ timeout: 30000 });
        await identifyCenter(shared);

        await shared.locator('button.ms-drawer-menu-button:has(.glyphicon-1-layer)').click();
        await expect(shared.locator('.ms-node-layer').filter({ hasText: FIXTURE_LAYER_TITLE })).toBeVisible({ timeout: 15000 });
        await shared.close();
    });

    test('The embed code opens the map, with TOC and identify when enabled', fromScenario(
        'Maps/Options/Share — Share via Embed code',
        'Maps/Options/Share — Show layer and GFI on embed map'
    ), async({ page, data }) => {
        const map = await data.map({ data: romeMap() });
        await data.publish(map);

        await openMapViewer(page, map.id);
        const dialog = await openShare(page);
        await embedCode(dialog);
        await dialog.getByRole('checkbox', { name: 'Show TOC' }).check();
        const code = await embedCode(dialog);
        expect(code).toMatch(/embedded\.html/);

        // The page embedding the map, as an external site would.
        const host = await page.context().newPage();
        await host.setContent(`<!DOCTYPE html><html><body style="margin:0">${code}</body></html>`);
        const frame = host.frameLocator('iframe');
        await expect(frame.locator('.ol-viewport')).toBeVisible({ timeout: 30000 });
        await expect(frame.locator('.ms-node-layer, [class*="toc"]').first()).toBeVisible({ timeout: 20000 });
        await identifyCenter(host, frame);
        await host.close();
    });

    test('A permalink keeps the current view of the map', fromScenario('Maps/Options/Share — Share via Permalink (@GH-9250 @GH-9335)'), async({ page, api, data }) => {
        const map = await data.map({ data: romeMap() });
        const title = data.name('permalink');

        await openMapViewer(page, map.id);
        await page.locator('button:has(.glyphicon-plus)').first().click();
        const zoom = await page.locator('select').first().inputValue();

        const dialog = await openShare(page);
        await dialog.getByRole('tab', { name: 'Permalink' }).click();
        await dialog.getByPlaceholder('Enter a title').fill(title);
        await dialog.getByPlaceholder('Enter a description').fill('Created by the E2E suite');
        await dialog.getByRole('button', { name: 'Generate permalink' }).click();
        await expect(dialog.getByRole('heading', { name: 'Permalink generated' })).toBeVisible({ timeout: 20000 });
        const link = await dialog.getByRole('tabpanel', { name: 'Permalink' }).getByRole('textbox').inputValue();
        expect(link).toMatch(/#\/permalink\/[0-9a-f-]+$/);

        // The permalink resource is named after the identifier of its link.
        const [resource] = await api.findResources('PERMALINK', link.split('/').pop());
        if (resource) {
            data.track({ id: resource.id, name: resource.name, category: 'PERMALINK' });
        }

        const opened = await page.context().newPage();
        await opened.goto(link);
        await expect(opened.locator('.ms-drawer-menu-button')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => opened.locator('select').first().inputValue(), { timeout: 20000 }).toBe(zoom);
        await opened.close();
    });

    test('A 3D map shared by link opens in 3D', fromScenario('Maps/Options/Share — Share 3D map via direct link'), async({ page, data }) => {
        test.skip(!hasFeature('cesium'), 'Requires feature cesium');
        const map = await data.map({ data: romeMap() });

        await openMapViewer(page, map.id);
        await page.locator('button:has(.glyphicon-3d)').click();
        await expect(page.locator('.cesium-widget canvas')).toBeVisible({ timeout: 30000 });
        const dialog = await openShare(page);
        await shareLink(dialog);
        // In 3D the view parameters carry the camera, which reopens the 3D viewer.
        await dialog.getByRole('checkbox', { name: 'Add center and zoom to sharing link' }).check();
        const link = await shareLink(dialog);
        expect(link).toMatch(/heading|pitch/);

        const shared = await page.context().newPage();
        await shared.goto(link);
        await expect(shared.locator('.cesium-widget canvas')).toBeVisible({ timeout: 30000 });
        await shared.close();
    });

    test('A 3D map embedded opens in 3D', fromScenario('Maps/Options/Share — Share 3D map via Embed code'), async({ page, data }) => {
        test.skip(!hasFeature('cesium'), 'Requires feature cesium');
        const map = await data.map({ data: romeMap() });
        await data.publish(map);

        await openMapViewer(page, map.id);
        await page.locator('button:has(.glyphicon-3d)').click();
        await expect(page.locator('.cesium-widget canvas')).toBeVisible({ timeout: 30000 });
        const dialog = await openShare(page);
        await embedCode(dialog);
        const advanced = dialog.getByRole('checkbox', { name: /center and zoom/ });
        if (await advanced.count()) {
            await advanced.check();
        }
        const code = await embedCode(dialog);

        const host = await page.context().newPage();
        await host.setContent(`<!DOCTYPE html><html><body style="margin:0">${code}</body></html>`);
        await expect(host.frameLocator('iframe').locator('.cesium-widget canvas')).toBeVisible({ timeout: 30000 });
        await host.close();
    });
});
