import { test, expect, fromScenario } from './fixtures.js';
import { login, ensureSignedIn } from './helpers/auth.js';
import { openAppTarget, dismissTutorial } from './helpers/navigation.js';
import { CREATOR, STEPS, openContextCreator, fillGeneralSettings, wizardNext } from './helpers/context.js';
import { EXTENSION_TEXT, extensionZip } from './helpers/extension.js';
import { createExtensionsClient } from './api/extensions.js';

/** Card of a plugin in the plugins step of the creator. */
function pluginCard(page, name) {
    return page.locator(`${CREATOR} .mapstore-side-card`).filter({ hasText: name });
}

test.describe('Application contexts', () => {
    test.beforeEach(async({ page }) => {
        await login(page);
    });

    test('Context creator opens on the general settings step', async({ page }) => {
        await openContextCreator(page);

        for (const step of STEPS) {
            await expect(page.locator(CREATOR).getByText(step)).toBeVisible();
        }

        await expect(page.getByPlaceholder('Enter app context name...')).toBeVisible();
    });

    // Opening a context from its card is asserted by the extension test below.
    test('Admin can create a context and delete it', fromScenario('Context/CreateDelete — Create a Context', 'Context/CreateDelete — Delete a Context'), async({ page, api, data }) => {
        // A context name ends up in the URL, so it stays free of the usual separators.
        const contextName = `E2Econtext${Math.random().toString(36).slice(2, 8)}`;

        await test.step('Walk through the wizard', async() => {
            await openContextCreator(page);
            await fillGeneralSettings(page, contextName);

            for (let step = 1; step < STEPS.length; step++) {
                await wizardNext(page);
            }
        });

        await test.step('Save the context', async() => {
            await dismissTutorial(page, { timeout: 3000 });
            await page.locator(CREATOR).getByRole('button', { name: /^save$/i }).click();
            await expect(page.getByText('Saved successfully')).toBeVisible({ timeout: 20000 });
        });

        await test.step('Adopt the context, so it is removed even if a later step fails', async() => {
            const [resource] = await api.findResources('CONTEXT', contextName);
            expect(resource, `context ${contextName} not found through the API`).toBeTruthy();
            data.track({ id: resource.id, name: contextName, category: 'CONTEXT' });
        });

        await test.step('It shows on the homepage and can be deleted', async() => {
            await openAppTarget(page, '#/');
            const card = page.locator('.ms-resource-card').filter({ hasText: contextName });
            await expect(card).toBeVisible({ timeout: 15000 });
            await card.locator('.glyphicon-option-vertical').click();
            await page.getByRole('menuitem', { name: 'Delete' }).click();
            await page.getByRole('button', { name: 'Delete' }).click();
            await expect(page.locator('.ms-resource-card').filter({ hasText: contextName })).toHaveCount(0);
        });
    });

    test('An uploaded extension is used by a context and then removed', fromScenario('Context/Extension — Add an extension'), async({ page, api, data }) => {
        const suffix = Math.random().toString(36).slice(2, 8);
        const extensionName = `E2EExtension${suffix}`;
        const contextName = `E2Econtext${suffix}`;
        const extensions = await createExtensionsClient();

        try {
            await test.step('Upload the extension in the plugins step', async() => {
                await openContextCreator(page);
                await fillGeneralSettings(page, contextName);
                await wizardNext(page);
                await wizardNext(page);
                await dismissTutorial(page, { timeout: 3000 });

                await page.locator(`${CREATOR} button:has(.glyphicon-upload)`).first().click();
                const dialog = page.locator('.modal-dialog').filter({ hasText: 'Install a MapStore plugin' });
                await dialog.locator('input[type="file"]').setInputFiles(extensionZip(extensionName));
                await expect(dialog.getByText(extensionName)).toBeVisible();
                await dialog.getByRole('button', { name: 'Install' }).click();
                await expect(pluginCard(page, extensionName)).toBeVisible({ timeout: 20000 });
                // The dialog stays open after the install.
                await dialog.getByRole('button', { name: 'Close' }).click();
                expect(await extensions.list()).toContain(extensionName);
            });

            await test.step('Enable it and save the context', async() => {
                await pluginCard(page, extensionName).locator('.mapstore-side-card-title').click();
                await page.locator(CREATOR).getByRole('button', { name: '>', exact: true }).click();
                await wizardNext(page);
                await dismissTutorial(page, { timeout: 3000 });
                await page.locator(CREATOR).getByRole('button', { name: /^save$/i }).click();
                await expect(page.getByText('Saved successfully')).toBeVisible({ timeout: 20000 });
                // The creator goes back to the homepage once the context is saved.
                await expect(page).toHaveURL(/#\/$/, { timeout: 20000 });

                const [resource] = await api.findResources('CONTEXT', contextName);
                expect(resource, `context ${contextName} not found through the API`).toBeTruthy();
                data.track({ id: resource.id, name: contextName, category: 'CONTEXT' });
            });

            await test.step('The context opened from its card runs the extension', async() => {
                // Extensions are registered when the application starts: a context using
                // one installed in this session only opens after a reload.
                await page.reload();
                await ensureSignedIn(page);
                await page.getByPlaceholder('Search...').fill(contextName);
                await page.keyboard.press('Enter');
                const card = page.locator('.ms-resource-card').filter({ hasText: contextName });
                await expect(card).toBeVisible({ timeout: 15000 });
                await card.locator('a').first().click();
                await expect(page.getByText(EXTENSION_TEXT)).toBeVisible({ timeout: 30000 });
            });

            await test.step('Remove the extension from the creator', async() => {
                await openAppTarget(page, '#/');
                await openContextCreator(page);
                await fillGeneralSettings(page, `${contextName}x`);
                await wizardNext(page);
                await wizardNext(page);
                await dismissTutorial(page, { timeout: 3000 });
                await pluginCard(page, extensionName).locator('button:has(.glyphicon-trash)').click();
                const confirm = page.locator('.modal-dialog').filter({ hasText: 'Are you sure you want to remove the extension?' });
                await confirm.getByRole('button', { name: 'Yes' }).click();
                await expect(pluginCard(page, extensionName)).toHaveCount(0, { timeout: 20000 });
                expect(await extensions.list()).not.toContain(extensionName);
            });
        } finally {
            await extensions.uninstall(extensionName).catch(() => {});
            await extensions.dispose();
        }
    });
});
