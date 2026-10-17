import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature } from './config.js';
import { login, logout } from './helpers/auth.js';
import { openAppTarget } from './helpers/navigation.js';
import { fixtureLayer, fixtureTableLayer, mapConfig, openMapViewer, openLayersDrawer, selectLayerNode, layerToolbarButton, FIXTURE_LAYER_TITLE } from './helpers/map.js';
import { saveFromViewer } from './helpers/details.js';
import { viewerContextPayload } from './helpers/content.js';

const background = () => fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined, visibility: false });

/** Map with the fixture layer inside a group. */
function groupedMap() {
    const config = mapConfig([background(), fixtureLayer({ group: 'e2e_group' })]);
    config.map.groups = [{ id: 'e2e_group', title: 'E2E group', expanded: true }];

    return config;
}

const node = (page, title = FIXTURE_LAYER_TITLE) => page.locator('.ms-node-layer').filter({ hasText: title });
const contextMenu = (page) => page.locator('.ms-context-menu').filter({ visible: true });

/** Picks an entry of the settings menu of the table of contents. */
async function tocSetting(page, entry) {
    await page.locator('.ms-toc-container button:has(.glyphicon-cog), button:has(.glyphicon-cog)').filter({ visible: true }).first().click();
    await page.getByText(entry, { exact: true }).filter({ visible: true }).click();
}

/** Picks an entry of the menu opened by a right click on the empty part of the table of contents. */
async function tocContextEntry(page, entry) {
    await page.mouse.click(150, 500, { button: 'right' });
    await contextMenu(page).getByText(entry, { exact: true }).click();
}

async function layerContextEntry(page, title, entry) {
    await node(page, title).click({ button: 'right' });
    await contextMenu(page).getByText(entry, { exact: true }).click();
}

describeIfFeature('geoserverIntegration', 'Table of contents settings', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('The settings and the context menu of the table of contents act on its nodes', fromScenario('Maps/TOC — TOC, Layers and Groups Settings popup (@GH-9982)'), async({ page, data }) => {
        const map = await data.map({ data: groupedMap() });
        const visibility = node(page).locator('.ms-visibility-check');

        await openMapViewer(page, map.id);
        await openLayersDrawer(page);

        await test.step('Opacity slider and tooltip can be hidden', async() => {
            await expect(node(page).locator('.mapstore-slider')).toHaveCount(1);
            await tocSetting(page, 'Hide opacity slider');
            await expect(node(page).locator('.mapstore-slider')).toHaveCount(0);
        });

        await test.step('All the nodes are hidden and shown', async() => {
            await tocContextEntry(page, 'Hide all child nodes');
            await expect(visibility).not.toHaveClass(/active/);
            await tocContextEntry(page, 'Show all child nodes');
            await expect(visibility).toHaveClass(/active/);
        });

        await test.step('All the groups are collapsed and expanded', async() => {
            await tocContextEntry(page, 'Collapse all child nodes');
            await expect(node(page)).toBeHidden();
            await tocContextEntry(page, 'Expand all child nodes');
            await expect(node(page)).toBeVisible();
        });

        await test.step('The table of contents opens with the map once set so', async() => {
            await tocSetting(page, 'Open on map initialization');
            await saveFromViewer(page);
            await openMapViewer(page, map.id);
            // Without clicking the drawer button the nodes are on screen.
            await expect.poll(async() => (await node(page).boundingBox())?.x ?? -1, { timeout: 15000 }).toBeGreaterThanOrEqual(0);
        });

        await test.step('A layer is removed from its context menu', async() => {
            await layerContextEntry(page, FIXTURE_LAYER_TITLE, 'Remove selected layer');
            const confirm = page.getByRole('button', { name: /^(Delete|Remove|Yes|Confirm)$/ });
            if (await confirm.last().isVisible().catch(() => false)) {
                await confirm.last().click();
            }
            await expect(node(page)).toHaveCount(0);
        });
    });

    test('A swipe set on a layer is kept by the saved map', fromScenario('Maps/TOC — Swipe Layer (@GH-11153)'), async({ page, data }) => {
        const map = await data.map({ data: groupedMap() });

        await openMapViewer(page, map.id);
        await openLayersDrawer(page);
        await layerContextEntry(page, FIXTURE_LAYER_TITLE, 'Swipe');
        const slider = page.locator('.mapstore-swipe-slider');
        await expect(slider).toBeVisible();
        const box = await slider.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 5 });
        await page.mouse.up();
        await expect.poll(async() => (await slider.boundingBox()).x).toBeGreaterThan(box.x + 60);
        await saveFromViewer(page);

        await openMapViewer(page, map.id);
        await expect(page.locator('.mapstore-swipe-slider')).toBeVisible({ timeout: 20000 });
    });

    test('A layer with special characters in its title is moved', fromScenario('Maps/TOC — Drag-and-drop layer with special characters (@GH-12240)'), async({ page, data }) => {
        const map = await data.map({ data: mapConfig([
            background(),
            fixtureLayer({ id: 'e2e_special', title: 'E2E costa)' }),
            fixtureTableLayer('e2e_events', { id: 'e2e_other', title: 'E2E other' })
        ]) });
        const titles = () => page.locator('.ms-node-layer .ms-node-title').allInnerTexts();

        await openMapViewer(page, map.id);
        await openLayersDrawer(page);
        const before = await titles();
        const moved = before[before.length - 1];
        await node(page, moved).locator('.grab-handle').dragTo(node(page, before[0]), { targetPosition: { x: 20, y: 2 } });
        await expect.poll(titles).not.toEqual(before);
        expect((await titles())[0]).toBe(moved);
    });

    test('Editing is offered only to the allowed groups', fromScenario('Maps/TOC — Include editing support to allowed user groups (@GH-9179)'), async({ page, api, data }) => {
        const group = await data.group();
        const password = 'E2ePassword!1';
        const member = await data.user({ password });
        const outsider = await data.user({ password });
        await api.addUserToGroup(member.id, group.id);
        const payload = await viewerContextPayload(page, {
            layers: [background(), fixtureTableLayer('e2e_edit')],
            // Roles and groups add up: a USER role would let every signed in user edit.
            cfg: { FeatureEditor: { editingAllowedRoles: ['ADMIN'], editingAllowedGroups: [group.groupName] } }
        });
        const context = await data.context({ data: payload });
        await data.publish(context);

        async function editButtonFor(user) {
            await logout(page);
            await login(page, user.name, password);
            await openAppTarget(page, `#/context/${context.name}`);
            await openLayersDrawer(page);
            await selectLayerNode(page, 'e2e_edit');
            await layerToolbarButton(page, 'features-grid').click();
            await expect(page.locator('#fg-search')).toBeVisible({ timeout: 30000 });

            return page.locator('#fg-edit-mode');
        }

        await expect(await editButtonFor(outsider)).toHaveCount(0);
        await expect(await editButtonFor(member)).toBeVisible();
    });
});
