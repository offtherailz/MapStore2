import { test, expect, fromScenario } from './fixtures.js';
import { login, logout } from './helpers/auth.js';
import { openAppTarget } from './helpers/navigation.js';
import { openDashboard, addWidget, commitTextWidgetBody, saveWidget, saveDashboard } from './helpers/dashboard.js';
import { openGeostory, enterEditMode, addSection, saveGeostory } from './helpers/geostory.js';
import {
    detailsPanel,
    openViewerDetails,
    saveFromViewer,
    editPermissions,
    addPermissions,
    permissionRow,
    setPermission
} from './helpers/details.js';

/**
 * Permissions of dashboards and stories: the same properties panel as maps, opened from
 * their viewers. Each type brings how it is created, opened and edited.
 */
const TYPES = [
    {
        label: 'Dashboard',
        feature: 'Dashboard/CreateDelete',
        create: (data) => data.dashboard(),
        open: openDashboard,
        // The tools sit in the side bar, always visible.
        openTools: async() => {},
        async edit(page) {
            await addWidget(page, 'Text');
            await page.getByPlaceholder('Insert title...').fill('E2E edited by a member');
            await commitTextWidgetBody(page);
            await saveWidget(page);
            await saveDashboard(page);
        }
    },
    {
        label: 'GeoStory',
        feature: 'GeoStory/CreateDelete',
        create: (data) => data.geostory(),
        open: openGeostory,
        openTools: (page) => page.locator('.ms-brand-navbar button:has(.glyphicon-menu-hamburger)').click(),
        async edit(page) {
            await enterEditMode(page);
            await addSection(page, 'title');
            await saveGeostory(page);
        }
    }
];

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

for (const type of TYPES) {
    test.describe(`${type.label} permissions`, () => {
        test(`A view permission for everyone opens the ${type.label} to anonymous visitors`, fromScenario(`${type.feature} — Add viewing permission on ${type.label}`), async({ page, data }) => {
            const resource = await type.create(data);

            await login(page);
            await type.open(page, resource.id);
            await openViewerDetails(page);
            await editPermissions(page);
            await addPermissions(page, ['everyone']);
            await saveFromViewer(page);

            await signOut(page);
            await type.open(page, resource.id);
            await openViewerDetails(page);
            await expect(detailsPanel(page).getByRole('tab', { name: 'Permissions' })).toHaveCount(0);
        });

        test(`A group with edit permission saves the ${type.label}`, fromScenario(`${type.feature} — Add editing permission on ${type.label} (@GH-12013)`), async({ page, api, data }) => {
            const resource = await type.create(data);
            const group = await data.group();
            const password = 'E2ePassword!1';
            const member = await data.user({ password });
            await api.addUserToGroup(member.id, group.id);

            await login(page);
            await type.open(page, resource.id);
            await openViewerDetails(page);
            await editPermissions(page);
            await addPermissions(page, ['everyone']);
            await expect(permissionRow(page, 'everyone').locator('.Select')).toHaveClass(/is-disabled/);
            await permissionRow(page, 'everyone').locator('button:has(.glyphicon-trash)').click();
            await addPermissions(page, [group.groupName]);
            await setPermission(page, group.groupName, 'Edit');
            await saveFromViewer(page);

            await signOut(page);
            await login(page, member.name, password);
            await type.open(page, resource.id);
            await type.edit(page);

            await openViewerDetails(page);
            await detailsPanel(page).getByRole('tab', { name: 'Permissions' }).click();
            await expect(detailsPanel(page).getByRole('button', { name: /Add Permission/ })).toHaveCount(0);
        });

        test(`An IP range permission grants access to the ${type.label} only to matching clients`, fromScenario(`${type.feature} — ${type.label} Permissions with IP range (@GH-11332)`), async({ page, api, data }) => {
            const allowed = await type.create(data);
            const denied = await type.create(data);
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
            for (const [resource, cidr] of [[allowed, ranges.all], [denied, ranges.none]]) {
                await type.open(page, resource.id);
                await openViewerDetails(page);
                await editPermissions(page);
                await addPermissions(page, [cidr], 'IP Ranges');
                await saveFromViewer(page);
            }

            await signOut(page);
            await expect(await searchCards(page, allowed.name)).toBeVisible();
            await expect(await searchCards(page, denied.name)).toHaveCount(0);
        });

        test(`The ${type.label} viewer offers export, import, share, delete, tutorial and about`, fromScenario(`${type.feature} — Side bar buttons on ${type.label}`), async({ page, data }) => {
            const resource = await type.create(data);

            await login(page);
            await type.open(page, resource.id);
            await type.openTools(page);
            for (const glyph of ['download', 'upload', 'share-alt', 'book']) {
                await expect(page.locator(`:is(button, a):has(.glyphicon-${glyph})`).first(), glyph).toBeVisible();
            }
            await expect(page.locator('.ms-brand-navbar button:has(.glyphicon-trash)')).toBeVisible();
            await expect(page.locator('.ms-brand-navbar button:has(.glyphicon-info-sign)')).toBeVisible();
        });
    });
}
