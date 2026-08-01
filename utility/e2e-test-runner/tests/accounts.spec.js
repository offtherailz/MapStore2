import { test, expect } from './fixtures.js';
import { login, logout } from './helpers/auth.js';
import { openAppTarget } from './helpers/navigation.js';

/** Opens the user manager through the account menu: it has no reachable hash route. */
async function openUserManager(page) {
    await page.locator('button.dropdown-toggle.btn-success').click();
    await page.locator('.dropdown-menu li').filter({ hasText: 'Manage Accounts' }).first().click();
    await expect(page).toHaveURL(/#\/manager\/usermanager/, { timeout: 20000 });
}

test.describe('Accounts', () => {
    test.beforeEach(async({ page }) => {
        await login(page);
    });

    test('User manager lists the accounts of the instance', async({ page }) => {
        await openUserManager(page);

        await expect(page.getByText(/\d+ Users found/)).toBeVisible({ timeout: 20000 });
        await expect(page.getByRole('button', { name: 'New User' })).toBeVisible();

        // The account name also lives in the hidden account menu, so the assertion goes
        // through the manager search instead of a bare text match.
        await page.getByPlaceholder('Search users...').fill('admin');
        await expect(page.getByText(/^1 Users? found$/)).toBeVisible({ timeout: 20000 });
    });

    test('A user created through the API is listed and can sign in', async({ page, data }) => {
        const password = 'E2ePassword!1';
        const user = await data.user({ password });

        await test.step('The account shows in the manager', async() => {
            await openUserManager(page);
            await page.getByPlaceholder('Search users...').fill(user.name);
            await expect(page.getByText(/^1 Users? found$/)).toBeVisible({ timeout: 20000 });
        });

        await test.step('The account can sign in', async() => {
            // The manager has no account menu, so signing out starts from the homepage.
            await openAppTarget(page, '#/');
            await logout(page);
            await login(page, user.name, password);
            await expect(page.locator('[role="alert"].alert-danger')).toHaveCount(0);
            await expect(page.locator('#mapstore-login-menu')).toBeVisible();
        });
    });
});
