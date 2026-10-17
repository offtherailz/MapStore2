import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature, getServiceUrl } from './config.js';
import { login } from './helpers/auth.js';
import { fixtureLayer, mapConfig } from './helpers/map.js';
import { openGeostory, enterEditMode, addSection } from './helpers/geostory.js';

// Media published in the GeoServer www folder by profiles/geoserver/seed-geoserver.sh.
const imageUrl = () => `${getServiceUrl('geoserver')}/www/e2e/e2e_image.png`;
const videoUrl = () => `${getServiceUrl('geoserver')}/www/e2e/e2e_video.mp4`;

const mediaDialog = (page) => page.locator('.modal-dialog, [role="dialog"]').filter({ hasText: 'Services:' }).last();

/** The pencil of the content toolbar of a section edits its background media. */
const sectionMediaButton = (page) => page.locator('.ms-section .ms-content-toolbar button:has(.glyphicon-pencil)').first();

/** Opens the media of the background of a new title section. */
async function openSectionMedia(page, data) {
    const story = await data.geostory();
    await openGeostory(page, story.id);
    await enterEditMode(page);
    await addSection(page, 'title');
    await sectionMediaButton(page).click();
    await expect(mediaDialog(page)).toBeVisible({ timeout: 15000 });

    return story;
}

/** Selects a resource of the media list, retrying while the list is refreshed. */
async function selectResource(page, title) {
    const card = mediaDialog(page).locator('.mapstore-side-card').filter({ hasText: title }).first();
    await expect(async() => {
        await card.click();
        await expect(card).toHaveClass(/\bselected\b/, { timeout: 2000 });
    }).toPass({ timeout: 15000 });
}

/** Adds a resource of the open tab of the media dialog and selects it. */
async function addResource(page, { source, title }) {
    const dialog = mediaDialog(page);
    await dialog.locator('button:has(.glyphicon-plus)').first().click();
    // Images take a source, videos a video URL.
    await dialog.getByPlaceholder(/^Enter a (source|video url)$/).fill(source);
    // The video form is rebuilt when its thumbnail is generated: the title is typed again until it sticks.
    const titleInput = dialog.getByPlaceholder('Enter a title');
    const save = dialog.locator('button:has(.glyphicon-floppy-disk)');
    await expect(async() => {
        await titleInput.fill(title);
        await page.waitForTimeout(500);
        await expect(titleInput).toHaveValue(title, { timeout: 1000 });
        await expect(save).toBeEnabled({ timeout: 1000 });
    }).toPass({ timeout: 15000 });
    await save.click();
    await selectResource(page, title);
}

describeIfFeature('geoserverIntegration', 'GeoStory media', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('An image is added and edited as background of a section', fromScenario(
        'GeoStory/Media_Content/Add — Add an image',
        'GeoStory/Media_Content/Edit — Edit an image'
    ), async({ page, data }) => {
        await openSectionMedia(page, data);
        await addResource(page, { source: imageUrl(), title: 'E2E image' });
        await mediaDialog(page).getByRole('button', { name: 'Apply' }).click();
        await expect(page.locator(`img[src="${imageUrl()}"]`).first()).toBeVisible({ timeout: 20000 });

        await test.step('Edit the image', async() => {
            await sectionMediaButton(page).click();
            const dialog = mediaDialog(page);
            await selectResource(page, 'E2E image');
            await dialog.locator('button:has(.glyphicon-pencil)').first().click();
            await dialog.getByPlaceholder(/description/i).fill('E2E image description');
            await dialog.locator('button:has(.glyphicon-floppy-disk)').click();
            await selectResource(page, 'E2E image');
            await dialog.getByRole('button', { name: 'Apply' }).click();
            await expect(page.locator(`img[src="${imageUrl()}"]`).first()).toBeVisible();
        });
    });

    test('A video is added and edited as background of a section', fromScenario(
        'GeoStory/Media_Content/Add — Add a video',
        'GeoStory/Media_Content/Edit — Edit a video'
    ), async({ page, data }) => {
        await openSectionMedia(page, data);
        await mediaDialog(page).getByRole('button', { name: 'Videos' }).click();
        await addResource(page, { source: videoUrl(), title: 'E2E video' });
        await mediaDialog(page).getByRole('button', { name: 'Apply' }).click();
        await expect(page.locator('.ms-section .ms-media-video').first()).toBeVisible({ timeout: 20000 });

        await test.step('Edit the video', async() => {
            await sectionMediaButton(page).click();
            const dialog = mediaDialog(page);
            await dialog.getByRole('button', { name: 'Videos' }).click();
            await selectResource(page, 'E2E video');
            await dialog.locator('button:has(.glyphicon-pencil)').first().click();
            await dialog.getByPlaceholder(/description/i).fill('E2E video description');
            await dialog.locator('button:has(.glyphicon-floppy-disk)').click();
            await selectResource(page, 'E2E video');
            await dialog.getByRole('button', { name: 'Apply' }).click();
            await expect(page.locator('.ms-section .ms-media-video').first()).toBeVisible();
        });
    });

    test('A saved map is used as background of a section', fromScenario('GeoStory/Media_Content/Add — Add a map from MapStore'), async({ page, data }) => {
        const map = await data.map({ data: mapConfig([fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined }), fixtureLayer()]) });

        await openSectionMedia(page, data);
        const dialog = mediaDialog(page);
        await dialog.getByRole('button', { name: 'Maps' }).click();
        await dialog.locator('.Select-control').filter({ hasText: 'Story Resources' }).click();
        await page.locator('.Select-option').filter({ hasText: /MapStore/ }).first().click();
        await dialog.getByText(map.name, { exact: true }).first().click();
        await dialog.getByRole('button', { name: 'Apply' }).click();
        await expect(page.locator('.ms-section .ol-viewport, [class*=section] .ol-viewport').first()).toBeVisible({ timeout: 30000 });
    });
});
