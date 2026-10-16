import { test, expect, fromScenario } from './fixtures.js';
import { login, logout } from './helpers/auth.js';
import { openAppTarget } from './helpers/navigation.js';
import { openDashboard, addWidget, commitTextWidgetBody, saveWidget, saveDashboard } from './helpers/dashboard.js';
import { openViewerDetails, editOpenDetails, saveFromViewer, openCardDetails } from './helpers/details.js';

/** Bottom bar of the dashboard listing its layout views. */
const VIEWS = '.view-switcher-container';

function viewTab(page, name) {
    return page.locator(`${VIEWS} .ms-layout-view`).filter({ hasText: name });
}

function viewNames(page) {
    return page.locator(`${VIEWS} .ms-layout-view > button:first-child`).allInnerTexts();
}

/** Menu items are disabled on their list item, not on the item itself. */
function menuEntry(menu, name) {
    return menu.locator('li').filter({ has: menu.page().getByRole('menuitem', { name }) });
}

async function openViewMenu(page, name) {
    await viewTab(page, name).locator('button:has(.glyphicon-option-vertical)').click();

    return page.locator('[role="menu"]:visible').last();
}

const CONFIGURE_DIALOG = '.configure-view-dialog-container';

/** Names the view whose configuration dialog is open. */
async function nameView(page, name) {
    const dialog = page.locator(CONFIGURE_DIALOG);
    await dialog.locator('input[type="text"]').fill(name);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(viewTab(page, name)).toBeVisible();
}

async function configureView(page, from, to) {
    const menu = await openViewMenu(page, from);
    await menu.getByRole('menuitem', { name: 'Configure' }).click();
    await nameView(page, to);
}

/** Adds a text widget to the current view of the open dashboard. */
async function addTextWidget(page, title) {
    await addWidget(page, 'Text');
    await page.getByPlaceholder('Insert title...').fill(title);
    await commitTextWidgetBody(page);
    await saveWidget(page);
    await expect(page.getByText(title)).toBeVisible({ timeout: 15000 });
}

/** Adds a view: its configuration dialog opens right away. */
async function addView(page, name) {
    await page.locator(`${VIEWS} button[title="Add a layout view to the dashboard"]`).click();
    await expect(page.locator(CONFIGURE_DIALOG)).toBeVisible();
    await nameView(page, name);
}

