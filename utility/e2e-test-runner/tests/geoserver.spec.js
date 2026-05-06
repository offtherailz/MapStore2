import { test, expect } from '@playwright/test';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { openAppTarget } from './helpers/navigation.js';

// The geoserver profile patch file (profiles/geoserver/localConfig.e2e.geoserver.patch.json)
// pre-configures a catalog service
// titled "Local GeoServer WMS" pointing to http://localhost:8082/geoserver/wms
// and sets it as selectedService, so no manual service selection is required.

test.describe('GeoServer', () => {
    test('Admin can add a layer from the local GeoServer catalog to a map', async({ page }) => {
        test.skip(!hasFeature('geoserverIntegration'), 'Requires feature geoserverIntegration');

        const mapName = `E2E GeoServer Map ${Date.now()}`;

        await test.step('Sign in as admin', async() => {
            await login(page);
        });

        await test.step('Create a new map', async() => {
            await page.getByRole('button', { name: 'Add Resource' }).click();
            await page.getByRole('menuitem', { name: 'Create map' }).click();
        });

        await test.step('Open catalog panel', async() => {
            // Prefer the accessible button name, then fallback to icon/tooltip selectors.
            const roleButton = page.getByRole('button', { name: /add layer/i }).first();
            if (await roleButton.isVisible()) {
                await roleButton.click();
            } else {
                const fallbackButton = page.locator(
                    '[title="Add layers to the map"], [data-original-title="Add layers to the map"], ' +
                    'button.square-button:has(.glyphicon-plus)'
                ).first();
                await expect(fallbackButton).toBeVisible({ timeout: 15000 });
                await fallbackButton.click();
            }

            const catalogPanel = page.locator('#mapstore-catalog-panel, #mapstore-metadata-explorer');
            await expect(catalogPanel).toBeVisible({ timeout: 15000 });
        });

        await test.step('Verify "Local GeoServer WMS" is selected and search for layers', async() => {
            // The patch sets selectedService to "local_geoserver_wms" with title "Local GeoServer WMS"
            const catalogPanel = page.locator('#mapstore-catalog-panel, #mapstore-metadata-explorer');
            await expect(catalogPanel.getByText('Local GeoServer WMS')).toBeVisible({ timeout: 10000 });

            // Search for a well-known GeoServer sample layer
            const searchField = catalogPanel.getByPlaceholder(/search/i);
            await searchField.fill('states');
            await catalogPanel.getByRole('button', { name: /search/i }).click();
        });

        await test.step('Add first result to the map', async() => {
            const catalogPanel = page.locator('#mapstore-catalog-panel, #mapstore-metadata-explorer');
            // Wait for search results and click the first add-to-map button
            const firstAddBtn = catalogPanel.locator('button.square-button').filter({ has: page.locator('.glyphicon-plus') }).first();
            await expect(firstAddBtn).toBeVisible({ timeout: 20000 });
            await firstAddBtn.click();
        });

        await test.step('Verify layer appears in the TOC', async() => {
            await expect(page.locator('.ms-node-layer').first()).toBeVisible({ timeout: 15000 });
        });

        await test.step('Save the map with a unique name', async() => {
            const saveAsButton = page.locator('button:has(.glyphicon-floppy-open)');
            await expect(saveAsButton).toBeVisible();
            await saveAsButton.click();
            await page.getByRole('textbox').fill(mapName);
            await page.getByRole('button', { name: 'Create' }).click();
            await expect(page.getByText('Saved successfully')).toBeVisible({ timeout: 10000 });
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
