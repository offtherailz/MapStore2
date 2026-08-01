import { test, expect, describeIfFeature } from './fixtures.js';
import { getIdentity } from './config.js';
import { login, logout } from './helpers/auth.js';

describeIfFeature('ldap', 'LDAP', () => {
    test('LDAP user can sign in and sign out', async({ page }) => {
        // A profile may declare a dedicated ldapUser; otherwise the standard user of
        // the environment is expected to live in the LDAP store.
        const identity = getIdentity('ldapUser') ?? getIdentity('standardUser');
        test.skip(!identity, 'Requires an ldapUser identity or MS_USER_STANDARD/MS_PASSWORD_STANDARD');

        await test.step('Sign in with LDAP standard user credentials', async() => {
            await login(page, identity.username, identity.password);
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
