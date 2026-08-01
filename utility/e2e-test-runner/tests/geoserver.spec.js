import { test, expect, describeIfFeature } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { openAppTarget, moveAwayFromTooltips } from './helpers/navigation.js';

// The geoserver profile patch file (profiles/geoserver/localConfig.e2e.geoserver.patch.json)
// replaces the default catalog services with the local GeoServer and selects the WMS one,
// so no service has to be picked manually and no remote service is ever queried.

/** Layer published by profiles/geoserver/seed-geoserver.sh from the PostGIS fixture. */
const FIXTURE_LAYER = 'e2e_points';
const FIXTURE_LAYER_ID = 'e2e:e2e_points';

describeIfFeature('geoserverIntegration', 'GeoServer', () => {
    test('Admin can add a layer from the local GeoServer catalog to a map', async({ page, api, data }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');

        const mapName = data.name('geoserver-map');

        await test.step('Sign in as admin', async() => {
            await login(page);
        });

        await test.step('Create a new map', async() => {
            await page.getByRole('button', { name: 'Add Resource' }).click();
            await page.getByRole('menuitem', { name: 'Create map' }).click();
        });

        await test.step('Open the catalog from the layers panel', async() => {
            // Buttons expose no accessible name, so the glyph is the stable hook.
            await page.locator('button.ms-drawer-menu-button:has(.glyphicon-1-layer)').click();
            await moveAwayFromTooltips(page);
            await page.locator('button.toc-toolbar-button:has(.glyphicon-add-layer)').click();
            await expect(page.locator('.ms-catalog-panel')).toBeVisible({ timeout: 15000 });
        });

        await test.step('Search the fixture layer in the local GeoServer service', async() => {
            const catalogPanel = page.locator('.ms-catalog-panel');
            await catalogPanel.locator('.ms-catalog-search-input').fill(FIXTURE_LAYER);

            const record = catalogPanel.locator('.ms-catalog-card').filter({ hasText: FIXTURE_LAYER_ID });
            // The workspace-qualified name proves the record comes from the local service.
            await expect(record).toBeVisible({ timeout: 20000 });
        });

        await test.step('Add the fixture layer to the map', async() => {
            const record = page.locator('.ms-catalog-panel .ms-catalog-card').filter({ hasText: FIXTURE_LAYER_ID }).first();
            await record.locator('button:has(.glyphicon-plus)').first().click();
        });

        await test.step('Verify the fixture layer appears in the TOC', async() => {
            await expect(page.locator('.ms-node-layer').filter({ hasText: FIXTURE_LAYER })).toBeVisible({ timeout: 15000 });
        });

        await test.step('Save the map with a unique name', async() => {
            const saveAsButton = page.locator('button:has(.glyphicon-floppy-open)');
            await expect(saveAsButton).toBeVisible();
            await saveAsButton.click();
            await page.getByRole('textbox').fill(mapName);
            await page.getByRole('button', { name: 'Create' }).click();
            await expect(page.getByText('Saved successfully')).toBeVisible({ timeout: 10000 });
        });

        await test.step('Adopt the saved map, so it is removed even if a later step fails', async() => {
            const [resource] = await api.findResources('MAP', mapName);
            expect(resource, `map ${mapName} not found through the API`).toBeTruthy();
            data.track({ id: resource.id, name: mapName, category: 'MAP' });
        });

        await test.step('Return to homepage and delete the map', async() => {
            await openAppTarget(page, '#/');
            const card = page.locator('.ms-resource-card').filter({ hasText: mapName });
            await expect(card).toBeVisible({ timeout: 10000 });
            await card.locator('.glyphicon-option-vertical').click();
            await page.getByRole('menuitem', { name: 'Delete' }).click();
            await expect(page.getByText('Are you sure you want to delete this resource?')).toBeVisible();
            await page.getByRole('button', { name: 'Delete' }).click();
            await expect(page.locator('.ms-resource-card').filter({ hasText: mapName })).toHaveCount(0);
        });
    });
});
