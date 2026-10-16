import { expect } from '@playwright/test';
import { config } from '../config.js';
import { openAppTarget } from './navigation.js';

/**
 * Logs in to MapStore2 with the given credentials.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} username
 * @param {string} password
 */
async function login(page, username = config.adminUser, password = config.adminPassword) {
    await openAppTarget(page, '#/');
    await page.locator('#mapstore-login-menu').click();
    await page.getByRole('menuitem', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Username' }).click();
    await page.getByRole('textbox', { name: 'Username' }).fill(username);
    await page.getByRole('textbox', { name: 'Username' }).press('Tab');
    await page.getByRole('textbox', { name: 'Password' }).fill(password);
    await page.getByRole('textbox', { name: 'Password' }).press('Enter');
    // Waits for the outcome, so callers can assert either: a signed in user gets the
    // green account menu toggle, a rejected one an error in the login dialog.
    const signedIn = page.locator('button.dropdown-toggle.btn-success');
    const rejected = page.locator('[role="alert"].alert-danger');
    await expect(signedIn.or(rejected).first()).toBeVisible({ timeout: 15000 });
}

/**
 * Logs out of MapStore2.
 *
 * @param {import('@playwright/test').Page} page
 */
async function logout(page) {
    await page.locator('#mapstore-login-menu').click();
    await page.locator('[role="menuitem"] .glyphicon-log-out').click();
    await expect(page.locator('#mapstore-login-menu')).toBeVisible();
}

/**
 * Closes the login dialog, which stays open after a rejected login.
 *
 * @param {import('@playwright/test').Page} page
 */
async function closeLoginDialog(page) {
    const dialog = page.locator('[role="dialog"]').filter({ has: page.getByRole('heading', { name: 'Login' }) });

    await dialog.getByRole('button', { name: 'Close' }).first().click();
    await expect(dialog).toHaveCount(0);
}

/**
 * Signs in unless the session is still valid, e.g. after a page reload.
 *
 * @param {import('@playwright/test').Page} page
 */
async function ensureSignedIn(page) {
    await openAppTarget(page, '#/');
    await expect(page.locator('#mapstore-login-menu')).toBeVisible({ timeout: 30000 });
    const signedIn = await page.locator('button.dropdown-toggle.btn-success')
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true, () => false);

    if (!signedIn) {
        await login(page);
    }
}

export { login, logout, closeLoginDialog, ensureSignedIn };
