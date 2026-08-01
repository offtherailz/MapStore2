import { test, expect } from './fixtures.js';
import { login } from './helpers/auth.js';
import { openAppTarget, dismissTutorial } from './helpers/navigation.js';
import { openGeostory, enterEditMode, addSection, saveGeostory } from './helpers/geostory.js';

test.describe('GeoStory', () => {
    test.beforeEach(async({ page }) => {
        await login(page);
    });

    test('Saved geostory opens on its empty state', async({ page, data }) => {
        const story = await data.geostory();

        await openGeostory(page, story.id);

        await expect(page.getByText(story.name)).toBeVisible();
        await expect(page.getByText('This story is empty')).toBeVisible();
    });

    test('Title section can be added and survives a reload', async({ page, data }) => {
        const story = await data.geostory();
        const sectionTitle = 'E2E story section';

        await openGeostory(page, story.id);
        await enterEditMode(page);

        await test.step('Add a title section and write into it', async() => {
            await addSection(page, 'title');

            const editor = page.locator('[contenteditable="true"]').first();
            await expect(editor).toBeVisible({ timeout: 15000 });
            await editor.click();
            await page.keyboard.press('ControlOrMeta+a');
            await editor.pressSequentially(sectionTitle, { delay: 20 });
            await expect(editor).toContainText(sectionTitle);
        });

        await test.step('Save the story and reload it', async() => {
            await saveGeostory(page);
            await openGeostory(page, story.id);
            await expect(page.getByText(sectionTitle)).toBeVisible({ timeout: 20000 });
        });
    });

    test('Admin can create and delete a geostory from the homepage', async({ page, api, data }) => {
        const storyName = data.name('geostory');

        await test.step('Create a geostory', async() => {
            await page.getByRole('button', { name: 'Add Resource' }).click();
            await page.getByRole('menuitem', { name: 'Create geostory' }).click();
            await expect(page.locator('.ms-brand-navbar')).toBeVisible({ timeout: 30000 });
            await dismissTutorial(page);
        });

        await test.step('Save it under a unique name', async() => {
            await page.locator('.ms-brand-navbar button:has(.glyphicon-floppy-open), '
                + '.ms-brand-navbar button:has(.glyphicon-floppy-disk)').first().click();
            await page.getByRole('textbox').fill(storyName);
            await page.getByRole('button', { name: /^(create|save)$/i }).click();
            await expect(page).toHaveURL(/#\/geostory\/\d+/, { timeout: 20000 });
        });

        await test.step('Adopt the story, so it is removed even if a later step fails', async() => {
            const [resource] = await api.findResources('GEOSTORY', storyName);
            expect(resource, `geostory ${storyName} not found through the API`).toBeTruthy();
            data.track({ id: resource.id, name: storyName, category: 'GEOSTORY' });
        });

        await test.step('It shows on the homepage and can be deleted', async() => {
            await openAppTarget(page, '#/');
            const card = page.locator('.ms-resource-card').filter({ hasText: storyName });
            await expect(card).toBeVisible({ timeout: 15000 });
            await card.locator('.glyphicon-option-vertical').click();
            await page.getByRole('menuitem', { name: 'Delete' }).click();
            await page.getByRole('button', { name: 'Delete' }).click();
            await expect(page.locator('.ms-resource-card').filter({ hasText: storyName })).toHaveCount(0);
        });
    });

    test('Paragraph section can be added', async({ page, data }) => {
        const story = await data.geostory();

        await openGeostory(page, story.id);
        await enterEditMode(page);
        await addSection(page, 'paragraph');

        await expect(page.getByText('Paragraph Section')).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('Insert text here...')).toBeVisible();
    });

    test('Section content can be removed', async({ page, data }) => {
        const story = await data.geostory();

        await openGeostory(page, story.id);
        await enterEditMode(page);
        await addSection(page, 'title');
        await expect(page.getByText('Title Section')).toBeVisible({ timeout: 15000 });

        await test.step('Remove the content of the section and confirm', async() => {
            await expect(page.locator('[contenteditable="true"]')).toHaveCount(1);

            // The section toolbar sits at the right edge of the content, and its trash
            // removes the content block, not the section itself.
            await page.getByText('Title Section').hover();
            await page.locator('button.square-button.no-border:has(.glyphicon-trash)').first().click();
            await expect(page.getByText('Do you want to remove this content from the story?')).toBeVisible();
            await page.getByRole('button', { name: 'Yes' }).click();

            await expect(page.locator('[contenteditable="true"]')).toHaveCount(0, { timeout: 15000 });
        });
    });
});
