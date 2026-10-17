import { test, expect, fromScenario } from './fixtures.js';
import { hasFeature, getServiceUrl } from './config.js';
import { login } from './helpers/auth.js';
import { fixtureLayer, mapConfig, openMapViewer, FIXTURE_LAYER_NAME } from './helpers/map.js';

/** Map on the whole of Italy, without layers. */
function italyMap(layers = []) {
    return { version: 2, map: { projection: 'EPSG:900913', center: { x: 12.5, y: 41.9, crs: 'EPSG:4326' }, zoom: 5, layers } };
}

function searchBar(page) {
    return page.locator('#search-bar-container, .search-bar-container, [class*="search-bar"]').first();
}

async function chooseSearchTool(page, tool) {
    await searchBar(page).locator('button:has(.glyphicon-menu-hamburger)').click();
    await page.getByRole('menuitem', { name: tool }).click();
}

/** Zoom level, read from the scale selector of the footer (its values are zoom levels). */
function scaleSelect(page) {
    return page.getByRole('combobox', { name: 'Scale:' });
}

function zoomLevel(page) {
    return scaleSelect(page).inputValue().then(Number);
}

/** Waits for the map to zoom in beyond the given level. */
async function expectZoomedIn(page, from) {
    await expect.poll(() => zoomLevel(page), { timeout: 20000 }).toBeGreaterThan(from);
}

