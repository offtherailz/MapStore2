import { test, expect, fromScenario } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { openMapViewer, fixtureLayer } from './helpers/map.js';

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

    test('The layers of a view are filtered, changed and connected back to the map', fromScenario('Maps/Options/Map_View — Layers options (@GH-10633)'), async({ page, data }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        const map = await data.map({ data: { version: 2, map: {
            projection: 'EPSG:900913', center: { x: 12.5, y: 41.9, crs: 'EPSG:4326' }, zoom: 6,
            groups: [
                { id: 'e2e_group', title: 'E2E group', expanded: true },
                { id: 'e2e_exclusive', title: 'E2E exclusive', expanded: true, nodesMutuallyExclusive: true }
            ],
            layers: [
                fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined }),
                fixtureLayer({ id: 'e2e_cities', title: 'E2E cities', group: 'e2e_group' }),
                fixtureLayer({ id: 'e2e_events', title: 'E2E events', name: 'e2e:e2e_events', group: 'e2e_group' }),
                fixtureLayer({ id: 'e2e_first', title: 'E2E first choice', group: 'e2e_exclusive' }),
                fixtureLayer({ id: 'e2e_second', title: 'E2E second choice', group: 'e2e_exclusive', visibility: false })
            ]
        } } });

        await login(page);
        await openMapViewer(page, map.id);
        await page.locator('button:has(.glyphicon-map-view)').first().click();
        await panelButton(page, 'plus').click();
        await panelButton(page, 'pencil').click();
        await page.locator('.ms-map-views-section').filter({ hasText: 'Layers Options' }).locator('button').click();
        const options = page.locator(PANEL).first();
        const node = (title) => options.locator('.ms-node-layer').filter({ hasText: title }).first();
        await expect(node('E2E cities')).toBeVisible();

        await test.step('Search', async() => {
            await options.getByPlaceholder('Filter layers').fill('events');
            await expect(node('E2E events')).toBeVisible();
            await expect(node('E2E cities')).toHaveCount(0);
            await options.getByPlaceholder('Filter layers').fill('');
        });

        await test.step('A changed layer is disconnected, and connected back to the map', async() => {
            const check = node('E2E cities').locator('.ms-visibility-check');
            await check.click();
            await expect(check).not.toHaveClass(/active/);
            await expect(node('E2E cities').locator('.ms-node-header-addons button .glyphicon-unplug')).toBeVisible();
            await node('E2E cities').locator('.ms-node-header-addons button:has(.glyphicon-unplug)').click();
            await expect(check).toHaveClass(/active/);
            await expect(node('E2E cities').locator('.ms-node-header-addons button .glyphicon-plug')).toBeVisible();
        });

        await test.step('Mutually exclusive groups', async() => {
            const first = node('E2E first choice').locator('.ms-visibility-check');
            const second = node('E2E second choice').locator('.ms-visibility-check');
            await expect(first).toHaveClass(/active/);
            await second.click();
            await expect(second).toHaveClass(/active/);
            await expect(first).not.toHaveClass(/active/);
        });
    });
});
