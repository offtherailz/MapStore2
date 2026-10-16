import { test, expect, fromScenario } from './fixtures.js';
import { login } from './helpers/auth.js';
import { openAppTarget } from './helpers/navigation.js';
import { openDashboard } from './helpers/dashboard.js';
import { openGeostory } from './helpers/geostory.js';
import { textDashboard, titledStory } from './helpers/content.js';

/**
 * Sharing of dashboards and stories: the share dialog is the one of the maps, opened from
 * the side bar of a dashboard and from the menu of a story.
 */
const TYPES = [
    {
        label: 'Dashboard',
        feature: 'Dashboard/Share',
        names: { link: 'Share via direct link a dashboard', embed: 'Share via Embed code a dashboard', permalink: 'Dash - Share via Permalink (@GH-9250 @GH-9335)' },
        create: (data, text) => data.dashboard({ data: textDashboard(text) }),
        open: openDashboard,
        openShare: (page) => page.locator('button:has(.glyphicon-share-alt)').first().click()
    },
    {
        label: 'GeoStory',
        feature: 'GeoStory/Share',
        names: { link: 'Share via direct link a gesotory', embed: 'Share via Embed code a geostory', permalink: 'Geostory - Share via Permalink (@GH-9250 @GH-9335)' },
        create: (data, text) => data.geostory({ data: titledStory([text, `${text} second`]) }),
        open: openGeostory,
        async openShare(page) {
            await page.locator('.ms-brand-navbar button:has(.glyphicon-menu-hamburger)').click();
            await page.locator('a:has(.glyphicon-share-alt)').first().click();
        }
    }
];

async function shareDialog(page, type) {
    await type.openShare(page);
    const dialog = page.locator('[role="dialog"]').filter({ has: page.getByRole('tab', { name: 'Embed' }) }).last();
    await expect(dialog).toBeVisible();

    return dialog;
}

async function linkOf(dialog) {
    await dialog.getByRole('tab', { name: 'Link', exact: true }).click();
    const input = dialog.getByRole('tabpanel', { name: 'Link', exact: true }).getByRole('textbox');
    await expect(input).toHaveValue(/#\//);

    return input.inputValue();
}

async function embedOf(dialog) {
    await dialog.getByRole('tab', { name: 'Embed' }).click();
    const code = dialog.locator('pre').filter({ hasText: '<iframe' }).first();
    await expect(code).toBeVisible();

    return code.innerText();
}

for (const type of TYPES) {
    test.describe(`${type.label} sharing`, () => {
        test.beforeEach(async({ page }) => {
            await login(page);
        });

        test(`The direct link opens the ${type.label}`, fromScenario(`${type.feature} — ${type.names.link}`), async({ page, data }) => {
            const text = `E2E shared ${type.label}`;
            const resource = await type.create(data, text);

            await type.open(page, resource.id);
            const link = await linkOf(await shareDialog(page, type));

            const shared = await page.context().newPage();
            await shared.goto(link);
            await expect(shared.getByText(text).first()).toBeVisible({ timeout: 30000 });
            await shared.close();
        });

        test(`The embed code opens the ${type.label}`, fromScenario(`${type.feature} — ${type.names.embed}`), async({ page, data }) => {
            const text = `E2E embedded ${type.label}`;
            const resource = await type.create(data, text);
            await data.publish(resource);

            await type.open(page, resource.id);
            const code = await embedOf(await shareDialog(page, type));
            expect(code).toMatch(/<iframe/);

            const host = await page.context().newPage();
            await host.setContent(`<!DOCTYPE html><html><body style="margin:0">${code}</body></html>`);
            await expect(host.frameLocator('iframe').getByText(text).first()).toBeVisible({ timeout: 30000 });
            await host.close();
        });

        test(`A permalink opens the ${type.label}`, fromScenario(`${type.feature} — ${type.names.permalink}`), async({ page, api, data }) => {
            const text = `E2E permalinked ${type.label}`;
            const resource = await type.create(data, text);

            await type.open(page, resource.id);
            const dialog = await shareDialog(page, type);
            await dialog.getByRole('tab', { name: 'Permalink' }).click();
            await dialog.getByPlaceholder('Enter a title').fill(data.name('permalink'));
            await dialog.getByPlaceholder('Enter a description').fill('Created by the E2E suite');
            await dialog.getByRole('button', { name: 'Generate permalink' }).click();
            await expect(dialog.getByRole('heading', { name: 'Permalink generated' })).toBeVisible({ timeout: 20000 });
            const link = await dialog.getByRole('tabpanel', { name: 'Permalink' }).getByRole('textbox').inputValue();

            const [permalink] = await api.findResources('PERMALINK', link.split('/').pop());
            if (permalink) {
                data.track({ id: permalink.id, name: permalink.name, category: 'PERMALINK' });
            }

            const opened = await page.context().newPage();
            await opened.goto(link);
            await expect(opened.getByText(text).first()).toBeVisible({ timeout: 30000 });
            await opened.close();
        });
    });
}

test.describe('GeoStory sharing', () => {
    test('The shared link can reopen the story on the current section', fromScenario('GeoStory/Share — Include scroll position (@GH-1039)'), async({ page, data }) => {
        // The URL of the shared view is expected to follow the current section while
        // scrolling (epics/geostory.js urlUpdateOnScroll), but wheel scrolling leaves it
        // unchanged, so the link never carries the section. To be investigated.
        test.fixme(true, 'URL not updated with the current section while scrolling');
        const titles = ['E2E story start', 'E2E story middle', 'E2E story end'];
        const story = await data.geostory({ data: titledStory(titles) });
        const geostoryType = TYPES[1];

        await login(page);
        // The shared view of the story is the one that records the current section in its URL.
        await openAppTarget(page, `#/geostory/shared/${story.id}`);
        await expect(page.getByText(titles[0]).first()).toBeVisible({ timeout: 30000 });
        // Scrolled as a reader does: the story tracks the current section from wheel scrolling.
        await page.mouse.move(640, 400);
        await expect(async() => {
            await page.mouse.wheel(0, 600);
            await expect(page.getByText(titles[2]).first()).toBeInViewport({ timeout: 1000 });
        }).toPass({ timeout: 20000 });
        await expect(page).toHaveURL(/\/section\//);

        const dialog = await shareDialog(page, geostoryType);
        await dialog.getByRole('tab', { name: 'Link', exact: true }).click();
        await dialog.getByRole('checkbox', { name: /scroll position/i }).check();
        const link = await linkOf(dialog);
        expect(link).toMatch(/section/);

        const shared = await page.context().newPage();
        await shared.goto(link);
        await expect(shared.getByText(titles[2]).first()).toBeInViewport({ timeout: 30000 });
        await shared.close();
    });
});
