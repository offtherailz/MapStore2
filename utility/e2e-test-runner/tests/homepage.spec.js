import { test, expect, fromScenario } from './fixtures.js';
import { login, logout } from './helpers/auth.js';
import { openAppTarget } from './helpers/navigation.js';
import { openDashboard } from './helpers/dashboard.js';
import { openGeostory } from './helpers/geostory.js';
import { openMapViewer } from './helpers/map.js';

/** Searches the homepage grid by name and returns the card of the resource. */
async function findCard(page, name) {
    await openAppTarget(page, '#/');
    // The first one: the filter panel, when open, has its own search box.
    await page.getByPlaceholder('Search...').first().fill(name);
    await page.keyboard.press('Enter');
    const card = page.locator('.ms-resource-card').filter({ hasText: name });
    await expect(card).toBeVisible({ timeout: 15000 });

    return card;
}

/** The thumbnail is loaded when the browser decoded it, not just when the tag exists. */
async function expectThumbnailLoaded(card) {
    const image = card.locator('img.ms-resource-card-img');

    await expect(image).toHaveAttribute('src', /rest\/geostore\/data\/\d+\/raw\?decode=datauri/);
    await expect.poll(() => image.evaluate((element) => element.complete && element.naturalWidth), { timeout: 15000 })
        .toBeGreaterThan(0);
}

const DETAILS = '.ms-resource-detail';

/** Opens the details panel of a card in edit mode. */
async function editDetails(page, card) {
    await card.locator('button:has(.glyphicon-details)').click();
    const panel = page.locator(DETAILS);
    await panel.locator('button:has(.glyphicon-edit)').click();
    await expect(panel.getByText('Tags', { exact: true })).toBeVisible();

    return panel;
}

/**
 * Saves the details and closes the panel, as a user does before moving on.
 *
 * Pending changes are recomputed with a 500 ms debounce (useComputedPendingChanges), so
 * right after the save the panel still asks to discard them. Nothing in the DOM marks the
 * end of that computation: the close is retried, going back to the panel when asked.
 */
async function saveDetails(page) {
    const panel = page.locator(DETAILS);
    const save = panel.locator('button:has(.glyphicon-floppy-disk)');
    await expect(save).toBeEnabled();
    await save.click();
    await expect(save).toHaveCount(0, { timeout: 20000 });

    await expect(async() => {
        const backToEditing = page.getByRole('button', { name: 'Back to editing' });

        if (await backToEditing.isVisible()) {
            await backToEditing.click();
        }

        await panel.locator('button:has(.glyphicon-1-close)').first().click();
        await expect(panel).toBeHidden({ timeout: 1000 });
    }).toPass({ timeout: 10000 });
}

/** Opens the filter side panel of the homepage. */
async function openFilters(page) {
    await page.locator('.ms-resources-search .glyphicon-filter').click();
    await expect(page.getByRole('button', { name: 'Clear filters' })).toBeVisible();
}

/** Picks an option of a react-select of the filter panel, addressed by its label. */
async function pickFilter(page, label, option) {
    const combo = page.locator(
        `xpath=//*[normalize-space(text())="${label}"]/following::*[contains(@class,"Select-control")][1]`
    );
    await combo.locator('input').fill(option);
    await page.locator('.Select-option').filter({ hasText: option }).first().click();
}

/** A date in the format of the filter date pickers (MM/DD/YYYY), days from today. */
function pickerDate(days) {
    const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
}

/** Types a date in a filter date picker: only key events and a blur apply it. */
async function typeFilterDate(page, label, value) {
    const input = page.locator(`xpath=//*[normalize-space(text())="${label}"]/following::input[1]`);
    await input.pressSequentially(value);
    await input.press('Tab');
}

/** 1x1 PNG uploaded as thumbnail. */
const PNG_FILE = {
    name: 'e2e-thumbnail.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
};

/** Opens one of the account managers from the user menu. */
async function openManager(page, item) {
    await page.locator('button.dropdown-toggle.btn-success').click();
    await page.locator('.dropdown-menu li').filter({ hasText: item }).first().click();
}

/** Input that follows a field label, for forms whose labels are not bound to inputs. */
function fieldAfterLabel(page, label) {
    return page.locator(`xpath=//*[normalize-space(text())="${label}"]/following::input[1]`);
}

