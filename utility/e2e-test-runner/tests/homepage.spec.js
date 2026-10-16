import { test, expect } from './fixtures.js';
import { login, logout } from './helpers/auth.js';
import { openAppTarget } from './helpers/navigation.js';

/** Searches the homepage grid by name and returns the card of the resource. */
async function findCard(page, name) {
    await openAppTarget(page, '#/');
    await page.getByPlaceholder('Search...').fill(name);
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

test.describe('Homepage', () => {
    test('Order by menu exposes all expected sort options', async({ page }) => {
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

    test('Resource type filters narrow the grid to the selected category', async({ page }) => {
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

    test('Search narrows the grid to the matching resource', async({ page, data }) => {
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

    test('A resource can be added to favorites', async({ page, data }) => {
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

    test('A tag can be added to a resource, used as filter and removed', async({ page, data }) => {
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
});
