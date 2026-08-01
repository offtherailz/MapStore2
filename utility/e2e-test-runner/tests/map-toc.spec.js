import { test, expect, describeIfFeature } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import {
    FIXTURE_FEATURES,
    FIXTURE_LAYER_TITLE,
    mapConfig,
    openMapViewer,
    openLayersDrawer,
    selectLayerNode,
    layerToolbarButton
} from './helpers/map.js';

/**
 * Table of contents behaviour, exercised on a map created through the API so each test
 * starts from the same layer tree.
 */
describeIfFeature('geoserverIntegration', 'Map table of contents', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('Saved map opens with its layer in the table of contents', async({ page, data }) => {
        const map = await data.map({ data: mapConfig() });

        await openMapViewer(page, map.id);
        await openLayersDrawer(page);

        const node = page.locator('.ms-node-layer').filter({ hasText: FIXTURE_LAYER_TITLE });
        await expect(node).toBeVisible();
        await expect(node).toContainText('100 %');
    });

    test('Layer visibility can be switched off and on', async({ page, data }) => {
        const map = await data.map({ data: mapConfig() });

        await openMapViewer(page, map.id);
        await openLayersDrawer(page);
        const node = await selectLayerNode(page);
        const visibility = node.locator('.ms-visibility-check');

        await expect(visibility).toHaveClass(/active/);

        await test.step('Switch the layer off', async() => {
            await visibility.click();
            await expect(visibility).not.toHaveClass(/active/);
        });

        await test.step('Switch the layer back on', async() => {
            await visibility.click();
            await expect(visibility).toHaveClass(/active/);
        });
    });

    test('Layer title can be changed from the settings panel', async({ page, data }) => {
        const map = await data.map({ data: mapConfig() });
        const newTitle = 'Fixture points renamed';

        await openMapViewer(page, map.id);
        await openLayersDrawer(page);
        await selectLayerNode(page);

        await test.step('Open the layer settings', async() => {
            await layerToolbarButton(page, 'wrench').click();
            await expect(page.locator('input.form-control').filter({ hasNot: page.locator('.searchInput') })
                .first()).toBeVisible({ timeout: 15000 });
        });

        await test.step('Replace the title and verify the table of contents follows', async() => {
            const titleInput = page.locator(`input.form-control[value="${FIXTURE_LAYER_TITLE}"]`);
            await titleInput.fill(newTitle);
            await expect(page.locator('.ms-node-layer').filter({ hasText: newTitle })).toBeVisible({ timeout: 15000 });
        });
    });

    test('Attribute table lists the features of the fixture layer', async({ page, data }) => {
        const map = await data.map({ data: mapConfig() });

        await openMapViewer(page, map.id);
        await openLayersDrawer(page);
        await selectLayerNode(page);
        await layerToolbarButton(page, 'features-grid').click();

        await test.step('Verify every fixture feature is listed once', async() => {
            const grid = page.locator('.feature-grid-container');
            await expect(grid).toBeVisible({ timeout: 30000 });
            await expect(page.locator('.react-grid-Row')).toHaveCount(FIXTURE_FEATURES.length, { timeout: 30000 });

            for (const feature of FIXTURE_FEATURES) {
                await expect(grid.getByText(feature, { exact: true })).toBeVisible();
            }
        });
    });

    test('Layer can be removed from the map', async({ page, data }) => {
        const map = await data.map({ data: mapConfig() });

        await openMapViewer(page, map.id);
        await openLayersDrawer(page);
        await selectLayerNode(page);
        await layerToolbarButton(page, 'trash').click();

        await test.step('Confirm the removal when asked', async() => {
            const confirm = page.getByRole('button', { name: /delete|remove|yes/i }).last();
            if (await confirm.isVisible().catch(() => false)) {
                await confirm.click();
            }
            await expect(page.locator('.ms-node-layer').filter({ hasText: FIXTURE_LAYER_TITLE })).toHaveCount(0);
        });
    });

    test('Layers can be filtered by title', async({ page, data }) => {
        const map = await data.map({ data: mapConfig() });

        await openMapViewer(page, map.id);
        await openLayersDrawer(page);
        const filter = page.getByPlaceholder('Filter layers');

        await test.step('A non matching filter empties the layer list', async() => {
            await filter.fill('no-such-layer');
            await expect(page.locator('.ms-node-layer').filter({ hasText: FIXTURE_LAYER_TITLE })).toHaveCount(0);
        });

        await test.step('A matching filter brings the layer back', async() => {
            await filter.fill(FIXTURE_LAYER_TITLE);
            await expect(page.locator('.ms-node-layer').filter({ hasText: FIXTURE_LAYER_TITLE })).toBeVisible();
        });
    });

    test('A layer group can be created', async({ page, data }) => {
        const map = await data.map({ data: mapConfig() });
        const groupName = 'E2E group';

        await openMapViewer(page, map.id);
        await openLayersDrawer(page);

        await test.step('Add a group through the layers toolbar', async() => {
            await page.locator('button.toc-toolbar-button:has(.glyphicon-add-folder)').click();
            await page.locator('input.form-control').last().fill(groupName);
            await page.getByRole('button', { name: 'Add' }).click();
        });

        await expect(page.locator('.ms-node').filter({ hasText: groupName }).first()).toBeVisible({ timeout: 15000 });
    });
});
