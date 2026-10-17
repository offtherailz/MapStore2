import { test, expect, fromScenario } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { openMapViewer } from './helpers/map.js';

function romeMap() {
    return { version: 2, map: { projection: 'EPSG:900913', center: { x: 12.5, y: 41.9, crs: 'EPSG:4326' }, zoom: 6, layers: [] } };
}

const PANEL = '[class*="map-views"]';

function panelButton(page, glyph) {
    return page.locator(`${PANEL} button:has(.glyphicon-${glyph})`).first();
}

test.describe('Map views', () => {
    test('Views are added, played and renamed in 3D', fromScenario('Maps/Options/Map_View — Map View (@GH-8729)'), async({ page, data }) => {
        test.skip(!hasFeature('cesium'), 'Requires feature cesium');
        const map = await data.map({ data: romeMap() });

        await login(page);
        await openMapViewer(page, map.id);
        await page.locator('button:has(.glyphicon-3d)').click();
        await expect(page.locator('.cesium-widget canvas')).toBeVisible({ timeout: 30000 });
        await page.locator('button:has(.glyphicon-map-view)').first().click();
        await expect(page.getByText('Click on the plus button to add a new view')).toBeVisible();

        await test.step('Add two views', async() => {
            await panelButton(page, 'plus').click();
            await expect(page.getByText('Map View (1)')).toBeVisible();
            await panelButton(page, 'plus').click();
            await expect(page.getByText('Map View (2)')).toBeVisible();
        });

        await test.step('Play the views', async() => {
            await panelButton(page, 'play').click();
            await expect(panelButton(page, 'pause').or(panelButton(page, 'stop'))).toBeVisible({ timeout: 10000 });
            await panelButton(page, 'pause').or(panelButton(page, 'stop')).click();
            await expect(panelButton(page, 'play')).toBeVisible();
        });

        await test.step('Rename the current view', async() => {
            await panelButton(page, 'pencil').click();
            const title = page.locator('input').filter({ hasNot: page.locator('*') }).and(page.locator('input:not([placeholder])')).first();
            await title.fill('E2E renamed view');
            await expect(page.locator('input[value="E2E renamed view"]')).toHaveCount(1);
        });
    });
});
