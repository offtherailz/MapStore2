import { test, expect } from './fixtures.js';
import { login } from './helpers/auth.js';
import { openAppTarget } from './helpers/navigation.js';

test.describe('Maps', () => {
    test('Admin can create and delete a map', async({ page, api, data }) => {
        const mapName = data.name('map');

        await test.step('Sign in as admin', async() => {
            await login(page);
        });

        await test.step('Open "Create map" from the Add Resource menu', async() => {
            await page.getByRole('button', { name: 'Add Resource' }).click();
            await page.getByRole('menuitem', { name: 'Create map' }).click();
        });

        await test.step('Save the new map with a unique name', async() => {
            const saveAsButton = page.locator('button:has(.glyphicon-floppy-open)');
            await expect(saveAsButton).toBeVisible();
            await saveAsButton.click();
            await page.getByRole('textbox').fill(mapName);
            await page.getByRole('button', { name: 'Create' }).click();
            await expect(page.getByText('Saved successfully')).toBeVisible();
        });

        await test.step('Adopt the saved map, so it is removed even if a later step fails', async() => {
            const [resource] = await api.findResources('MAP', mapName);
            expect(resource, `map ${mapName} not found through the API`).toBeTruthy();
            data.track({ id: resource.id, name: mapName, category: 'MAP' });
        });

        await test.step('Navigate back to homepage and verify the map appears in the grid', async() => {
            await openAppTarget(page, '#/');
            await expect(page.locator('.ms-resource-card').filter({ hasText: mapName })).toBeVisible();
        });

        await test.step('Delete the map and confirm', async() => {
            const card = page.locator('.ms-resource-card').filter({ hasText: mapName });
            await card.locator('.glyphicon-option-vertical').click();
            await page.getByRole('menuitem', { name: 'Delete' }).click();
            await expect(page.getByText('Are you sure you want to delete this resource?')).toBeVisible();
            await page.getByRole('button', { name: 'Delete' }).click();
        });

        await test.step('Verify the map is no longer in the grid', async() => {
            await expect(page.locator('.ms-resource-card').filter({ hasText: mapName })).toHaveCount(0);
        });
    });
});
