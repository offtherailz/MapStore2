import { Page } from '@playwright/test';
import { config } from '../config';

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
    await page.goto('/');
    // Open the login form
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.getByLabel(/username/i).fill(username);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /sign in/i }).last().click();
    // Wait for the user menu to appear, confirming login succeeded
    await page.getByText(username, { exact: false }).waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * Logs out of MapStore2.
 */
export async function logout(page: Page): Promise<void> {
    // Click the user menu, then logout
    await page.locator('.user-menu').click();
    await page.getByText(/logout/i).click();
    await page.getByRole('button', { name: /sign in/i }).waitFor({ state: 'visible' });
}
