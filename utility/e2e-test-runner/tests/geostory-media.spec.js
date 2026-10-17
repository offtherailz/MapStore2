import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature, getServiceUrl } from './config.js';
import { login } from './helpers/auth.js';
import { fixtureLayer, mapConfig } from './helpers/map.js';
import { openGeostory, enterEditMode, addSection, saveGeostory } from './helpers/geostory.js';

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

/** Adds a layer of the catalog open in a map editor. */
async function addCatalogLayer(mapEditor, name) {
    await mapEditor.getByText(name, { exact: true })
        .locator('xpath=ancestor::*[.//button[.//*[contains(@class,"glyphicon-plus")]]][1]')
        .locator('button:has(.glyphicon-plus)').click();
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

    test('The map editor of a new story map shows its footer', fromScenario('GeoStory/Media_Content — Inline Map Editor'), async({ page, data }) => {
        await openSectionMedia(page, data);
        await mediaDialog(page).getByRole('button', { name: 'Maps' }).click();
        await mediaDialog(page).locator('button:has(.glyphicon-plus)').first().click();

        const mapEditor = page.locator('.modal-dialog').filter({ hasText: 'Map Editor' }).last();
        await expect(mapEditor.locator('.ol-viewport')).toBeVisible({ timeout: 20000 });
        await expect(mapEditor.getByRole('combobox', { name: 'Scale:' })).toBeVisible();
        await expect(mapEditor.getByText('EPSG:3857').first()).toBeVisible();
        await expect(mapEditor.getByRole('button', { name: 'Cancel' })).toBeVisible();
        await expect(mapEditor.getByRole('button', { name: 'ok' })).toBeVisible();
    });

    test('A new map is created and used as background of a section', fromScenario('GeoStory/Media_Content/Add — Add a map'), async({ page, data, api }) => {
        const story = await openSectionMedia(page, data);
        const dialog = mediaDialog(page);
        await dialog.getByRole('button', { name: 'Maps' }).click();
        await dialog.locator('button:has(.glyphicon-plus)').first().click();

        const mapEditor = page.locator('.modal-dialog').filter({ hasText: 'Map Editor' }).last();
        await mapEditor.locator('button:has(.glyphicon-folder-open)').click();
        await addCatalogLayer(mapEditor, 'e2e:e2e_points');
        await mapEditor.getByRole('button', { name: 'ok' }).click();
        await expect(mapEditor).toHaveCount(0);

        await dialog.getByPlaceholder('Enter a title').fill('E2E new story map');
        await dialog.locator('button:has(.glyphicon-floppy-disk)').click();
        await selectResource(page, 'E2E new story map');
        await dialog.getByRole('button', { name: 'Apply' }).click();
        await expect(page.locator('.ms-section .ol-viewport').first()).toBeVisible({ timeout: 30000 });
        await saveGeostory(page);

        const { resources } = await api.getData(story.id);
        const map = resources.find(({ type }) => type === 'map');
        expect(map.data.name).toBe('E2E new story map');
        expect(map.data.layers.map(({ name }) => name)).toContain('e2e:e2e_points');
    });

    test('A map of the story is edited and used as background of a section', fromScenario('GeoStory/Media_Content/Edit — Edit a map'), async({ page, data, api }) => {
        const story = await data.geostory({ data: {
            type: 'cascade',
            resources: [{ id: 'e2e_story_map', type: 'map', data: { ...mapConfig([fixtureLayer()]).map, name: 'E2E story map' } }],
            sections: []
        } });
        await openGeostory(page, story.id);
        await enterEditMode(page);
        await addSection(page, 'title');
        await sectionMediaButton(page).click();
        const dialog = mediaDialog(page);
        await dialog.getByRole('button', { name: 'Maps' }).click();
        await selectResource(page, 'E2E story map');
        await dialog.locator('.ms-media-toolbar button:has(.glyphicon-pencil)').click();
        await dialog.getByPlaceholder('Enter a description').fill('E2E edited description');
        await page.waitForTimeout(1000);
        await dialog.locator('button:has(.glyphicon-floppy-disk)').click();
        await selectResource(page, 'E2E story map');
        await dialog.getByRole('button', { name: 'Apply' }).click();
        await expect(page.locator('.ms-section .ol-viewport').first()).toBeVisible({ timeout: 30000 });
        await saveGeostory(page);

        const { resources } = await api.getData(story.id);
        expect(resources.find(({ id }) => id === 'e2e_story_map').data.description).toBe('E2E edited description');
    });

    test('The background size of title and immersive sections changes', fromScenario('GeoStory/Media_Content — Change background size for Immersive and Title sections'), async({ page, data }) => {
        const background = { type: 'image', resourceId: 'e2e_story_image', size: 'full', align: 'center', fit: 'cover' };
        const story = await data.geostory({ data: {
            type: 'cascade',
            resources: [{ id: 'e2e_story_image', type: 'image', data: { src: imageUrl(), title: 'E2E image' } }],
            sections: [
                { id: 'e2e_title', type: 'title', title: 'E2E title', contents: [{ id: 'e2e_title_text', type: 'text', html: '<h1>E2E title</h1>', background }] },
                { id: 'e2e_immersive', type: 'immersive', title: 'E2E immersive', contents: [{ id: 'e2e_column', type: 'column', background, contents: [{ id: 'e2e_column_text', type: 'text', html: '<p>E2E immersive</p>' }] }] }
            ]
        } });
        await openGeostory(page, story.id);
        await enterEditMode(page);

        for (const sectionClass of ['ms-section-title', 'ms-section-immersive']) {
            const section = page.locator(`.${sectionClass}`).first();
            await section.scrollIntoViewIfNeeded();
            const container = section.locator('.ms-section-background-container').first();
            await expect(container).toHaveClass(/ms-size-full/);
            // The background toolbar is the one editing the media; its size menu lists Small to Full.
            const toolbar = section.locator('.ms-content-toolbar').filter({ has: page.locator('.glyphicon-pencil') }).first();
            const size = toolbar.locator('.dropdown').filter({ has: page.locator('a[value="full"]') }).first();
            await size.locator('button').first().click();
            await size.getByRole('menuitem', { name: 'Medium' }).click();
            await expect(container).toHaveClass(/ms-size-medium/);
        }
    });
});
