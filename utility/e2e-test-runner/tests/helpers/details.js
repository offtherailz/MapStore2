/**
 * Properties panel of a resource (Info, Permissions and About tabs), opened from a
 * homepage card or from the top bar of a viewer.
 */

import { expect } from '@playwright/test';

const DETAILS = '.ms-resource-detail';

function detailsPanel(page) {
    return page.locator(DETAILS);
}

/** Opens the panel from the details button of a homepage card. */
async function openCardDetails(page, card) {
    await card.locator('button:has(.glyphicon-details)').click();
    await expect(detailsPanel(page)).toBeVisible();

    return detailsPanel(page);
}

/** Opens the panel from the top bar of a map, dashboard or story viewer. */
async function openViewerDetails(page) {
    await page.locator('.ms-brand-navbar button:has(.glyphicon-details)').first().click();
    await expect(detailsPanel(page)).toBeVisible({ timeout: 20000 });

    return detailsPanel(page);
}

/**
 * Switches the open panel to edit mode. On the homepage the panel gets its own save
 * button; in a viewer the changes are saved with the resource (see saveFromViewer).
 */
async function editOpenDetails(page) {
    const panel = detailsPanel(page);
    const edit = panel.locator('button:has(.glyphicon-edit)');

    // The button toggles edit mode: a viewer keeps it on between two openings.
    if (!/btn-success/.test(await edit.getAttribute('class') ?? '')) {
        await edit.click();
    }

    await expect(edit).toHaveClass(/btn-success/);

    return panel;
}

/** Saves the resource open in a viewer, details included, from the top bar. */
async function saveFromViewer(page) {
    await page.locator('.ms-brand-navbar button:has(.glyphicon-floppy-disk)').first().click();
    await expect(page.getByText('Saved successfully')).toBeVisible({ timeout: 20000 });
}

/** Opens the panel of a card in edit mode. */
async function editDetails(page, card) {
    await openCardDetails(page, card);

    return editOpenDetails(page);
}

/**
 * Saves the details and closes the panel, as a user does before moving on.
 *
 * Pending changes are recomputed with a 500 ms debounce (useComputedPendingChanges), so
 * right after the save the panel still asks to discard them. Nothing in the DOM marks the
 * end of that computation: the close is retried, going back to the panel when asked.
 */
async function saveDetails(page) {
    const panel = detailsPanel(page);
    const save = panel.locator('button:has(.glyphicon-floppy-disk)');
    await expect(save).toBeEnabled();
    await save.click();
    await expect(save).toHaveCount(0, { timeout: 20000 });

    await expect(async() => {
        const backToEditing = page.getByRole('button', { name: 'Back to editing' });

        if (await backToEditing.isVisible()) {
            await backToEditing.click();
        }

        await panel.locator('button:has(.glyphicon-1-close)').first().click();
        await expect(panel).toBeHidden({ timeout: 1000 });
    }).toPass({ timeout: 10000 });
}

// ── permissions ──────────────────────────────────────────────────────────────

/** Opens the Permissions tab of the open panel in edit mode. */
async function editPermissions(page) {
    const panel = detailsPanel(page);
    await panel.getByRole('tab', { name: 'Permissions' }).click();
    await editOpenDetails(page);

    return panel;
}

function permissionRow(page, name) {
    return detailsPanel(page).locator('.ms-permissions-row').filter({ hasText: name });
}

/**
 * Adds permission entries through the Add Permission popover.
 *
 * @param {string[]} names groups or IP ranges (CIDR) to add
 * @param {'Groups'|'IP Ranges'} [kind]
 */
async function addPermissions(page, names, kind = 'Groups') {
    await detailsPanel(page).getByRole('button', { name: /Add Permission/ }).click();

    if (kind !== 'Groups') {
        await page.getByRole('button', { name: kind }).click();
    }

    for (const name of names) {
        await page.getByPlaceholder('Filter...').fill(name);
        await page.locator('li').filter({ hasText: name }).locator('button:has(.glyphicon-plus)').click();
        await expect(permissionRow(page, name)).toBeVisible();
    }

    // The popover only closes from its own button.
    await detailsPanel(page).getByRole('button', { name: /Add Permission/ }).click();
    await expect(page.locator('.ms-popover-overlay')).toHaveCount(0);
}

/** @param {'View'|'Edit'} level */
async function setPermission(page, name, level) {
    await permissionRow(page, name).locator('.Select-control').click();
    await page.locator('.Select-option').filter({ hasText: level }).click();
    await expect(permissionRow(page, name).locator('.Select-value-label')).toHaveText(level);
}

export {
    DETAILS,
    detailsPanel,
    openCardDetails,
    openViewerDetails,
    editOpenDetails,
    saveFromViewer,
    editDetails,
    saveDetails,
    editPermissions,
    addPermissions,
    permissionRow,
    setPermission
};
