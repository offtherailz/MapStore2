import { test, expect } from '@playwright/test';
import { openAppTarget } from './helpers/navigation.js';

/**
 * Smoke suite — data-agnostic, runs on clean or pre-populated instances.
 */
test.describe('Smoke', () => {
    test('Homepage is available and main controls are rendered', async({ page }) => {
        await test.step('Open homepage', async() => {
            await openAppTarget(page, '#/');
        });

        await test.step('Verify main homepage controls are visible', async() => {
            await expect(page.locator('#mapstore-login-menu')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Order by' })).toBeVisible();
        });

        await test.step('Verify footer links are visible', async() => {
            await expect(page.getByRole('link', { name: 'Documentation' })).toBeVisible();
            await expect(page.getByRole('link', { name: 'GitHub' })).toBeVisible();
        });

        await test.step('Verify no page loading error is shown', async() => {
            await expect(page.getByText('Page Loading Error')).toHaveCount(0);
        });
    });

    test('Order by menu is accessible with all expected sort options', async({ page }) => {
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
});
