/**
 * Application context helpers.
 *
 * The context creator is a four step wizard. Each step can raise its own guided tour,
 * whose buttons share the labels of the wizard ones, so every locator is scoped to the
 * creator page and the tour is dismissed before each interaction.
 */

import { expect } from '@playwright/test';
import { dismissTutorial } from './navigation.js';

const CREATOR = '#page-context-creator';
const STEPS = ['General Settings', 'Configure Map', 'Configure Plugins', 'Theme'];

/** Opens the creator through the homepage menu: a hash jump alone bounces back home. */
async function openContextCreator(page) {
    await page.getByRole('button', { name: 'Add Resource' }).click();
    await page.getByRole('menuitem', { name: 'Create context' }).click();
    await expect(page.locator(CREATOR)).toBeVisible({ timeout: 30000 });
    await dismissTutorial(page);
}

/**
 * Fills the mandatory fields of the first step. Both are required: the wizard refuses to
 * advance while either is empty.
 */
async function fillGeneralSettings(page, name, windowTitle = name) {
    await page.getByPlaceholder('Enter app context name...').fill(name);
    await page.getByPlaceholder('Enter window title...').fill(windowTitle);
}

/** Advances the wizard, dismissing the tour of the step first. */
async function wizardNext(page) {
    await dismissTutorial(page, { timeout: 3000 });
    await page.locator(CREATOR).getByRole('button', { name: 'Next' }).click();
}

export { CREATOR, STEPS, openContextCreator, fillGeneralSettings, wizardNext };
