import { test, expect } from './fixtures.js';
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
});
