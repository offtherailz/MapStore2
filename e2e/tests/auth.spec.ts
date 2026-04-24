import { test, expect } from '@playwright/test';
import { login, logout } from './helpers/auth';

/**
 * Example E2E tests for MapStore2 authentication.
 * These tests demonstrate the recommended patterns to use when writing new tests.
 */
test.describe('Authentication', () => {

    test('login page is accessible', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('admin can log in and log out', async ({ page }) => {
        await login(page);
        // After login the username should appear in the toolbar
        await expect(page.getByText('admin', { exact: false })).toBeVisible();

        await logout(page);
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('login fails with wrong credentials', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('button', { name: /sign in/i }).click();
        await page.getByLabel(/username/i).fill('wrong_user');
        await page.getByLabel(/password/i).fill('wrong_password');
        await page.getByRole('button', { name: /sign in/i }).last().click();
        // An error message should appear
        await expect(page.locator('.alert, .notification-error, [class*="error"]').first()).toBeVisible({ timeout: 10000 });
    });
});
