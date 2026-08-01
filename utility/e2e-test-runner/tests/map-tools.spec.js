import { test, expect, describeIfFeature } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { moveAwayFromTooltips } from './helpers/navigation.js';
import {
    FIXTURE_LAYER_TITLE,
    mapConfig,
    openMapViewer,
    openLayersDrawer,
    selectLayerNode,
    layerToolbarButton
} from './helpers/map.js';

/** The zoom level select in the status bar, the cheapest observable of a viewport change. */
function zoomSelect(page) {
    return page.locator('select').first();
}

describeIfFeature('geoserverIntegration', 'Map tools', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('Zoom in and zoom out change the zoom level', async({ page, data }) => {
        const map = await data.map({ data: mapConfig() });

        await openMapViewer(page, map.id);
        await expect(zoomSelect(page)).toHaveValue('5');

        await test.step('Zoom in', async() => {
            await page.locator('button.square-button.btn-primary:has(.glyphicon-plus)').click();
            await expect(zoomSelect(page)).toHaveValue('6');
        });

        await test.step('Zoom out', async() => {
            await page.locator('button.square-button.btn-primary:has(.glyphicon-minus)').click();
            await expect(zoomSelect(page)).toHaveValue('5');
        });
    });

    test('Zoom to layer extent moves the viewport to the fixture features', async({ page, data }) => {
        const map = await data.map({ data: mapConfig() });

        await openMapViewer(page, map.id);
        await expect(zoomSelect(page)).toHaveValue('5');
        await openLayersDrawer(page);
        await selectLayerNode(page);

        await layerToolbarButton(page, 'zoom-to').click();

        // The fixture covers Italy only, so fitting it always zooms in past the saved level.
        await expect(zoomSelect(page)).not.toHaveValue('5', { timeout: 15000 });
    });

    test('Status bar reports the map projection', async({ page, data }) => {
        const map = await data.map({ data: mapConfig() });

        await openMapViewer(page, map.id);

        await expect(page.locator('.ms-crs-select-button')).toHaveText('EPSG:3857');
    });

    test('A change to a saved map survives a reload', async({ page, data }) => {
        const map = await data.map({ data: mapConfig() });
        const newTitle = 'Persisted points';

        await openMapViewer(page, map.id);
        await openLayersDrawer(page);
        await selectLayerNode(page);

        await test.step('Rename the layer', async() => {
            await layerToolbarButton(page, 'wrench').click();
            await page.locator(`input.form-control[value="${FIXTURE_LAYER_TITLE}"]`).fill(newTitle);
            await expect(page.locator('.ms-node-layer').filter({ hasText: newTitle })).toBeVisible({ timeout: 15000 });
        });

        await test.step('Close the layer settings', async() => {
            // The settings panel replaces the layer toolbar, so it has to be dismissed
            // through its own close button.
            await page.locator('button.ms-close').first().click();
            await expect(page.locator(`input.form-control[value="${newTitle}"]`)).toHaveCount(0);
        });

        await test.step('Save the map', async() => {
            await moveAwayFromTooltips(page);
            // floppy-disk saves in place; floppy-open would create a copy instead.
            await page.locator('button:has(.glyphicon-floppy-disk)').first().click();
            await expect(page.getByText('Saved successfully')).toBeVisible({ timeout: 15000 });
        });

        await test.step('Reload the viewer and verify the new title is stored', async() => {
            await openMapViewer(page, map.id);
            await openLayersDrawer(page);
            await expect(page.locator('.ms-node-layer').filter({ hasText: newTitle })).toBeVisible({ timeout: 15000 });
        });
    });

    test('Details panel reports the metadata of the saved map', async({ page, data }) => {
        const map = await data.map({ data: mapConfig() });

        await openMapViewer(page, map.id);
        await page.locator('.ms-brand-navbar button:has(.glyphicon-details)').first().click();

        // The panel carries the resource metadata; the owner name also lives in the hidden
        // account menu, so it is not asserted here.
        await expect(page.getByText('Created by')).toBeVisible({ timeout: 20000 });
        await expect(page.getByText('Permissions')).toBeVisible();
        await expect(page.getByText('Advertised')).toBeVisible();
        await expect(page.getByText(map.name).first()).toBeVisible();
    });

    test('Save as copy leaves the original untouched', async({ page, api, data }) => {
        const map = await data.map({ data: mapConfig() });
        const copyName = data.name('map-copy');

        await openMapViewer(page, map.id);

        await test.step('Create a copy under a new name', async() => {
            await page.locator('.ms-brand-navbar button:has(.glyphicon-floppy-open)').first().click();
            await page.getByRole('textbox').fill(copyName);
            await page.getByRole('button', { name: /^(create|save)$/i }).click();
            await expect(page.getByText('Saved successfully')).toBeVisible({ timeout: 20000 });
        });

        await test.step('Both maps exist through the API', async() => {
            const [copy] = await api.findResources('MAP', copyName);
            expect(copy, `copy ${copyName} not found through the API`).toBeTruthy();
            data.track({ id: copy.id, name: copyName, category: 'MAP' });

            const [original] = await api.findResources('MAP', map.name);
            expect(original, 'the original map must survive the copy').toBeTruthy();
        });
    });

    test('Map can be deleted from the viewer toolbar', async({ page, api, data }) => {
        const map = await data.map({ data: mapConfig() });

        await openMapViewer(page, map.id);
        await page.locator('.ms-brand-navbar button:has(.glyphicon-trash)').first().click();

        await test.step('Confirm the deletion', async() => {
            await page.getByRole('button', { name: /^(delete|yes)$/i }).last().click();
            await expect.poll(async() => (await api.findResources('MAP', map.name)).length, { timeout: 20000 })
                .toBe(0);
        });
    });
});
