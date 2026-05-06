import { test, expect } from '@playwright/test';
import { environment, hasFeature } from './config.js';
import { login, logout } from './helpers/auth.js';

test.describe('LDAP', () => {
    test('LDAP user can sign in and sign out', async({ page }) => {
        test.skip(!hasFeature('ldap'), 'Requires feature ldap');

        const username = environment.user.username;
        const password = environment.user.password;
        test.skip(!username || !password, 'Requires MS_USER_STANDARD and MS_PASSWORD_STANDARD');

        await test.step('Sign in with LDAP standard user credentials', async() => {
            await login(page, username, password);
        });

        await test.step('Verify user menu is available and no error alert is shown', async() => {
            await expect(page.locator('#mapstore-login-menu')).toBeVisible();
            await expect(page.locator('[role="alert"].alert-danger')).toHaveCount(0);
        });

        await test.step('Sign out and verify anonymous state is restored', async() => {
            await logout(page);
            await expect(page.locator('#mapstore-login-menu')).toBeVisible();
        });
    });
});
