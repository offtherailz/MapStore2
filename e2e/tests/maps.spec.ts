import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Example E2E tests for the Maps section of MapStore2.
 * Use these as a reference when writing tests that interact with maps.
 */
test.describe('Maps', () => {

    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('maps page loads and shows the map grid', async ({ page }) => {
        await page.goto('/');
        // Wait for the map cards to appear
        await expect(page.locator('.ms-grid-container, .ms-card, .mapstore-card').first()).toBeVisible({ timeout: 20000 });
    });

    test('can search for a map by name', async ({ page }) => {
        await page.goto('/');
        const searchInput = page.getByPlaceholder(/search/i);
        await searchInput.fill('New Map');
        await searchInput.press('Enter');
        // Results should refresh - wait for the grid to stabilise
        await page.waitForLoadState('networkidle');
        // Verify the grid is still visible (results or empty state)
        await expect(page.locator('.ms-grid-container, .empty-state').first()).toBeVisible();
    });
});
