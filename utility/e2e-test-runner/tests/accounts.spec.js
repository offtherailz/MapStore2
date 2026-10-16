import { test, expect } from './fixtures.js';
import { login, logout, closeLoginDialog } from './helpers/auth.js';
import { openAppTarget } from './helpers/navigation.js';

/** Opens the user manager through the account menu: it has no reachable hash route. */
async function openUserManager(page) {
    await page.locator('button.dropdown-toggle.btn-success').click();
    await page.locator('.dropdown-menu li').filter({ hasText: 'Manage Accounts' }).first().click();
    await expect(page).toHaveURL(/#\/manager\/usermanager/, { timeout: 20000 });
}

/**
 * The user dialog has three tabs identified only by their glyph: 1 general,
 * 2 attributes, 3 groups.
 *
 * @returns {import('@playwright/test').Locator} the pane of the tab
 */
async function openUserDialogTab(dialog, index) {
    await dialog.locator(`#userDetails-tabs-tab-${index}`).click();
    const pane = dialog.locator(`#userDetails-tabs-pane-${index}`);
    await expect(pane).toHaveClass(/active/);

    return pane;
}

function userEntry(page, name) {
    return page.locator('[role="tabpanel"] li').filter({ hasText: name });
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

    test('Admin creates a user from the manager, then edits its attributes and groups', async({ page, api, data }) => {
        const name = data.name('user');
        const password = 'E2ePassword!1';
        const email = `${name.toLowerCase()}@example.com`;
        const group = await data.group();
        const dialog = page.locator('[role="dialog"]').filter({ has: page.locator('#userDetails-tabs') });

        await test.step('Create the user with the ADMIN role', async() => {
            await openUserManager(page);
            await page.getByRole('button', { name: 'New User' }).click();
            await dialog.locator('input[name="name"]').fill(name);
            await dialog.locator('input[name="newPassword"]').fill(password);
            await dialog.locator('input[name="confirmPassword"]').fill(password);
            await dialog.locator('select[name="role"]').selectOption('ADMIN');
            await dialog.getByRole('button', { name: 'Create' }).click();
            await expect(dialog.getByRole('button', { name: 'Created!' })).toBeVisible({ timeout: 20000 });
            await dialog.getByRole('button', { name: 'Close' }).click();
            await expect(userEntry(page, name)).toBeVisible({ timeout: 20000 });
        });

        await test.step('Adopt the user, so it is removed even if a later step fails', async() => {
            const [user] = (await api.findUsers(name)).filter((entry) => entry.name === name);
            expect(user, `user ${name} not found through the API`).toBeTruthy();
            data.trackUser(user);
            expect((await api.getUser(user.id)).role).toBe('ADMIN');
        });

        await test.step('Edit the user: set an attribute and add a group', async() => {
            await page.getByPlaceholder('Search users...').fill(name);
            await expect(page.getByText(/^1 Users? found$/)).toBeVisible({ timeout: 20000 });
            await userEntry(page, name).locator('button:has(.glyphicon-wrench)').click();
            await expect(dialog).toBeVisible();

            const attributes = await openUserDialogTab(dialog, 2);
            await attributes.locator('input[name="attribute.email"]').fill(email);

            const groups = await openUserDialogTab(dialog, 3);
            await groups.getByRole('combobox').fill(group.groupName);
            await page.locator('.Select-option').filter({ hasText: group.groupName }).click();
            await expect(groups.locator('.Select-value').filter({ hasText: group.groupName })).toBeVisible();

            await dialog.getByRole('button', { name: 'Save' }).click();
            await expect(dialog.getByRole('button', { name: 'Saved!' })).toBeVisible({ timeout: 20000 });
        });

        await test.step('The changes are stored', async() => {
            const [user] = (await api.findUsers(name)).filter((entry) => entry.name === name);
            const stored = await api.getUser(user.id);
            expect(stored.attribute.find((attribute) => attribute.name === 'email')?.value).toBe(email);
            expect(stored.groups.map((entry) => entry.groupName)).toContain(group.groupName);
        });
    });

    test('A standard user changes its own password from the account menu', async({ page, data }) => {
        const password = 'E2ePassword!1';
        const newPassword = 'E2eChanged!2';
        const user = await data.user({ password });

        await test.step('Sign in as the user and change the password', async() => {
            await openAppTarget(page, '#/');
            await logout(page);
            await login(page, user.name, password);
            await page.locator('button.dropdown-toggle.btn-success').click();
            await page.locator('.dropdown-menu li').filter({ hasText: 'Change Password' }).first().click();
            await page.getByRole('textbox', { name: 'New Password' }).fill(newPassword);
            await page.getByRole('textbox', { name: 'Retype Password' }).fill(newPassword);
            await page.getByRole('button', { name: 'Change Password' }).click();
            await expect(page.locator('.alert-success')).toBeVisible({ timeout: 20000 });
        });

        await test.step('Only the new password is accepted', async() => {
            await page.keyboard.press('Escape');
            await openAppTarget(page, '#/');
            await logout(page);
            await login(page, user.name, password);
            await expect(page.locator('[role="alert"].alert-danger')).toBeVisible();
            await closeLoginDialog(page);
            await login(page, user.name, newPassword);
            await expect(page.locator('[role="alert"].alert-danger')).toHaveCount(0);
            await expect(page.locator('button.dropdown-toggle.btn-success')).toBeVisible();
        });
    });
});
