/**
 * Dashboard editor helpers.
 *
 * Widgets that read data are built on the layer published by the `geoserver` profile,
 * which the profile also sets as the only catalog service of the dashboard editor.
 */

import { expect } from '@playwright/test';
import { openAppTarget, dismissTutorial, moveAwayFromTooltips } from './navigation.js';

/** Widget types offered by the wizard. */
const WIDGET_TYPES = ['Chart', 'Text', 'Table', 'Counter', 'Map', 'Filter selector'];

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} id resource id of a DASHBOARD
 */
async function openDashboard(page, id) {
    await openAppTarget(page, `#/dashboard/${id}`);
    await expect(page.locator('.ms-brand-navbar')).toBeVisible({ timeout: 30000 });
    await dismissTutorial(page);
}

/**
 * Starts the widget wizard on the given type.
 *
 * @param {string} type one of WIDGET_TYPES
 */
async function addWidget(page, type) {
    await page.locator('button.btn-tray:has(.glyphicon-plus)').first().click();
    await expect(page.getByText('Select the widget type')).toBeVisible({ timeout: 15000 });
    await page.getByText(type, { exact: true }).first().click();
}

/**
 * Flushes the body of a text widget into the widget being built.
 *
 * The Draft.js editor pushes its content to the widget with a debounce and exposes no
 * DOM signal for it, so the editor is blurred and the debounce waited out. Saving the
 * widget any earlier stores an empty body.
 */
async function commitTextWidgetBody(page) {
    await page.getByPlaceholder('Insert title...').click();
    await page.waitForTimeout(1500);
}

/** Advances the wizard to the next step. */
async function wizardNext(page) {
    await page.locator('button:has(.glyphicon-arrow-right)').click();
}

/**
 * Saves the widget being built. The wizard footer and the top toolbar both use a
 * floppy-disk glyph, so the footer one is addressed through its button group.
 */
async function saveWidget(page) {
    await page.locator('.btn-group button:has(.glyphicon-floppy-disk)').last().click();
}

/**
 * Picks a value in a react-select combo, addressed by the label above it.
 *
 * @param {number} index position of the combo in the step, 0 based
 * @param {string} option option label to pick
 */
async function selectCombo(page, index, option) {
    await page.locator('.Select-control').nth(index).click();
    await page.locator('.Select-menu-outer').getByText(option, { exact: true }).first().click();
}

/**
 * Picks a value in the combo that follows a field label.
 *
 * The chart step mixes chart/trace selectors with the data ones, so positions are not
 * stable: the label is the only reliable anchor.
 *
 * @param {string} label e.g. 'X Attribute', 'Operation'
 * @param {string} option option label to pick
 */
async function selectComboByLabel(page, label, option) {
    const combo = page.locator(
        `xpath=//*[normalize-space(text())="${label}"]/following::*[contains(@class,"Select-control")][1]`
    );

    await combo.click();
    await page.locator('.Select-menu-outer').getByText(option, { exact: true }).first().click();
}

/** Picks the fixture layer in the layer step of the wizard. */
async function pickFixtureLayer(page, title) {
    await expect(page.getByText('Local GeoServer WFS')).toBeVisible({ timeout: 20000 });

    const record = page.locator('.ms-catalog-card').filter({ hasText: title }).first();
    await expect(record).toBeVisible({ timeout: 20000 });
    await moveAwayFromTooltips(page);
    await record.click();
}

/** Saves the dashboard resource itself, through the top toolbar. */
async function saveDashboard(page) {
    await page.locator('.ms-brand-navbar button:has(.glyphicon-floppy-disk)').first().click();
    await expect(page.getByText('Saved successfully')).toBeVisible({ timeout: 15000 });
}

export {
    WIDGET_TYPES,
    openDashboard,
    addWidget,
    wizardNext,
    saveWidget,
    saveDashboard,
    commitTextWidgetBody,
    selectCombo,
    selectComboByLabel,
    pickFixtureLayer
};
