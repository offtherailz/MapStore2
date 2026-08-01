/**
 * GeoStory helpers.
 *
 * A story opens in view mode; the editing tools only exist after switching to edit mode,
 * and each mode shows its own guided tour on first visit.
 */

import { expect } from '@playwright/test';
import { openAppTarget, dismissTutorial } from './navigation.js';

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} id resource id of a GEOSTORY
 */
async function openGeostory(page, id) {
    await openAppTarget(page, `#/geostory/${id}`);
    await expect(page.locator('.ms-brand-navbar')).toBeVisible({ timeout: 30000 });
    await dismissTutorial(page);
}

/** Switches a story from view mode to edit mode. */
async function enterEditMode(page) {
    await page.locator('button:has(.glyphicon-pencil)').first().click();
    await dismissTutorial(page);
    await expect(page.locator('button:has(.glyphicon-plus)').first()).toBeVisible({ timeout: 15000 });
}

/**
 * Adds a section through the add bar.
 *
 * @param {string} type section glyph suffix, e.g. 'title', 'paragraph', 'media'
 */
async function addSection(page, type) {
    await page.locator('button:has(.glyphicon-plus)').last().click();
    await expect(page.locator('.add-bar-popover')).toBeVisible({ timeout: 15000 });
    await page.locator(`.add-bar-popover button:has(.glyphicon-story-${type}-section)`).click();
}

/** Saves the story resource through the top toolbar. */
async function saveGeostory(page) {
    await page.locator('.ms-brand-navbar button:has(.glyphicon-floppy-disk)').first().click();
    await expect(page.getByText('Saved successfully')).toBeVisible({ timeout: 20000 });
}

export { openGeostory, enterEditMode, addSection, saveGeostory };
