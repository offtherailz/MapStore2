import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { fixtureLayer, openMapViewer, openLayersDrawer, selectLayerNode, layerToolbarButton } from './helpers/map.js';
import { saveFromViewer } from './helpers/details.js';
import { countColor } from './helpers/pixels.js';

const RED = '#ff0000';
const WHITE = '#ffffff';

const background = () => fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined });

function map3d(layers = [], { center = { x: 12.5, y: 41.9 }, zoom = 6 } = {}) {
    return { version: 2, map: { projection: 'EPSG:900913', center: { ...center, crs: 'EPSG:4326' }, zoom, layers: [background(), ...layers] } };
}

async function open3D(page, data, config) {
    const map = await data.map({ data: config });
    await openMapViewer(page, map.id);
    await page.locator('button:has(.glyphicon-3d)').click();
    await expect(page.locator('.cesium-widget canvas')).toBeVisible({ timeout: 30000 });
    // The globe loads its imagery after the canvas appears.
    await page.waitForTimeout(3000);

    return map;
}

function globe(page) {
    return page.locator('.cesium-widget');
}

async function globePixels(page, color, tolerance = 30) {
    return countColor(await globe(page).screenshot(), color, tolerance);
}

/** Point of the globe at an offset from the centre of the viewport. */
async function globePoint(page, dx, dy) {
    const box = await globe(page).boundingBox();

    return [box.x + box.width / 2 + dx, box.y + box.height / 2 + dy];
}

describeIfFeature('cesium', 'Map in 3D', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('The 3D viewer settings change the globe and are saved with the map', fromScenario('Maps/Options/Cesium — Cesium viewer settings'), async({ page, data, api }) => {
        const map = await open3D(page, data, map3d([], { zoom: 1 }));
        const white = await globePixels(page, WHITE, 5);
        expect(white).toBeGreaterThan(1000);

        await page.locator('#mapstore-sidebar button:has(.glyphicon-cog), button.btn-tray:has(.glyphicon-cog)').first().click();
        const settings = page.getByRole('dialog').filter({ hasText: 'Map settings' });
        await expect(settings.getByLabel('Show sky atmosphere')).toBeChecked();
        await settings.getByLabel('Show sky atmosphere').uncheck();
        await settings.getByLabel('Show ground atmosphere').check();
        await settings.getByLabel('Show fog').check();
        await settings.getByLabel('Enable depth test against terrain').check();
        await settings.locator('button:has(.glyphicon-1-close)').first().click();

        // The ground atmosphere tints the globe, white without it: the white left is the one of
        // the controls over the map.
        await expect.poll(() => globePixels(page, WHITE, 5), { timeout: 15000 }).toBeLessThan(white - 10000);
        await saveFromViewer(page);

        const { map: saved } = await api.getData(map.id);
        expect(saved.mapOptions).toMatchObject({
            showSkyAtmosphere: false,
            showGroundAtmosphere: true,
            enableFog: true,
            depthTestAgainstTerrain: true
        });
    });

    test('Terrain collision detection is turned off', fromScenario('Maps/Options/Cesium — Cesium viewer settings'), async({ page, data }) => {
        // The option shows as active when the map has no value for it, but the first click
        // stores the negation of that missing value, true, so it stays active.
        test.fail();
        await open3D(page, data, map3d());
        await page.locator('#mapstore-sidebar button:has(.glyphicon-cog), button.btn-tray:has(.glyphicon-cog)').first().click();
        const collision = page.getByRole('dialog').filter({ hasText: 'Map settings' }).getByLabel('Enable terrain collision detection');
        await expect(collision).toBeChecked();
        await collision.click();
        await expect(collision).not.toBeChecked({ timeout: 3000 });
    });

    test('3D measures are drawn and exported as GeoJSON', fromScenario('Maps/Options/Measure — Export 3D Measurement'), async({ page, data }) => {
        await open3D(page, data, map3d());
        await page.locator('button:has(.glyphicon-1-ruler)').first().click();
        const toolButton = (glyph) => page.locator(`button:has(.glyphicon-${glyph})`).first();
        // Clicking the active tool turns it off: the length tool is active when the measure opens.
        const tool = (glyph) => ({ click: async() => {
            if (!/\bactive\b/.test(await toolButton(glyph).getAttribute('class'))) {
                await toolButton(glyph).click();
            }
        } });
        const click = async(dx, dy) => page.mouse.click(...await globePoint(page, dx, dy));
        const finish = async(dx, dy) => page.mouse.dblclick(...await globePoint(page, dx, dy));

        await tool('polyline-3d').click();
        await click(-100, -50);
        await finish(100, 50);
        await tool('polygon-3d').click();
        await click(-80, -80);
        await click(80, -80);
        await finish(0, 60);
        await tool('point-coordinates').click();
        await click(30, 30);
        await tool('height-from-terrain').click();
        await click(-30, 30);
        await tool('angle').click();
        await click(-120, 100);
        await click(-60, 140);
        await finish(0, 100);
        await tool('slope').click();
        await click(120, -100);
        await click(160, -60);
        await finish(200, -100);

        const download = page.waitForEvent('download');
        await toolButton('ext-json').click();
        const exported = JSON.parse(Buffer.concat(await (await (await download).createReadStream()).toArray()).toString());
        expect(exported.type).toBe('FeatureCollection');
        const types = exported.features.map(({ properties }) => properties.measureType).filter(Boolean);
        expect(types).toEqual(expect.arrayContaining(['POLYLINE_DISTANCE_3D', 'AREA_3D', 'POINT_COORDINATES', 'HEIGHT_FROM_TERRAIN']));
        expect(types.length).toBeGreaterThanOrEqual(6);
        const line = exported.features.find(({ properties }) => properties.measureType === 'POLYLINE_DISTANCE_3D');
        expect(line.properties.length).toBeGreaterThan(100000);
    });

    test('The attribute table zooms to a feature in 3D', fromScenario('Maps/Options/Cesium — Zoom to extent on 3D mode'), async({ page, data }) => {
        // Centred on Milan, so that zooming to Rome moves the camera.
        await open3D(page, data, map3d([fixtureLayer()], { center: { x: 9.19, y: 45.46 } }));
        const before = await globe(page).screenshot();
        expect(countColor(before, RED)).toBeGreaterThan(20);

        await openLayersDrawer(page);
        await selectLayerNode(page, 'e2e_points');
        await layerToolbarButton(page, 'features-grid').click();
        await page.locator('.react-grid-Row').filter({ hasText: 'Roma' }).locator('.glyphicon-zoom-to').click();

        await expect.poll(async() => (await globe(page).screenshot()).equals(before), { timeout: 20000 }).toBe(false);
        // Rome is still drawn.
        await expect.poll(() => globePixels(page, RED), { timeout: 20000 }).toBeGreaterThan(5);
    });

    test('Coordinates are searched in 3D', fromScenario('Maps/Options/Search_bar — Search by coordinate in 3D mode'), async({ page, data }) => {
        await open3D(page, data, map3d([fixtureLayer()]));
        const before = await globe(page).screenshot();

        const searchBar = page.locator('#search-bar-container, .search-bar-container, [class*="search-bar"]').first();
        await searchBar.locator('button:has(.glyphicon-menu-hamburger)').click();
        await page.getByRole('menuitem', { name: /Search by coordinates/ }).click();
        await page.getByPlaceholder('lat').fill('45.4642');
        await page.getByPlaceholder('lon').fill('9.19');
        await searchBar.locator('button:has(.glyphicon-search)').click();

        await expect.poll(async() => (await globe(page).screenshot()).equals(before), { timeout: 20000 }).toBe(false);
    });
});
