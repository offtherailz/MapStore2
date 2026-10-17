import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature, getServiceUrl } from './config.js';
import { login, logout } from './helpers/auth.js';
import { moveAwayFromTooltips, openAppTarget } from './helpers/navigation.js';
import { FIXTURE_LAYER_NAME, FIXTURE_LAYER_TITLE, mapConfig, openMapViewer, selectLayerNode, layerToolbarButton } from './helpers/map.js';
import { viewerContextPayload } from './helpers/content.js';

// Services come from profiles/geoserver/localConfig.e2e.geoserver.patch.json.
const SERVICES = {
    wms: 'Local GeoServer WMS',
    wfs: 'Local GeoServer WFS',
    csw: 'Local GeoServer CSW'
};

async function openCatalog(page, data) {
    const map = await data.map({ data: mapConfig([]) });

    await openMapViewer(page, map.id);
    await page.locator('button.ms-drawer-menu-button:has(.glyphicon-1-layer)').click();
    await moveAwayFromTooltips(page);
    await page.locator('button.toc-toolbar-button:has(.glyphicon-add-layer)').click();
    const catalog = page.locator('.ms-catalog-panel');
    await expect(catalog).toBeVisible({ timeout: 15000 });

    return catalog;
}

/** The service selector is a react-select: typing the title and confirming picks it. */
async function selectService(page, catalog, title) {
    await catalog.locator('.Select input[role="combobox"]').first().fill(title);
    await page.keyboard.press('Enter');
    await expect(catalog.locator('.Select-value-label').first()).toHaveText(title);
}

async function search(page, catalog, text) {
    await catalog.getByRole('textbox', { name: 'Search' }).fill(text);
    await page.keyboard.press('Enter');
}

function fixtureRecord(catalog) {
    return catalog.locator('.ms-catalog-card').filter({ hasText: FIXTURE_LAYER_NAME });
}

async function addFixtureToMap(page, catalog) {
    await fixtureRecord(catalog).first().locator('button:has(.glyphicon-plus)').first().click();
    await expect(page.locator('.ms-node-layer').filter({ hasText: FIXTURE_LAYER_TITLE })).toBeVisible({ timeout: 15000 });
}

async function expandAdvancedSettings(catalog) {
    await catalog.getByText('Advanced settings').locator('xpath=ancestor::*[.//button][1]').locator('button').first().click();
    await expect(catalog.getByText('Server Type')).toBeVisible();
}

/** Opens the form of the selected service, with the advanced settings expanded. */
async function editService(page, catalog) {
    await catalog.locator('.ms-catalog-service-btn:has(.glyphicon-pencil)').click();
    await expandAdvancedSettings(catalog);
}

/**
 * Picks an option of a react-select of the advanced settings.
 *
 * @param {string} label label of the setting: 'Server Type', 'Tile', 'Information sheet'
 */
async function pickSetting(page, catalog, label, option) {
    const order = ['Server Type', 'Tile', 'Information sheet'];
    await catalog.locator('.Select-control').nth(order.indexOf(label)).locator('.Select-arrow-zone').click();
    await page.locator('.Select-option').filter({ hasText: option }).first().click();
}

async function saveService(page, catalog) {
    await catalog.getByRole('button', { name: 'Save' }).click();
    await expect(catalog.locator('.ms-catalog-card').first()).toBeVisible({ timeout: 20000 });
}

/** Adds the fixture layer from the WMS service and opens the given tab of its settings. */
async function addFixtureAndOpenSettings(page, catalog, tabGlyph) {
    await addFixtureToMap(page, catalog);
    await catalog.locator('button:has(.glyphicon-1-close)').first().click();
    await selectLayerNode(page, FIXTURE_LAYER_TITLE);
    await layerToolbarButton(page, 'wrench').click();
    await page.locator(`a:has(.glyphicon-${tabGlyph})`).filter({ visible: true }).first().click();
}

function nextGetMap(page) {
    return page.waitForRequest((r) => /request=GetMap/i.test(r.url()) && r.url().includes(encodeURIComponent(FIXTURE_LAYER_NAME)));
}

