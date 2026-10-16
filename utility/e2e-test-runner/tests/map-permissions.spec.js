import { test, expect, fromScenario } from './fixtures.js';
import { createGeoStoreClient } from './api/geostore.js';
import { login, logout } from './helpers/auth.js';
import { openAppTarget } from './helpers/navigation.js';
import { openMapViewer } from './helpers/map.js';
import {
    detailsPanel,
    openViewerDetails,
    editOpenDetails,
    saveFromViewer,
    editPermissions,
    addPermissions,
    permissionRow,
    setPermission
} from './helpers/details.js';

/** Top bar buttons of the map viewer, identified by their glyph. */
const TOOLBAR = {
    save: '.ms-brand-navbar button:has(.glyphicon-floppy-disk)',
    saveAs: '.ms-brand-navbar button:has(.glyphicon-floppy-open)',
    remove: '.ms-brand-navbar button:has(.glyphicon-trash)'
};

/** Searches the homepage and tells whether the resource is listed. */
async function searchCards(page, name) {
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

test.describe('Map permissions', () => {
    test('A view permission for everyone opens the map to anonymous visitors', fromScenario('Maps/CreateDelete — Add viewing permission'), async({ page, data }) => {
        const map = await data.map();

        await login(page);
        await openMapViewer(page, map.id);
        await openViewerDetails(page);
        await editPermissions(page);
        await addPermissions(page, ['everyone']);
        await saveFromViewer(page);

        await signOut(page);
        await openMapViewer(page, map.id);
        await openViewerDetails(page);
        await expect(detailsPanel(page).getByRole('tab', { name: 'Permissions' })).toHaveCount(0);
    });

    test('A group with edit permission saves the map but cannot change permissions', fromScenario('Maps/CreateDelete — Add editing permission (@GH-11146 @GH-11404 @GH-12013)'), async({ page, api, data }) => {
        const map = await data.map();
        const group = await data.group();
        const password = 'E2ePassword!1';
        const editor = await data.user({ password });
        await api.addUserToGroup(editor.id, group.id);

        await test.step('Everyone can only view; a group gets the edit permission', async() => {
            await login(page);
            await openMapViewer(page, map.id);
            await openViewerDetails(page);
            await editPermissions(page);
            await addPermissions(page, ['everyone']);
            await expect(permissionRow(page, 'everyone').locator('.Select')).toHaveClass(/is-disabled/);
            await permissionRow(page, 'everyone').locator('button:has(.glyphicon-trash)').click();
            await expect(permissionRow(page, 'everyone')).toHaveCount(0);
            await addPermissions(page, [group.groupName]);
            await setPermission(page, group.groupName, 'Edit');
            await saveFromViewer(page);
        });

        await test.step('A member of the group saves a change to the map', async() => {
            await signOut(page);
            await login(page, editor.name, password);
            await openMapViewer(page, map.id);
            await page.locator('button:has(.glyphicon-plus)').first().click();
            await page.locator(TOOLBAR.save).click();
            await expect(page.getByText('Saved successfully')).toBeVisible({ timeout: 20000 });
        });

        await test.step('The member does not edit the permissions', async() => {
            await openViewerDetails(page);
            await detailsPanel(page).getByRole('tab', { name: 'Permissions' }).click();
            await expect(detailsPanel(page).locator('.ms-permissions-row').filter({ hasText: group.groupName })).toBeVisible();
            await expect(detailsPanel(page).getByRole('button', { name: /Add Permission/ })).toHaveCount(0);
        });
    });

    test('An unadvertised map is not listed, even when shared', fromScenario('Maps/CreateDelete — Unadvertised map (@GH-9583)'), async({ page, data }) => {
        const map = await data.map();
        const password = 'E2ePassword!1';
        const other = await data.user({ password });

        await login(page);
        await openMapViewer(page, map.id);
        await openViewerDetails(page);
        const panel = await editOpenDetails(page);
        await panel.getByRole('checkbox', { name: 'Advertised' }).uncheck();
        await panel.getByRole('tab', { name: 'Permissions' }).click();
        await addPermissions(page, ['everyone']);
        await saveFromViewer(page);

        await signOut(page);
        await expect(await searchCards(page, map.name)).toHaveCount(0);
        await login(page, other.name, password);
        await expect(await searchCards(page, map.name)).toHaveCount(0);
        // Not listed, but still readable with its link.
        await openMapViewer(page, map.id);
    });

    test('A standard user with view permission cannot save, delete or edit permissions', fromScenario(
        'Maps/CreateDelete — Save as for normal user with view permission',
        'Maps/CreateDelete — Permissions panel and Nav bar for Normal user (@GH-11459 @GH-11436)'
    ), async({ page, data }) => {
        const map = await data.map();
        await data.publish(map);
        await data.details(map, '<p>E2E about text</p>', { everyone: true });
        const password = 'E2ePassword!1';
        const viewer = await data.user({ password });

        await login(page, viewer.name, password);
        await openMapViewer(page, map.id);
        // Save as stays: GeoStore lets any signed in reader copy the resource (canCopy).
        await expect(page.locator(TOOLBAR.save)).toHaveCount(0);
        await expect(page.locator(TOOLBAR.remove)).toHaveCount(0);

        await openViewerDetails(page);
        await expect(detailsPanel(page).getByRole('tab', { name: 'Info' })).toBeVisible();
        await expect(detailsPanel(page).getByRole('tab', { name: 'About' })).toBeVisible();
        await expect(detailsPanel(page).getByRole('tab', { name: 'Permissions' })).toHaveCount(0);
    });

    test('A standard user shares its own map with everyone', fromScenario('Maps/CreateDelete — Permissions panel and Nav bar for Normal user (@GH-11459 @GH-11436)'), async({ page, data }) => {
        const password = 'E2ePassword!1';
        const owner = await data.user({ password });
        // The map belongs to the standard user, so it is created with its credentials.
        const ownerApi = await createGeoStoreClient({ username: owner.name, password });
        const map = await ownerApi.createResource({ name: data.name('map'), category: 'MAP', data: { version: 2, map: { center: { x: 11, y: 43, crs: 'EPSG:4326' }, zoom: 5, layers: [] } } });
        data.track(map);
        await ownerApi.dispose();

        await login(page, owner.name, password);
        await openMapViewer(page, map.id);
        await openViewerDetails(page);
        await editPermissions(page);
        await addPermissions(page, ['everyone']);
        await saveFromViewer(page);

        await openViewerDetails(page);
        await detailsPanel(page).getByRole('tab', { name: 'Permissions' }).click();
        await expect(detailsPanel(page).locator('.ms-permissions-row').filter({ hasText: 'everyone' })).toBeVisible();
    });

    test('Anonymous visitors see neither editing tools nor permissions', fromScenario('Maps/CreateDelete — Permissions panel and Nava bar for anonymous user (@GH-11459)'), async({ page, data }) => {
        const map = await data.map();
        await data.publish(map);

        await openMapViewer(page, map.id);
        await expect(page.locator(TOOLBAR.saveAs)).toHaveCount(0);
        await expect(page.locator(TOOLBAR.save)).toHaveCount(0);
        await expect(page.locator(TOOLBAR.remove)).toHaveCount(0);
        await openViewerDetails(page);
        await expect(detailsPanel(page).getByRole('tab', { name: 'Permissions' })).toHaveCount(0);
        await expect(detailsPanel(page).locator('button:has(.glyphicon-edit)')).toHaveCount(0);
    });

    test('An IP range permission grants access only to matching clients', fromScenario('Maps/CreateDelete — Map Permissions with IP range (@GH-11332)'), async({ page, api, data }) => {
        const allowed = await data.map();
        const denied = await data.map();
        const ranges = { all: '0.0.0.0/0', none: '10.250.250.0/24' };

        for (const [key, cidr] of Object.entries(ranges)) {
            const response = await api.context.post('ipranges/', {
                headers: { 'Content-Type': 'application/xml' },
                data: `<IPRange><cidr>${cidr}</cidr><description>${data.name(`range_${key}`)}</description></IPRange>`
            });
            expect(response.ok()).toBe(true);
            data.trackIPRange({ id: Number(await response.text()) });
        }

        await login(page);
        for (const [map, cidr] of [[allowed, ranges.all], [denied, ranges.none]]) {
            await openMapViewer(page, map.id);
            await openViewerDetails(page);
            await editPermissions(page);
            await addPermissions(page, [cidr], 'IP Ranges');
            await saveFromViewer(page);
        }

        await signOut(page);
        await expect(await searchCards(page, allowed.name)).toBeVisible();
        await expect(await searchCards(page, denied.name)).toHaveCount(0);
    });
});
