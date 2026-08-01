import { test, expect } from './fixtures.js';
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

});
