import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { openAppTarget } from './helpers/navigation.js';
import { fixtureLayer, mapConfig, FIXTURE_LAYER_TITLE } from './helpers/map.js';
import { contextPayload } from './helpers/content.js';

/** Context offering map templates from its menu, with a TOC to see what they load. */
function templatesContext(templateIds) {
    const payload = contextPayload({ plugins: [
        { name: 'BrandNavbar', cfg: { containerPosition: 'header' } },
        { name: 'OmniBar' },
        { name: 'BurgerMenu' },
        { name: 'MapTemplates' },
        { name: 'DrawerMenu' },
        { name: 'TOC' }
    ] });
    payload.templates = templateIds.map((id) => ({ id }));

    return payload;
}

describeIfFeature('geoserverIntegration', 'Context map templates', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('A map template of the context replaces the map', fromScenario('Context/Plugins/Map_Template — Add a Map Template (@GH-11660)'), async({ page, api, data }) => {
        const template = await api.createResource({
            name: data.name('template'),
            description: 'E2E template description',
            category: 'TEMPLATE',
            data: mapConfig([fixtureLayer()])
        });
        data.track({ ...template, category: 'TEMPLATE' });
        await api.setAttribute(template.id, 'format', 'json');
        const context = await data.context({ data: templatesContext([template.id]) });

        await openAppTarget(page, `#/context/${context.name}`);
        await expect(page.locator('.ol-viewport')).toBeVisible({ timeout: 30000 });
        await expect(async() => {
            if (!await page.locator('a').filter({ hasText: 'Map Templates' }).first().isVisible()) {
                await page.locator('#ms-burger-menu-container').click();
            }
            await page.locator('a').filter({ hasText: 'Map Templates' }).first().click({ force: true, timeout: 2000 });
            await expect(page.getByText(template.name).first()).toBeVisible({ timeout: 3000 });
        }).toPass({ timeout: 20000 });

        await test.step('The template shows its description and replaces the map', async() => {
            const entry = page.locator('.mapstore-side-card').filter({ hasText: template.name });
            await expect(entry).toContainText('E2E template description');
            await entry.locator('button').filter({ hasText: /Replace/ }).or(entry.locator('button[title*="Replace"], button:has(.glyphicon-transfer)')).first().click();
            const confirm = page.getByRole('dialog').filter({ hasText: /replace/i }).getByRole('button', { name: /Replace|Confirm|Yes/ });
            if (await confirm.isVisible().catch(() => false)) {
                await confirm.click();
            }
        });

        await test.step('The layer of the template is in the TOC and the templates stay listed', async() => {
            await page.locator('button.ms-drawer-menu-button:has(.glyphicon-1-layer)').click();
            await expect(page.locator('.ms-node-layer').filter({ hasText: FIXTURE_LAYER_TITLE })).toBeVisible({ timeout: 20000 });
            await expect(page.getByText(template.name).first()).toBeVisible();
        });
    });
});
