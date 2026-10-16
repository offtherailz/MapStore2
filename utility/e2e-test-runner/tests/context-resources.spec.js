import { test, expect, fromScenario } from './fixtures.js';
import { login, logout } from './helpers/auth.js';
import { openAppTarget, dismissTutorial } from './helpers/navigation.js';
import { CREATOR, wizardNext } from './helpers/context.js';
import { contextPayload } from './helpers/content.js';
import {
    openCardDetails,
    saveDetails,
    editPermissions,
    addPermissions,
    setPermission
} from './helpers/details.js';

async function findCard(page, name) {
    await openAppTarget(page, '#/');
    await page.getByPlaceholder('Search...').first().fill(name);
    const searched = page.waitForResponse((response) => response.url().includes('extjs/search/list')
        && (response.request().postData() ?? '').includes(name));
    await page.keyboard.press('Enter');
    await searched;

    return page.locator('.ms-resource-card').filter({ hasText: name });
}

async function signOut(page) {
    await openAppTarget(page, '#/');
    await logout(page);
}

/** Opens the context creator on an existing context, from its card. */
async function editContext(page, card) {
    await card.locator(':is(button, a):has(.glyphicon-pencil)').first().click();
    await expect(page.locator(CREATOR)).toBeVisible({ timeout: 30000 });
    await dismissTutorial(page);
}

async function saveContext(page) {
    await dismissTutorial(page, { timeout: 3000 });
    await page.locator(CREATOR).getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByText('Saved successfully')).toBeVisible({ timeout: 20000 });
}

test.describe('Application context resources', () => {
    test.beforeEach(async({ page }) => {
        await login(page);
    });

    test('A view permission for everyone opens the context to anonymous visitors', fromScenario('Context/CreateDelete — Add viewing permission on context'), async({ page, data }) => {
        const context = await data.context();

        const card = await findCard(page, context.name);
        await openCardDetails(page, card);
        await editPermissions(page);
        await addPermissions(page, ['everyone']);
        await saveDetails(page);

        await signOut(page);
        const anonymousCard = await findCard(page, context.name);
        await anonymousCard.locator('a').first().click();
        await expect(page).toHaveURL(new RegExp(`#/context/${context.name}`));
        await expect(page.locator('.ol-viewport')).toBeVisible({ timeout: 30000 });
    });

    test('A group with edit permission edits the context', fromScenario('Context/CreateDelete — Add editing permission on context'), async({ page, api, data }) => {
        const context = await data.context();
        const group = await data.group();
        const password = 'E2ePassword!1';
        const member = await data.user({ password });
        await api.addUserToGroup(member.id, group.id);

        const card = await findCard(page, context.name);
        await openCardDetails(page, card);
        await editPermissions(page);
        await addPermissions(page, [group.groupName]);
        await setPermission(page, group.groupName, 'Edit');
        await saveDetails(page);

        await signOut(page);
        await login(page, member.name, password);
        const memberCard = await findCard(page, context.name);
        await editContext(page, memberCard);
        await expect(page.getByPlaceholder('Enter window title...')).toHaveValue('E2E context');
    });

    test('A context is edited and saved through the wizard', fromScenario('Context/CreateDelete — Edit Context'), async({ page, api, data }) => {
        const context = await data.context();
        const newTitle = 'E2E edited window title';

        await editContext(page, await findCard(page, context.name));
        await page.getByPlaceholder('Enter window title...').fill(newTitle);
        for (let step = 0; step < 3; step++) {
            await wizardNext(page);
            await expect(page.getByText(/error/i).filter({ hasNot: page.locator('input') })).toHaveCount(0);
        }
        await saveContext(page);

        const saved = await (await api.context.get(`data/${context.id}`)).json();
        expect(saved.windowTitle).toBe(newTitle);
    });

    test('A context exported from the creator is imported as a new one', fromScenario('Context/CreateDelete — Import/export Context (@GH-9248)'), async({ page, api, data }) => {
        const windowTitle = 'E2E exported window title';
        const source = await data.context({ data: contextPayload({ windowTitle }) });
        const importedName = `E2E_imported${Math.random().toString(36).slice(2, 8)}`;

        await test.step('Export the context', async() => {
            await editContext(page, await findCard(page, source.name));
            await page.locator(CREATOR).getByRole('button', { name: 'Export' }).click();
            // The button opens an overlay, whose own Export button writes the file.
            await expect(page.getByText('Export this context as a file')).toBeVisible();
            const download = page.waitForEvent('download');
            await page.getByRole('button', { name: 'Export' }).last().click();
            const file = await download;
            const exported = JSON.parse(await (await file.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString()));
            expect(exported.windowTitle).toBe(windowTitle);
            await file.saveAs(test.info().outputPath('context.json'));
        });

        await test.step('Import it in a new context', async() => {
            await openAppTarget(page, '#/');
            await page.getByRole('button', { name: 'Add Resource' }).click();
            await page.getByRole('menuitem', { name: 'Create context' }).click();
            await expect(page.locator(CREATOR)).toBeVisible({ timeout: 30000 });
            await dismissTutorial(page);
            // As for the export, an overlay takes the file.
            await page.locator(CREATOR).getByRole('button', { name: 'Import' }).click();
            await page.locator('input[type="file"]').last().setInputFiles(test.info().outputPath('context.json'));
            await expect(page.getByPlaceholder('Enter window title...')).toHaveValue(windowTitle, { timeout: 15000 });
            await page.getByPlaceholder('Enter app context name...').fill(importedName);
            for (let step = 0; step < 3; step++) {
                await wizardNext(page);
            }
            await saveContext(page);

            const [imported] = await api.findResources('CONTEXT', importedName);
            expect(imported, 'imported context not found through the API').toBeTruthy();
            data.track({ id: imported.id, name: importedName, category: 'CONTEXT' });
        });
    });

    test('A map of a context the visitor cannot open is flagged and not opened', fromScenario('Context/CreateDelete — Create Map Context and User permission (@GH-11140)'), async({ page, api, data }) => {
        const context = await data.context();
        const map = await data.map();
        await data.publish(map);
        await api.setAttribute(map.id, 'context', String(context.id));
        const password = 'E2ePassword!1';
        const user = await data.user({ password });

        await signOut(page);
        for (const visitor of ['anonymous', 'user']) {
            await test.step(`As ${visitor}`, async() => {
                if (visitor === 'user') {
                    await login(page, user.name, password);
                }
                const card = await findCard(page, map.name);
                await expect(card).toHaveClass(/ms-resource-issue-dependency-missing/);
                await card.locator('a').first().click();
                await expect(page.locator('.ol-viewport')).toHaveCount(0);
            });
        }
    });
});