test.describe('Search bar', () => {
    test.beforeEach(async({ page }) => {
        await login(page);
    });

    test('Coordinates are searched in decimal and aeronautical formats', fromScenario('Maps/Options/Search_bar — Search by coordinate'), async({ page, data }) => {
        const map = await data.map({ data: italyMap() });
        await openMapViewer(page, map.id);
        const start = await zoomLevel(page);

        await test.step('Decimal degrees, editing a digit in the middle', async() => {
            await chooseSearchTool(page, /Search by coordinates/);
            await page.getByPlaceholder('lat').fill('45.4642');
            const lon = page.getByPlaceholder('lon');
            await lon.fill('9.19');
            // The caret stays where the digit is typed, inside the number.
            await lon.press('Home');
            await lon.press('ArrowRight');
            await lon.press('ArrowRight');
            await lon.pressSequentially('0');
            await expect(lon).toHaveValue('9.019');
            await searchBar(page).locator('button:has(.glyphicon-search)').click();
            await expectZoomedIn(page, start);
        });

        await test.step('Aeronautical format with decimal seconds', async() => {
            const zoomed = await zoomLevel(page);
            await scaleSelect(page).selectOption(String(start));
            await expect.poll(() => zoomLevel(page)).toBe(start);
            await searchBar(page).locator('button:has(.glyphicon-cog)').first().click();
            await page.getByRole('menuitem', { name: 'Aeronautical' }).click();
            const [latD, latM, latS, lonD, lonM, lonS] = await Promise.all(
                [0, 1, 2, 3, 4, 5].map(async(index) => searchBar(page).locator('input.intl-numeric').nth(index))
            );
            await latD.fill('45');
            await latM.fill('27');
            await latS.fill('12.45');
            await expect(latS).toHaveValue('12.45');
            await lonD.fill('9');
            await lonM.fill('11');
            await lonS.fill('24');
            await searchBar(page).locator('button:has(.glyphicon-search)').click();
            await expectZoomedIn(page, start);
            expect(zoomed).toBeGreaterThan(start);
        });
    });

    test('A bookmark is created and brings the map to its extent', fromScenario('Maps/Options/Search_bar — Search by bookmark'), async({ page, data }) => {
        const map = await data.map({ data: italyMap() });
        await openMapViewer(page, map.id);
        const start = await zoomLevel(page);

        await chooseSearchTool(page, /Search by bookmark/);
        await searchBar(page).locator('button:has(.glyphicon-cog)').first().click();
        await page.getByRole('button', { name: 'Add' }).last().click();
        const form = page.locator('[role="dialog"], .modal-dialog').filter({ hasText: 'Add new bookmark' }).last();
        await form.getByPlaceholder('Title').fill('E2E Milan');
        await form.getByPlaceholder('Enter North').fill('45.55');
        await form.getByPlaceholder('Enter West').fill('9.05');
        await form.getByPlaceholder('Enter East').fill('9.30');
        await form.getByPlaceholder('Enter South').fill('45.40');
        await form.getByRole('button', { name: 'Save/Update' }).click();
        await expect(page.getByText('E2E Milan').first()).toBeVisible();
        await page.locator('button:has(.glyphicon-1-close)').filter({ visible: true }).last().click();

        await searchBar(page).locator('.Select-control').click();
        await page.locator('.Select-option').filter({ hasText: 'E2E Milan' }).click();
        await expectZoomedIn(page, start);
    });

    test('Coordinates are searched in the map CRS', fromScenario('Maps/Options/Search_bar — Search by CRS coordinates (@GH-10136)'), async({ page, data }) => {
        const map = await data.map({ data: italyMap() });
        await openMapViewer(page, map.id);
        const start = await zoomLevel(page);

        await chooseSearchTool(page, /Current Map CRS/);
        // Milan in EPSG:3857.
        await page.getByPlaceholder('X').fill('1023104');
        await page.getByPlaceholder('Y').fill('5694850');
        await searchBar(page).locator('button:has(.glyphicon-search)').click();
        await expectZoomedIn(page, start);
    });

    test('A WFS search service is created and used', fromScenario('Maps/Options/Search_bar — Create a search service (@GH-9751)'), async({ page, data }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        const map = await data.map({ data: italyMap() });
        await openMapViewer(page, map.id);
        const start = await zoomLevel(page);

        await searchBar(page).locator('button:has(.glyphicon-cog)').first().click();
        const dialog = page.getByRole('dialog').filter({ hasText: 'Create/edit a search service' });
        await dialog.getByRole('button', { name: 'Add' }).click();
        const fields = dialog.locator('input[type="text"]');
        await fields.nth(0).fill('E2E cities');
        await fields.nth(1).fill(`${getServiceUrl('geoserver')}/wfs`);
        await fields.nth(2).fill(FIXTURE_LAYER_NAME);
        await fields.nth(3).fill('name');
        await dialog.getByRole('button', { name: 'Next' }).click();
        await dialog.locator('input[type="text"]').first().fill('${properties.name}');
        await dialog.getByRole('button', { name: 'Next' }).click();
        await dialog.getByRole('button', { name: 'Save' }).click();
        await expect(dialog.getByText('E2E cities')).toBeVisible();
        await dialog.locator('button:has(.glyphicon-1-close)').first().click();

        await page.getByPlaceholder('Search by location name').fill('Milano');
        const result = page.locator('[class*="search-result"]').filter({ hasText: 'Milano' }).first();
        await expect(result).toBeVisible({ timeout: 20000 });
        await result.click();
        await expectZoomedIn(page, start);
    });

    test('The map CRS search is not offered in a geographic projection', fromScenario('Maps/Options/Search_bar — Search by CRS coordinates (@GH-10136)'), async({ page, data }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        const background = fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined });
        const map = await data.map({ data: mapConfig([background]) });

        await openMapViewer(page, map.id);
        await page.locator('.ms-crs-select-button').click();
        await page.locator('.ms-crs-dropdown .dropdown-menu').getByText('EPSG:4326', { exact: true }).click();
        await expect(page.locator('.ms-crs-select-button')).toHaveText('EPSG:4326');

        await searchBar(page).locator('button:has(.glyphicon-menu-hamburger)').click();
        await expect(page.getByRole('menuitem', { name: /Search by coordinates/ })).toBeVisible();
        await expect(page.getByRole('menuitem', { name: /Current Map CRS/ })).toHaveCount(0);
    });
});
