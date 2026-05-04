const { expect } = require('@playwright/test');
const { config } = require('../config');
const { openAppTarget } = require('./navigation');

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
    await expect(page.locator('#mapstore-login-menu')).toBeVisible();
    await page.locator('button.btn-success').waitFor({ state: 'visible' });
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

module.exports = { login, logout };
