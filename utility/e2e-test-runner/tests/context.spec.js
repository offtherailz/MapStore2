import { test, expect } from './fixtures.js';
import { login } from './helpers/auth.js';
import { openAppTarget, dismissTutorial } from './helpers/navigation.js';
import { CREATOR, STEPS, openContextCreator, fillGeneralSettings, wizardNext } from './helpers/context.js';

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

    // Opening a created context from its card is not asserted here: on a cold instance the
    // application bounces back to the homepage, and the flow needs its own investigation.
    test('Admin can create a context and delete it', async({ page, api, data }) => {
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
});
