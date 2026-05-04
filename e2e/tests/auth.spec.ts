import { test, expect } from '@playwright/test';
import { login, logout } from './helpers/auth';

/**
 * Example E2E tests for MapStore2 authentication.
 * These tests demonstrate the recommended patterns to use when writing new tests.
 */
test.describe('Authentication', () => {

    test('admin can log in and log out', async ({ page }) => {
        await login(page);
        // After login the username should appear in the toolbar
        // click on login menu to open the dropdown and check for account info


        await logout(page);
        // After logout the login button should be visible again
        await expect(page.locator('#mapstore-login-menu')).toBeVisible();

    });

    test('login fails with wrong credentials', async ({ page }) => {
        await login(page, 'wronguser', 'wrongpassword');
        // Expect an error message to be visible
        await expect(page.locator('[role="alert"].alert-danger')).toBeVisible();
        await expect(page.locator('[role="alert"].alert-danger')).toContainText('Username or password incorrect');
    });
});
