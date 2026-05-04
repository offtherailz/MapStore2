import { test, expect } from '@playwright/test';
import { login, logout } from './helpers/auth.js';

/**
 * Example E2E tests for MapStore2 authentication.
 * These tests demonstrate the recommended patterns to use when writing new tests.
 */
test.describe('Authentication', () => {

    test('admin can log in and log out', async ({ page }) => {
        await login(page);
        await logout(page);
        await expect(page.locator('#mapstore-login-menu')).toBeVisible();
    });

    test('login fails with wrong credentials', async ({ page }) => {
        await login(page, 'wronguser', 'wrongpassword');
        await expect(page.locator('[role="alert"].alert-danger')).toBeVisible();
        await expect(page.locator('[role="alert"].alert-danger')).toContainText('Username or password incorrect');
    });
});