describeIfFeature('geoserverIntegration', 'Catalog', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('A WFS layer is found and added to the map', async({ page, data }) => {
        const catalog = await openCatalog(page, data);

        await selectService(page, catalog, SERVICES.wfs);
        await search(page, catalog, FIXTURE_LAYER_TITLE);
        await expect(fixtureRecord(catalog)).toBeVisible({ timeout: 20000 });
        await addFixtureToMap(page, catalog);
    });

    test('CSW search works with plain text and with no text', async({ page, data }) => {
        const catalog = await openCatalog(page, data);

        await selectService(page, catalog, SERVICES.csw);

        await test.step('Plain text finds the fixture record', async() => {
            await search(page, catalog, 'e2e');
            await expect(fixtureRecord(catalog)).toBeVisible({ timeout: 20000 });
        });

        await test.step('An empty search lists the records', async() => {
            await search(page, catalog, '');
            await expect(fixtureRecord(catalog)).toBeVisible({ timeout: 20000 });
        });
    });

    test('A WMS service is added and lists its layers', fromScenario('Maps/Options/Catalog — Add a service'), async({ page, data }) => {
        const catalog = await openCatalog(page, data);

        await catalog.locator('.ms-catalog-service-btn:has(.glyphicon-plus)').click();
        await catalog.locator('select').first().selectOption({ label: 'WMS' });
        await catalog.getByRole('textbox').nth(0).fill('E2E workspace WMS');
        await catalog.getByRole('textbox').nth(1).fill(`${getServiceUrl('geoserver')}/e2e/wms`);
        await saveService(page, catalog);
        await expect(catalog.locator('.Select-value-label').first()).toHaveText('E2E workspace WMS');
        await expect(catalog.locator('.ms-catalog-card').filter({ hasText: 'e2e_points' }).first()).toBeVisible();
    });

    test('The tile format of a WMS service is used by its layers', fromScenario(
        'Maps/Options/Catalog — Change the layer format on a service',
        'Interoperability — GetMap format (@GH-9031 @GH-8906)'
    ), async({ page, data }) => {
        const catalog = await openCatalog(page, data);

        await editService(page, catalog);
        await pickSetting(page, catalog, 'Tile', 'image/png; mode=8bit');
        await saveService(page, catalog);

        const getMap = nextGetMap(page);
        await addFixtureAndOpenSettings(page, catalog, 'eye-open');
        expect(new URL((await getMap).url()).searchParams.get('FORMAT')).toBe('image/png; mode=8bit');
        await expect(page.getByText('image/png; mode=8bit').first()).toBeVisible();
    });

    test('Single tile set on a WMS service applies to its layers', fromScenario('Maps/Options/Catalog — Allow the Single Tile size on WMS service (@GH-8905)'), async({ page, data }) => {
        const catalog = await openCatalog(page, data);

        await editService(page, catalog);
        await catalog.getByRole('checkbox', { name: /Single Tile/ }).check();
        await saveService(page, catalog);

        const getMap = nextGetMap(page);
        await addFixtureAndOpenSettings(page, catalog, 'eye-open');
        const params = new URL((await getMap).url()).searchParams;
        expect(params.get('TILED')).toBe('false');
        expect(params.get('WIDTH')).not.toBe('256');
        await expect(page.getByRole('checkbox', { name: 'Single Tile' })).toBeChecked();
    });

    test('The server type rules the GeoServer options of a service', fromScenario(
        'Maps/Options/Catalog — Change Server Type (@GH-9295 @GH-10480)',
        'Maps/Options/Catalog — Use Cache Options from WMS service (@GH-10281)'
    ), async({ page, data }) => {
        const catalog = await openCatalog(page, data);
        const tileGrids = catalog.getByRole('checkbox', { name: /Use remote custom tile grids/ });

        await editService(page, catalog);
        await pickSetting(page, catalog, 'Server Type', 'No Vendor');
        await expect(tileGrids).toHaveCount(0);
        await pickSetting(page, catalog, 'Server Type', 'GeoServer');
        await tileGrids.check();
        await saveService(page, catalog);

        await addFixtureAndOpenSettings(page, catalog, 'eye-open');
        await expect(page.getByRole('checkbox', { name: 'Use cache options' })).toBeChecked();
    });

    test('Crop to projection extent set on a service is kept by its layers', fromScenario('Maps/Options/Catalog — Cropping WMS Layers to map projection extent (@GH-12302)'), async({ page, data }) => {
        const catalog = await openCatalog(page, data);

        await editService(page, catalog);
        await catalog.getByRole('checkbox', { name: /Crop to projection extent/ }).check();
        await saveService(page, catalog);

        await addFixtureAndOpenSettings(page, catalog, 'eye-open');
        const crop = page.getByRole('checkbox', { name: 'Crop to projection extent' });
        await expect(crop).toBeChecked();
        await crop.uncheck();
        await expect(crop).not.toBeChecked();
    });

    test('The information sheet format of a service sets the identify view of its layers', fromScenario('Interoperability — Supported GetFeatureInfo formats (@GH-9007)'), async({ page, data }) => {
        const catalog = await openCatalog(page, data);

        await editService(page, catalog);
        await catalog.locator('.Select-control').nth(2).locator('.Select-arrow-zone').click();
        await expect(page.locator('.Select-option')).toHaveText(['text/plain', 'text/html', 'application/json']);
        await page.locator('.Select-option').filter({ hasText: 'text/html' }).click();
        await saveService(page, catalog);

        await addFixtureAndOpenSettings(page, catalog, 'map-marker');
        await expect(page.locator('.ms-feature-info-views .Select-value-label')).toHaveText(/HTML/);
    });

    test('The sort by of a CSW service is sent with the searches', fromScenario('Maps/Options/Catalog — SortyBy parameter in the CSW Catalog (@GH-10034)'), async({ page, data }) => {
        const catalog = await openCatalog(page, data);

        await selectService(page, catalog, SERVICES.csw);
        await editService(page, catalog);
        // The order is chosen first: choosing it while the name is still debounced drops the name.
        await catalog.locator('.Select-control').filter({ hasText: 'ASC' }).locator('.Select-arrow-zone').click();
        await page.locator('.Select-option').filter({ hasText: 'DESC' }).click();
        await catalog.getByPlaceholder('Enter a name').fill('dc:title');
        // The field forwards the name to the service only after its debounce.
        await page.waitForTimeout(1000);
        const request = page.waitForRequest((r) => r.method() === 'POST' && /SortBy/.test(r.postData() ?? ''));
        await catalog.getByRole('button', { name: 'Save' }).click();

        // GeoServer CSW does not support sorting, so the order of its answer is not checked.
        const sortBy = (await request).postData();
        expect(sortBy).toContain('<ogc:PropertyName>dc:title</ogc:PropertyName>');
        expect(sortBy).toContain('<ogc:SortOrder>DESC</ogc:SortOrder>');
    });

    test('Editing services is reserved to the configured roles', fromScenario('Maps/Options/Catalog — Edit Icons (plus sign and pencil) for NON-ADMIN role users (@GH-9974)'), async({ page, data }) => {
        const payload = await viewerContextPayload(page, { cfg: { Catalog: { editingAllowedRoles: ['ADMIN'] } } });
        const context = await data.context({ data: payload });
        await data.publish(context);
        const password = 'E2ePassword!1';
        const user = await data.user({ password });
        const serviceButtons = page.locator('.ms-catalog-service-btn');

        async function openContextCatalog() {
            await openAppTarget(page, `#/context/${context.name}`);
            await page.locator('button:has(.glyphicon-folder-open)').first().click();
            await expect(page.locator('.ms-catalog-panel')).toBeVisible({ timeout: 20000 });
        }

        await openContextCatalog();
        await expect(serviceButtons).toHaveCount(2);

        await logout(page);
        await openContextCatalog();
        await expect(serviceButtons).toHaveCount(0);

        await login(page, user.name, password);
        await openContextCatalog();
        await expect(serviceButtons).toHaveCount(0);
    });

    test('The catalog opens as a dialog when configured so', fromScenario('Maps/Options/Catalog — Open Catalog on Dialog view (@GH-12487)'), async({ page, data }) => {
        const payload = await viewerContextPayload(page, { cfg: { Catalog: { defaultView: 'dialog' } } });
        const context = await data.context({ data: payload });

        const catalogButton = page.locator('button:has(.glyphicon-folder-open)').first();
        // The dialog view lays the records out as a grid; the panel view is a side list.
        const catalog = page.locator('.ms-catalog-grid-wrapper');

        await openAppTarget(page, `#/context/${context.name}`);
        for (let time = 0; time < 2; time++) {
            await catalogButton.click();
            await expect(catalog).toBeVisible({ timeout: 20000 });
            await expect(catalog.locator('button:has(.glyphicon-minus)')).toBeVisible();
            await expect(catalog.locator('button:has(.glyphicon-1-full-screen)')).toHaveCount(0);
            await catalog.locator('button:has(.glyphicon-1-close)').first().click();
            await expect(catalog).toBeHidden();
        }
    });
});
