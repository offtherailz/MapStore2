import { expect, Page } from '@playwright/test';
import { config } from '../config';
import { openAppTarget } from './navigation';

/**
 * Logs in to MapStore2 with the given credentials.
 * Waits for the home page to load after login.
 *
 * @param page     Playwright Page object
 * @param username username (default: admin)
 * @param password password (default: admin)
 */
export async function login(
    page: Page,
    username = config.adminUser,
    password = config.adminPassword
): Promise<void> {
    // Open the login form
    await openAppTarget(page, '#/');
    await page.locator('#mapstore-login-menu').click();
    await page.getByRole('menuitem', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Username' }).click();
    await page.getByRole('textbox', { name: 'Username' }).fill(username);
    await page.getByRole('textbox', { name: 'Username' }).press('Tab');
    await page.getByRole('textbox', { name: 'Password' }).fill(password);
    await page.getByRole('textbox', { name: 'Password' }).press('Enter');
    // await page.getByRole('menuitem', { name: ' Account Info' }).click();
    await expect(page.locator('#mapstore-login-menu')).toBeVisible();
    await page.locator('button.btn-success').waitFor({ state: 'visible' });

}

/**
 * Logs out of MapStore2.
 */
export async function logout(page: Page): Promise<void> {
    // Click the user menu, then logout
    await page.locator('#mapstore-login-menu').click();
    // Use glyphicon selector to handle localization where text may vary
    await page.locator('[role="menuitem"] .glyphicon-log-out').click();
    // Wait for the login button to reappear
    await expect(page.locator('#mapstore-login-menu')).toBeVisible();
}
