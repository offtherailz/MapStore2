import { test, expect } from './fixtures.js';
import { login, logout } from './helpers/auth.js';

/**
 * Authentication suite.
 */
test.describe('Authentication', () => {
    test('Admin can sign in and sign out', async({ page }) => {
        await test.step('Sign in as admin', async() => {
            await login(page);
        });

        await test.step('Sign out and verify anonymous state is restored', async() => {
            await logout(page);
            await expect(page.locator('#mapstore-login-menu')).toBeVisible();
        });
    });

    test('Login fails with invalid credentials and shows an error', async({ page }) => {
        await test.step('Submit intentionally invalid credentials', async() => {
            await login(page, 'wronguser', 'wrongpassword');
        });

        await test.step('Verify authentication error alert is shown', async() => {
            await expect(page.locator('[role="alert"].alert-danger')).toBeVisible();
        });
    });
});