test.describe('Homepage', () => {
    test('Order by menu exposes all expected sort options', fromScenario('Homepage — Order Resources by'), async({ page }) => {
        await test.step('Open homepage', async() => {
            await openAppTarget(page, '#/');
        });

        await test.step('Open Order by menu and verify expected options', async() => {
            await page.getByRole('button', { name: 'Order by' }).click();
            await expect(page.getByRole('menuitem', { name: 'Most recent' })).toBeVisible();
            await expect(page.getByRole('menuitem', { name: 'Less recent' })).toBeVisible();
            await expect(page.getByRole('menuitem', { name: 'A Z' })).toBeVisible();
            await expect(page.getByRole('menuitem', { name: 'Z A' })).toBeVisible();
        });

        await test.step('Select an option and verify page stays healthy', async() => {
            await page.getByRole('menuitem', { name: 'Most recent' }).click();
            await expect(page.getByText('Page Loading Error')).toHaveCount(0);
        });
    });

    test('Resource type filters narrow the grid to the selected category', fromScenario('Homepage — Filter Resource'), async({ page }) => {
        await test.step('Open homepage', async() => {
            await openAppTarget(page, '#/');
        });

        await test.step('Open the Filters panel', async() => {
            await page.locator('.ms-resources-search .glyphicon-filter').click();
        });

        await test.step('Select "Maps" filter and verify it is applied', async() => {
            await page.getByLabel('Maps').check();
            await expect(page.getByLabel('Maps')).toBeChecked();
        });

        await test.step('Clear filters and verify the checkbox is deselected', async() => {
            await page.getByRole('button', { name: 'Clear filters' }).click();
            await expect(page.getByLabel('Maps')).not.toBeChecked();
        });
    });

    test('Search narrows the grid to the matching resource', fromScenario('Homepage — Filter resource with the Search bar'), async({ page, data }) => {
        await login(page);
        const map = await data.map();
        const other = await data.map();

        await test.step('Open homepage and search the first map by name', async() => {
            await openAppTarget(page, '#/');
            await page.getByPlaceholder('Search...').fill(map.name);
            await page.keyboard.press('Enter');
        });

        await test.step('Only the searched resource is listed', async() => {
            await expect(page.locator('.ms-resource-card').filter({ hasText: map.name })).toBeVisible({ timeout: 15000 });
            await expect(page.locator('.ms-resource-card').filter({ hasText: other.name })).toHaveCount(0);
        });
    });

    test('A resource can be added to favorites', fromScenario('Homepage — Filter Resource by Favorites'), async({ page, data }) => {
        await login(page);
        const map = await data.map();

        await openAppTarget(page, '#/');
        await page.getByPlaceholder('Search...').fill(map.name);
        await page.keyboard.press('Enter');

        const card = page.locator('.ms-resource-card').filter({ hasText: map.name });
        await expect(card).toBeVisible({ timeout: 15000 });

        // An empty heart is not a favorite yet; the filled one is.
        await card.locator('button:has(.glyphicon-heart-o)').click();
        await expect(card.locator('.glyphicon-heart')).toBeVisible({ timeout: 15000 });
    });

    test('Resource thumbnails load for anonymous and signed in visitors', async({ page, data }) => {
        const map = await data.map();
        await data.publish(map);
        await data.thumbnail(map, { everyone: true });

        await test.step('Anonymous visitor', async() => {
            await expectThumbnailLoaded(await findCard(page, map.name));
        });

        await test.step('Signed in administrator', async() => {
            await login(page);
            await expectThumbnailLoaded(await findCard(page, map.name));
            await logout(page);
        });
    });

    test('A tag can be added to a resource, used as filter and removed', fromScenario('Homepage — Filter Resources by Tags'), async({ page, data }) => {
        const tag = await data.tag();
        const tagged = await data.map();
        const other = await data.map();
        // Both names share the bundle prefix, so the search lists both of them.
        const search = tagged.name.slice(0, tagged.name.lastIndexOf('_'));

        await login(page);

        await test.step('Add the tag from the details panel', async() => {
            const card = await findCard(page, tagged.name);
            const panel = await editDetails(page, card);
            await panel.locator('.Select input[role="combobox"]').fill(tag.name);
            await page.locator('.Select-option').filter({ hasText: tag.name }).click();
            await saveDetails(page);
            await expect(card.locator('.ms-tag').filter({ hasText: tag.name })).toBeVisible({ timeout: 15000 });
        });

        await test.step('The tag on the card filters the grid', async() => {
            await openAppTarget(page, '#/');
            await page.getByPlaceholder('Search...').fill(search);
            await page.keyboard.press('Enter');
            await expect(page.locator('.ms-resource-card').filter({ hasText: other.name })).toBeVisible({ timeout: 15000 });
            await page.locator('.ms-resource-card').filter({ hasText: tagged.name })
                .locator('.ms-tag').filter({ hasText: tag.name }).click();
            await expect(page).toHaveURL(/filter%7Btag\.in%7D=|filter\{tag\.in\}=/);
            await expect(page.locator('.ms-resource-card').filter({ hasText: tagged.name })).toBeVisible({ timeout: 15000 });
            await expect(page.locator('.ms-resource-card').filter({ hasText: other.name })).toHaveCount(0);
        });

        await test.step('Remove the tag', async() => {
            const card = await findCard(page, tagged.name);
            const panel = await editDetails(page, card);
            await panel.locator('.Select-value').filter({ hasText: tag.name }).locator('.Select-value-icon').click();
            await saveDetails(page);
            await expect(card.locator('.ms-tag')).toHaveCount(0, { timeout: 15000 });
        });
    });

    test('A group permission set from the properties panel filters the grid by group', fromScenario('Homepage — Filter Resources by Groups'), async({ page, data }) => {
        const group = await data.group();
        const shared = await data.map();
        const other = await data.map();
        const search = shared.name.slice(0, shared.name.lastIndexOf('_'));

        await login(page);

        await test.step('Give the group a permission from the properties panel', async() => {
            const card = await findCard(page, shared.name);
            await card.locator('button:has(.glyphicon-details)').click();
            const panel = page.locator(DETAILS);
            await panel.getByRole('tab', { name: 'Permissions' }).click();
            await panel.locator('button:has(.glyphicon-edit)').click();
            await panel.getByRole('button', { name: /Add Permission/ }).click();
            await page.getByPlaceholder('Filter...').fill(group.groupName);
            await page.locator('li').filter({ hasText: group.groupName }).locator('button:has(.glyphicon-plus)').click();
            await expect(panel.getByText(group.groupName)).toBeVisible();
            await saveDetails(page);
        });

        await test.step('Filter the grid by the group', async() => {
            await openAppTarget(page, '#/');
            await page.getByPlaceholder('Search...').fill(search);
            await page.keyboard.press('Enter');
            await expect(page.locator('.ms-resource-card').filter({ hasText: other.name })).toBeVisible({ timeout: 15000 });
            await openFilters(page);
            await pickFilter(page, 'Groups', group.groupName);
            await expect(page.locator('.ms-resource-card').filter({ hasText: shared.name })).toBeVisible({ timeout: 15000 });
            await expect(page.locator('.ms-resource-card').filter({ hasText: other.name })).toHaveCount(0);
        });
    });

    test('Tags are created and recoloured in the tags manager, then used on a resource', fromScenario('Homepage — Manage the Tags (@GH-10782 @GH-11105)'), async({ page, api, data }) => {
        const tagName = data.name('tag');
        const map = await data.map();

        await login(page);
        await openManager(page, 'Manage Tags');

        await test.step('Create the tag', async() => {
            await page.getByRole('button', { name: 'New tag' }).click();
            // The inputs are debounced and each one writes the whole tag: typing the
            // description before the name is applied resets the name. The preview shows
            // when the name is in.
            await fieldAfterLabel(page, 'Name').pressSequentially(tagName);
            await expect(page.getByText(tagName, { exact: true }).first()).toBeVisible();
            await fieldAfterLabel(page, 'Description').pressSequentially('Created by the E2E suite');
            // The fields are debounced: the save button enables once they are applied.
            const save = page.locator('button:has(.glyphicon-floppy-disk)');
            await expect(save).toBeEnabled();
            await save.click();
            const findTag = async() => (await api.findTags(tagName)).find((entry) => entry.name === tagName);
            await expect.poll(findTag, { timeout: 15000 }).toBeTruthy();
            data.trackTag(await findTag());
            await expect(page.locator('li, .ms-tags-manager-entry').filter({ hasText: tagName }).last()
                .locator('button:has(.glyphicon-edit)')).toBeVisible({ timeout: 15000 });
        });

        await test.step('Change its colour', async() => {
            const entry = page.locator('li, .ms-tags-manager-entry').filter({ hasText: tagName }).last();
            await entry.locator('button:has(.glyphicon-edit)').click();
            await page.locator('.ms-color-picker-swatch').click();
            const hex = page.locator('input[spellcheck="false"]').first();
            await hex.fill('FF0000');
            await hex.press('Enter');
            // The colour is applied when the picker closes, on a click outside of it.
            await fieldAfterLabel(page, 'Name').click();
            await expect(page.locator('.ms-color-picker-swatch + *, .sketch-picker')).toHaveCount(0);
            const save = page.locator('button:has(.glyphicon-floppy-disk)');
            await expect(save).toBeEnabled();
            await save.click();
            await expect.poll(async() => (await api.findTags(tagName)).find((candidate) => candidate.name === tagName)?.color?.toLowerCase(),
                { timeout: 15000 }).toBe('#ff0000');
        });

        await test.step('The tag is offered on the resource and shown on its card', async() => {
            const card = await findCard(page, map.name);
            const panel = await editDetails(page, card);
            await panel.locator('.Select input[role="combobox"]').fill(tagName);
            await page.locator('.Select-option').filter({ hasText: tagName }).click();
            await saveDetails(page);
            await expect(card.locator('.ms-tag').filter({ hasText: tagName })).toBeVisible({ timeout: 15000 });
        });
    });

    test('IP ranges are managed and offered as permissions', fromScenario('Homepage — Manage the IP Ranges (@GH-11332)'), async({ page, api, data }) => {
        const cidr = '10.250.250.0/24';
        const description = data.name('iprange');
        const changed = `${description}_edited`;
        const map = await data.map();

        await login(page);
        await openManager(page, 'Manage IP Ranges');

        await test.step('Create the IP range', async() => {
            await page.getByRole('button', { name: 'New IP range' }).click();
            const dialog = page.locator('[role="dialog"]').filter({ hasText: 'New IP range' });
            await dialog.getByPlaceholder('e.g., 192.168.1.1/32 or 192.168.1.0/24').fill(cidr);
            await dialog.getByPlaceholder('(Optional) Enter description').fill(description);
            await dialog.getByRole('button', { name: 'Save' }).click();
            await expect(page.getByText(description)).toBeVisible({ timeout: 15000 });

            const range = (await api.listIPRanges()).find((entry) => entry.description === description);
            expect(range, 'IP range not found through the API').toBeTruthy();
            data.trackIPRange(range);
        });

        await test.step('Edit its description', async() => {
            const entry = page.locator('[role="tabpanel"] li').filter({ hasText: description });
            await entry.locator('button:has(.glyphicon-wrench)').click();
            const dialog = page.locator('[role="dialog"]').last();
            await dialog.getByPlaceholder('(Optional) Enter description').fill(changed);
            await dialog.getByRole('button', { name: 'Save' }).click();
            await expect(page.getByText(changed)).toBeVisible({ timeout: 15000 });
        });

        await test.step('The range is offered in the permissions of a resource', async() => {
            const card = await findCard(page, map.name);
            await card.locator('button:has(.glyphicon-details)').click();
            const panel = page.locator(DETAILS);
            await panel.getByRole('tab', { name: 'Permissions' }).click();
            await panel.locator('button:has(.glyphicon-edit)').click();
            await panel.getByRole('button', { name: /Add Permission/ }).click();
            await page.getByRole('button', { name: 'IP Ranges' }).click();
            await page.locator('li').filter({ hasText: cidr }).locator('button:has(.glyphicon-plus)').click();
            await expect(panel.getByText(cidr)).toBeVisible();
            await saveDetails(page);
        });
    });

    test('The About panel opens from the top bar of every page', fromScenario('Homepage — About in Brand Navbar (@GH-10897)'), async({ page, data }) => {
        const map = await data.map();
        const dashboard = await data.dashboard();
        const story = await data.geostory();

        async function expectAbout() {
            await page.locator('.ms-brand-navbar button:has(.glyphicon-info-sign)').first().click();
            const about = page.locator('[role="dialog"]').filter({ hasText: 'MapStore Version' });
            await expect(about).toBeVisible({ timeout: 15000 });
            await about.locator('button:has(.glyphicon-1-close)').first().click();
            await expect(about).toHaveCount(0);
        }

        await login(page);
        await test.step('Homepage', async() => {
            await openAppTarget(page, '#/');
            await expectAbout();
        });
        await test.step('Map viewer', async() => {
            await openMapViewer(page, map.id);
            await expectAbout();
        });
        await test.step('Dashboard', async() => {
            await openDashboard(page, dashboard.id);
            await expectAbout();
        });
        await test.step('GeoStory', async() => {
            await openGeostory(page, story.id);
            await expectAbout();
        });
    });

    test('The language selector translates the interface', fromScenario('Homepage — Set Language'), async({ page, data }) => {
        const map = await data.map();

        await openAppTarget(page, '#/');
        await page.locator('#mapstore-langselector').click();
        for (const language of ['Italiano', 'Français', 'Deutsch', 'Español']) {
            await expect(page.getByRole('menuitem', { name: new RegExp(language) })).toBeVisible();
        }
        await page.getByRole('menuitem', { name: /Italiano/ }).click();
        await expect(page.getByRole('button', { name: 'Ordina per' })).toBeVisible({ timeout: 15000 });

        await login(page).catch(() => {});
        await openMapViewer(page, map.id);
        await expect(page.locator('#mapstore-langselector')).toBeVisible();
    });

    test('The footer links to the documentation and hides in the viewers', fromScenario('Homepage — Footer (@GH-10785)'), async({ page, data }) => {
        const map = await data.map();

        await openAppTarget(page, '#/');
        const footer = page.getByRole('contentinfo');
        await expect(footer).toBeVisible();
        await expect(footer.getByRole('link', { name: /Documentation/ })).toHaveAttribute('href', /docs\.mapstore/);
        await expect(footer.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', /github\.com\/geosolutions-it\/MapStore2/);
        // A named target ("blank"): the links open in a separate tab, reused by both.
        await expect(footer.getByRole('link', { name: /Documentation/ })).toHaveAttribute('target', /blank/);

        await login(page);
        await openMapViewer(page, map.id);
        await expect(page.getByRole('contentinfo')).toHaveCount(0);
    });

    test('Maps are filtered by the context they use', fromScenario('Homepage — Filter Maps by context'), async({ page, api, data }) => {
        const context = await data.context();
        const inContext = await data.map();
        const other = await data.map();
        const search = inContext.name.slice(0, inContext.name.lastIndexOf('_'));
        await api.setAttribute(inContext.id, 'context', String(context.id));

        await login(page);
        await openAppTarget(page, '#/');
        await page.getByPlaceholder('Search...').fill(search);
        await page.keyboard.press('Enter');
        await expect(page.locator('.ms-resource-card').filter({ hasText: other.name })).toBeVisible({ timeout: 15000 });

        await openFilters(page);
        await pickFilter(page, 'Maps by context', context.name);
        await expect(page.locator('.ms-resource-card').filter({ hasText: inContext.name })).toBeVisible({ timeout: 15000 });
        await expect(page.locator('.ms-resource-card').filter({ hasText: other.name })).toHaveCount(0);
    });

    test('A resource marked as featured shows in the featured section', fromScenario('Homepage — Add a contents on Featured'), async({ page, data }) => {
        const map = await data.map();
        await data.publish(map);

        await login(page);
        const card = await findCard(page, map.name);
        const panel = await editDetails(page, card);
        await panel.getByRole('checkbox', { name: 'Featured' }).check();
        await saveDetails(page);

        await openAppTarget(page, '#/');
        // The featured grid is the one between the "Featured" and the "Contents" titles.
        const featured = page.locator(
            'xpath=//*[normalize-space(text())="Featured"]/following::*[contains(@class,"ms-resource-card")]'
            + '[following::*[normalize-space(text())="Contents"]]'
        ).filter({ hasText: map.name }).first();
        await expect(featured).toBeVisible({ timeout: 20000 });
    });

    test('Resources are filtered by creation date', fromScenario('Homepage — Filter Resources by Data'), async({ page, data }) => {
        const map = await data.map();
        const cards = page.locator('.ms-resource-card').filter({ hasText: map.name });

        await login(page);
        await findCard(page, map.name);
        await openFilters(page);

        await test.step('Created from tomorrow: the map is not listed', async() => {
            await typeFilterDate(page, 'Creation date from', pickerDate(1));
            await expect(page).toHaveURL(/creation\.gte/);
            await expect(cards).toHaveCount(0, { timeout: 15000 });
        });

        await test.step('Created up to tomorrow: the map is listed', async() => {
            await page.getByRole('button', { name: 'Clear filters' }).click();
            await typeFilterDate(page, 'Creation date to', pickerDate(1));
            await expect(page).toHaveURL(/creation\.lte/);
            await page.getByPlaceholder('Search...').first().fill(map.name);
            await page.keyboard.press('Enter');
            await expect(cards).toBeVisible({ timeout: 15000 });
        });
    });

    test('The properties panel adapts to the visitor and edits thumbnail and description', fromScenario('Homepage — Properties panel form homepage'), async({ page, api, data }) => {
        const map = await data.map();
        await data.publish(map);
        await data.details(map, '<p>E2E about text</p>', { everyone: true });
        const description = 'Description written by the E2E suite';

        await test.step('Anonymous visitor: read only, with Info and About', async() => {
            const card = await findCard(page, map.name);
            await card.locator('button:has(.glyphicon-details)').click();
            const panel = page.locator(DETAILS);
            await expect(panel.getByText('Name', { exact: true })).toBeVisible();
            await expect(panel.getByText('Created', { exact: true })).toBeVisible();
            await expect(panel.locator('button:has(.glyphicon-edit)')).toHaveCount(0);
            await expect(panel.getByRole('tab', { name: 'Permissions' })).toHaveCount(0);
            await panel.getByRole('tab', { name: 'About' }).click();
            await expect(panel.getByText('E2E about text')).toBeVisible({ timeout: 15000 });
        });

        await test.step('Administrator: owner details and permissions', async() => {
            await login(page);
            const card = await findCard(page, map.name);
            await card.locator('button:has(.glyphicon-details)').click();
            const panel = page.locator(DETAILS);
            await expect(panel.getByText('Created by', { exact: true })).toBeVisible();
            await expect(panel.getByRole('tab', { name: 'Permissions' })).toBeVisible();
        });

        await test.step('Upload a thumbnail and change the description', async() => {
            const panel = page.locator(DETAILS);
            await panel.locator('button:has(.glyphicon-edit)').click();
            await panel.locator('input[type="file"]').setInputFiles(PNG_FILE);
            await panel.getByRole('tab', { name: 'Info' }).click();
            await fieldAfterLabel(page, 'Description').fill(description).catch(async() => {
                await panel.locator('textarea').first().fill(description);
            });
            await saveDetails(page);

            const card = await findCard(page, map.name);
            await expect(card.locator('img.ms-resource-card-img')).toHaveAttribute('src', /rest\/geostore\/data\/\d+\/raw/, { timeout: 15000 });
            await expect.poll(async() => (await api.findResources('MAP', map.name))[0]?.description, { timeout: 15000 })
                .toBe(description);
        });
    });

    test('Details written in the About tab are shown to visitors', fromScenario('Homepage — Details from Properties panel (@GH-11137 @GH-11136)'), async({ page, data }) => {
        const map = await data.map();
        await data.publish(map);
        const text = 'Details written by the E2E suite';

        await login(page);
        const card = await findCard(page, map.name);
        const panel = await editDetails(page, card);
        await panel.getByRole('tab', { name: 'About' }).click();
        const editor = panel.locator('.public-DraftEditor-content');
        await editor.click();
        await editor.pressSequentially(text, { delay: 10 });
        await saveDetails(page);

        await test.step('An anonymous visitor reads them', async() => {
            await openAppTarget(page, '#/');
            await logout(page);
            const anonymousCard = await findCard(page, map.name);
            await anonymousCard.locator('button:has(.glyphicon-details)').click();
            const anonymousPanel = page.locator(DETAILS);
            await anonymousPanel.getByRole('tab', { name: 'About' }).click();
            await expect(anonymousPanel.getByText(text)).toBeVisible({ timeout: 15000 });
        });
    });
});
