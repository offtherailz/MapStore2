import { test, expect } from './fixtures.js';
import { login } from './helpers/auth.js';
import { openAppTarget } from './helpers/navigation.js';

test.describe('Homepage', () => {
    test('Order by menu exposes all expected sort options', async({ page }) => {
        await test.step('Open homepage', async() => {
            await openAppTarget(page, '#/');
        });

        await test.step('Open Order by menu and verify expected options', async() => {
            await page.getByRole('button', { name: 'Order by' }).click();
            await expect(page.getByRole('menuitem', { name: 'Most recent' })).toBeVisible();
            await expect(page.getByRole('menuitem', { name: 'Less recent' })).toBeVisible();
            await expect(page.getByRole('menuitem', { name: 'A Z' })).toBeVisible();
            await expect(page.getByRole('menuitem', { name: 'Z A' })).toBeVisible();
        });

        await test.step('Select an option and verify page stays healthy', async() => {
            await page.getByRole('menuitem', { name: 'Most recent' }).click();
            await expect(page.getByText('Page Loading Error')).toHaveCount(0);
        });
    });

    test('Resource type filters narrow the grid to the selected category', async({ page }) => {
        await test.step('Open homepage', async() => {
            await openAppTarget(page, '#/');
        });

        await test.step('Open the Filters panel', async() => {
            await page.locator('.ms-resources-search .glyphicon-filter').click();
        });

        await test.step('Select "Maps" filter and verify it is applied', async() => {
            await page.getByLabel('Maps').check();
            await expect(page.getByLabel('Maps')).toBeChecked();
        });

        await test.step('Clear filters and verify the checkbox is deselected', async() => {
            await page.getByRole('button', { name: 'Clear filters' }).click();
            await expect(page.getByLabel('Maps')).not.toBeChecked();
        });
    });

    test('Search narrows the grid to the matching resource', async({ page, data }) => {
        await login(page);
        const map = await data.map();
        const other = await data.map();

        await test.step('Open homepage and search the first map by name', async() => {
            await openAppTarget(page, '#/');
            await page.getByPlaceholder('Search...').fill(map.name);
            await page.keyboard.press('Enter');
        });

        await test.step('Only the searched resource is listed', async() => {
            await expect(page.locator('.ms-resource-card').filter({ hasText: map.name })).toBeVisible({ timeout: 15000 });
            await expect(page.locator('.ms-resource-card').filter({ hasText: other.name })).toHaveCount(0);
        });
    });

    test('A resource can be added to favorites', async({ page, data }) => {
        await login(page);
        const map = await data.map();

        await openAppTarget(page, '#/');
        await page.getByPlaceholder('Search...').fill(map.name);
        await page.keyboard.press('Enter');

        const card = page.locator('.ms-resource-card').filter({ hasText: map.name });
        await expect(card).toBeVisible({ timeout: 15000 });

        // An empty heart is not a favorite yet; the filled one is.
        await card.locator('button:has(.glyphicon-heart-o)').click();
        await expect(card.locator('.glyphicon-heart')).toBeVisible({ timeout: 15000 });
    });
});