test.describe('Dashboard views', () => {
    test('Views are renamed, added, moved and removed, and shown read only to visitors', fromScenario('Dashboard/CreateDelete — Tabbed View (@GH-11524 @GH-11527)'), async({ page, data }) => {
        const dashboard = await data.dashboard();

        await login(page);
        await openDashboard(page, dashboard.id);

        await test.step('Rename the main view', async() => {
            await configureView(page, 'Main view', 'E2E first');
        });

        await test.step('Add a second view and name it', async() => {
            await addView(page, 'E2E second');
            expect(await viewNames(page)).toEqual(['E2E first', 'E2E second']);
        });

        await test.step('Move the second view to the left and back', async() => {
            let menu = await openViewMenu(page, 'E2E second');
            await expect(menuEntry(menu, 'Move right')).toHaveClass(/disabled/);
            await menu.getByRole('menuitem', { name: 'Move left' }).click();
            expect(await viewNames(page)).toEqual(['E2E second', 'E2E first']);

            menu = await openViewMenu(page, 'E2E second');
            await expect(menuEntry(menu, 'Move left')).toHaveClass(/disabled/);
            await menu.getByRole('menuitem', { name: 'Move right' }).click();
            expect(await viewNames(page)).toEqual(['E2E first', 'E2E second']);
        });

        await test.step('Remove a view, add another one and save', async() => {
            const menu = await openViewMenu(page, 'E2E second');
            await menu.getByRole('menuitem', { name: 'Delete' }).click();
            const confirm = page.locator('[role="dialog"]').filter({ hasText: /delete|remove/i }).last();
            if (await confirm.getByRole('button', { name: /^(Delete|Yes|Remove)$/ }).isVisible().catch(() => false)) {
                await confirm.getByRole('button', { name: /^(Delete|Yes|Remove)$/ }).click();
            }
            await expect(viewTab(page, 'E2E second')).toHaveCount(0);

            await addView(page, 'E2E third');

            await page.locator('.ms-brand-navbar button:has(.glyphicon-floppy-disk)').first().click();
            await expect(page.getByText('Saved successfully')).toBeVisible({ timeout: 20000 });
        });

        await test.step('A visitor sees the views without their settings', async() => {
            await data.publish(dashboard);
            await openAppTarget(page, '#/');
            await logout(page);
            await openDashboard(page, dashboard.id);
            expect(await viewNames(page)).toEqual(['E2E first', 'E2E third']);
            await expect(page.locator(`${VIEWS} .ms-layout-view button:has(.glyphicon-option-vertical)`)).toHaveCount(0);
        });
    });

    test('A view shows a linked dashboard, read only', fromScenario('Dashboard/CreateDelete — Link dashboard in a view (@GH-11528 @GH-12032)'), async({ page, data }) => {
        const source = await data.dashboard();
        const target = await data.dashboard();
        const linkedTitle = 'E2E linked widget';

        await login(page);

        await test.step('The source dashboard has a widget', async() => {
            await openDashboard(page, source.id);
            await addTextWidget(page, linkedTitle);
            await saveDashboard(page);
        });

        await test.step('A view of another dashboard links the source', async() => {
            await openDashboard(page, target.id);
            await page.locator(`${VIEWS} button[title="Add a layout view to the dashboard"]`).click();
            const dialog = page.locator(CONFIGURE_DIALOG);
            await dialog.locator('input[type="text"]').fill('E2E linked view');
            await dialog.getByRole('checkbox', { name: 'Link existing dashboard' }).check();
            await dialog.locator('.Select-control').last().click();
            await page.locator('.Select-option').filter({ hasText: source.name }).click();
            await dialog.getByRole('button', { name: 'Save' }).click();
            await expect(page.getByText(linkedTitle)).toBeVisible({ timeout: 20000 });
            // Disabled either through the attribute or the class, depending on the button.
            const addButton = page.locator('button.btn-tray:has(.glyphicon-plus)').first();
            await expect.poll(() => addButton.evaluate((button) => button.disabled || button.classList.contains('disabled')))
                .toBe(true);
        });

        await test.step('A view with widgets cannot link a dashboard', async() => {
            await addView(page, 'E2E own view');
            await addTextWidget(page, 'E2E own widget');
            const menu = await openViewMenu(page, 'E2E own view');
            await menu.getByRole('menuitem', { name: 'Configure' }).click();
            await expect(page.locator(CONFIGURE_DIALOG).getByRole('checkbox', { name: 'Link existing dashboard' })).toBeDisabled();
        });
    });

    test('Details written in a dashboard are shown in its viewer and on its card', fromScenario('Dashboard/CreateDelete — Details for Dashboard (@GH-9683)'), async({ page, data }) => {
        const dashboard = await data.dashboard();
        const text = 'Dashboard details written by the E2E suite';

        await login(page);
        await openDashboard(page, dashboard.id);
        await openViewerDetails(page);
        const panel = await editOpenDetails(page);
        await panel.getByRole('tab', { name: 'About' }).click();
        const editor = panel.locator('.public-DraftEditor-content');
        await editor.click();
        await editor.pressSequentially(text, { delay: 10 });
        await saveFromViewer(page);

        await test.step('The viewer shows them', async() => {
            await openDashboard(page, dashboard.id);
            const viewerPanel = await openViewerDetails(page);
            await viewerPanel.getByRole('tab', { name: 'About' }).click();
            await expect(viewerPanel.getByText(text)).toBeVisible({ timeout: 15000 });
        });

        await test.step('The card shows them', async() => {
            await openAppTarget(page, '#/');
            await page.getByPlaceholder('Search...').first().fill(dashboard.name);
            await page.keyboard.press('Enter');
            const card = page.locator('.ms-resource-card').filter({ hasText: dashboard.name });
            const cardPanel = await openCardDetails(page, card);
            await cardPanel.getByRole('tab', { name: 'About' }).click();
            await expect(cardPanel.getByText(text)).toBeVisible({ timeout: 15000 });
        });
    });
});
