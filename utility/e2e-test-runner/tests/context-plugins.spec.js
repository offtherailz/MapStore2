import { test, expect, fromScenario } from './fixtures.js';
import { hasFeature } from './config.js';
import { login, logout } from './helpers/auth.js';
import { openAppTarget } from './helpers/navigation.js';
import { contextPayload } from './helpers/content.js';

/** Opens a context and waits for its map. */
async function openContext(page, name) {
    await openAppTarget(page, `#/context/${name}`);
    await expect(page.locator('.ol-viewport, .cesium-widget').first()).toBeVisible({ timeout: 30000 });
}

async function signOut(page) {
    await openAppTarget(page, '#/');
    await logout(page);
}

const NAVBAR = { name: 'BrandNavbar', cfg: { containerPosition: 'header' } };

/** Containers of the burger menu, home and login buttons. */
const OMNIBAR = [NAVBAR, { name: 'OmniBar' }];

test.describe('Context plugins', () => {
    test.beforeEach(async({ page }) => {
        await login(page);
    });

    test('The burger menu, home and login are available in a context', fromScenario('Context/Plugins — Burger Menu (@GH-9978)'), async({ page, data }) => {
        const context = await data.context({ data: contextPayload({ plugins: [...OMNIBAR, { name: 'BurgerMenu' }, { name: 'Home' }, { name: 'Login' }, { name: 'MapCatalog' }] }) });

        await openContext(page, context.name);
        await expect(page.locator('#ms-burger-menu-container')).toBeVisible();
        await expect(page.locator('#home-button')).toBeVisible();
        await expect(page.locator('#mapstore-login-menu')).toBeVisible();
    });

    test('The brand navbar shows the language and properties buttons', fromScenario('Context/Plugins — Properties panel'), async({ page, data }) => {
        const context = await data.context({ data: contextPayload({ plugins: [NAVBAR, { name: 'Language' }, { name: 'ResourceDetails', cfg: { resourceType: 'MAP' } }] }) });

        await openContext(page, context.name);
        await expect(page.locator('.ms-brand-navbar')).toBeVisible();
        await expect(page.locator('#mapstore-langselector')).toBeVisible();
        await expect(page.locator('.ms-brand-navbar button:has(.glyphicon-details)')).toBeVisible();
    });

    test('Save as is hidden by its disablePluginIf rule to non administrators', fromScenario('Context/Plugins — SaveAs plugin (@GH-9241 @GH-9545 @GH-11641)'), async({ page, data }) => {
        const context = await data.context({ data: contextPayload({ plugins: [
            NAVBAR,
            { name: 'SaveAs', cfg: { resourceType: 'MAP', disablePluginIf: "{state('userrole') !== 'ADMIN'}" } }
        ] }) });
        await data.publish(context);
        const password = 'E2ePassword!1';
        const user = await data.user({ password });
        const saveAs = page.locator('.ms-brand-navbar button:has(.glyphicon-floppy-open)');

        await openContext(page, context.name);
        await expect(saveAs).toBeVisible();

        await signOut(page);
        await login(page, user.name, password);
        await openContext(page, context.name);
        await expect(page.locator('.ms-brand-navbar')).toBeVisible();
        await expect(saveAs).toHaveCount(0);
    });

    test('The map catalog of a context opens, edits, shares and deletes its maps', fromScenario('Context/Plugins — Map Catalog'), async({ page, data }) => {
        const context = await data.context({ data: contextPayload({ plugins: [...OMNIBAR, { name: 'BurgerMenu' }, { name: 'MapCatalog' }] }) });
        const opened = await data.map();
        const edited = await data.map();
        const renamed = `${edited.name}_renamed`;
        data.track({ id: edited.id, name: renamed, category: 'MAP' });

        async function openCatalog() {
            await openContext(page, context.name);
            // The menu keeps re-rendering while open: its item never reports as stable and a
            // click can land during a re-render, so the opening is retried.
            await expect(async() => {
                if (!await page.locator('a').filter({ hasText: 'Map Catalog' }).first().isVisible()) {
                    await page.locator('#ms-burger-menu-container').click();
                }
                await page.locator('a').filter({ hasText: 'Map Catalog' }).first().click({ force: true, timeout: 2000 });
                await expect(page.getByPlaceholder('Search maps...')).toBeVisible({ timeout: 2000 });
            }).toPass({ timeout: 20000 });
        }

        function catalogEntry(name) {
            return page.locator('.mapstore-side-card').filter({ hasText: name });
        }

        async function search(name) {
            await page.getByPlaceholder('Search maps...').fill(name);
            await expect(catalogEntry(name)).toBeVisible({ timeout: 15000 });
        }

        await test.step('Select a map: it opens in the viewer', async() => {
            await openCatalog();
            await search(opened.name);
            await catalogEntry(opened.name).locator('.mapstore-side-card-title').click();
            // A map not saved in the context opens in the default viewer.
            await expect(page).toHaveURL(new RegExp(`#/(viewer|context/${context.name})/${opened.id}`), { timeout: 20000 });
            await expect(page.locator('.ol-viewport')).toBeVisible({ timeout: 30000 });
        });

        await test.step('Rename a map from its properties', async() => {
            await openCatalog();
            await search(edited.name);
            await catalogEntry(edited.name).locator('button:has(.glyphicon-wrench)').click();
            const dialog = page.locator('[role="dialog"]').filter({ hasText: 'Edit properties' });
            await dialog.getByPlaceholder('Type a name...').fill(renamed);
            await dialog.getByRole('button', { name: 'Save' }).click();
            await expect(dialog).toHaveCount(0, { timeout: 15000 });
            await search(renamed);
        });

        await test.step('Share a map', async() => {
            await catalogEntry(renamed).locator('button:has(.glyphicon-share-alt)').click();
            const share = page.locator('[role="dialog"]').filter({ hasText: 'Share' }).last();
            await expect(share.getByRole('textbox').first()).toHaveValue(new RegExp(`/${edited.id}\\b`), { timeout: 15000 });
            await share.locator('button:has(.glyphicon-1-close)').first().click();
            await expect(share).toHaveCount(0);
        });

        await test.step('Delete a map', async() => {
            await openCatalog();
            await search(renamed);
            await catalogEntry(renamed).locator('button:has(.glyphicon-trash)').click();
            await page.getByRole('dialog').filter({ hasText: 'Are you sure you want to delete' }).getByRole('button', { name: 'Confirm' }).click();
            await expect(catalogEntry(renamed)).toHaveCount(0, { timeout: 15000 });
        });
    });

    test('The camera position is shown in 3D', fromScenario('Context/Plugins — Camera Position plugin (@GH-11387 @GH-12513)'), async({ page, data }) => {
        test.skip(!hasFeature('cesium'), 'Requires feature cesium');
        const context = await data.context({ data: contextPayload({ plugins: [
            { name: 'GlobeViewSwitcher' },
            { name: 'MousePosition', cfg: { editCRS: true, showLabels: true, showToggle: true } },
            { name: 'CameraPosition' }
        ] }) });

        await openContext(page, context.name);
        await page.locator('#globeviewswitcher-btn').click();
        await expect(page.locator('.cesium-widget canvas')).toBeVisible({ timeout: 30000 });
        const footer = page.locator('#mapstore-map-footer-container, .ms-footer, [class*="footer"]').first();
        const camera = footer.locator('button:has(.glyphicon-camera), button[class*="camera"]').first();
        await expect(camera).toBeVisible({ timeout: 15000 });
        await camera.click();
        await expect(page.getByText(/Lat|Lon|Height/i).first()).toBeVisible({ timeout: 15000 });
    });
});
