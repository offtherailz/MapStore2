import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { fixtureLayer } from './helpers/map.js';
import { openGeostory, enterEditMode, saveGeostory } from './helpers/geostory.js';
import { mapPixels } from './helpers/pixels.js';
import { authorizeGeoServerRest } from './api/geoserver.js';

const RED = '#ff0000';
/** Colours of the categories in the e2e:e2e_points_by_category style. */
const CAPITAL = '#d7191c';
const CITY = '#2b83ba';

const background = () => fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined, visibility: false });
const cities = (overrides) => fixtureLayer({ id: 'e2e_cities', title: 'E2E cities', ...overrides });

function mapResource(id, layers, center = { x: 12.5, y: 41.9 }) {
    return {
        id,
        type: 'map',
        data: { projection: 'EPSG:900913', center: { ...center, crs: 'EPSG:4326' }, zoom: 6, layers: [background(), ...layers] }
    };
}

/** Title section whose background is a map of the story resources. */
function mapSection(index, resourceId) {
    return {
        id: `e2e_section_${index}`,
        type: 'title',
        title: `E2E map section ${index}`,
        contents: [{
            id: `e2e_content_${index}`,
            type: 'text',
            html: `<h1>E2E map section ${index}</h1>`,
            size: 'small',
            // The title stays aside, so that the centre of the map is free.
            align: 'left',
            theme: 'bright',
            background: { type: 'map', resourceId, size: 'full', align: 'center', theme: 'bright', map: {} }
        }]
    };
}

/** Creates a story with a map background section for each layer list. */
async function mapStory(data, ...layerLists) {
    const resources = layerLists.map((layers, index) => mapResource(`e2e_map_${index}`, layers));

    return data.geostory({ data: {
        type: 'cascade',
        resources,
        sections: resources.map(({ id }, index) => mapSection(index, id))
    } });
}

/** Story whose map has a group with the cities, styled by category, and another layer. */
function groupStory(data) {
    return data.geostory({ data: {
        type: 'cascade',
        resources: [{
            id: 'e2e_map_0',
            type: 'map',
            data: {
                projection: 'EPSG:900913',
                center: { x: 12.5, y: 41.9, crs: 'EPSG:4326' },
                zoom: 6,
                groups: [{ id: 'e2e_group', title: 'E2E group', expanded: true }],
                layers: [
                    background(),
                    fixtureLayer({ id: 'e2e_other', title: 'E2E other', group: 'e2e_group', name: 'e2e:e2e_events' }),
                    cities({ group: 'e2e_group', style: 'e2e:e2e_points_by_category' })
                ]
            }
        }],
        sections: [mapSection(0, 'e2e_map_0')]
    } });
}

const editor = (page) => page.locator('.ms-geostory-map-editor');
const editorToolbar = (page, glyph) => editor(page).locator(`.ms-geostory-map-editor-toolbar button:has(.glyphicon-${glyph})`);
const tocNode = (page, title) => editor(page).locator('.ms-node-layer').filter({ hasText: title }).first();
const sectionMap = (page) => page.locator('.ms-section .ol-viewport').first();

/** Opens the map configuration of the background of the first section. */
async function configureMap(page) {
    await page.locator('button:has(.glyphicon-map-edit)').first().click();
    await expect(editor(page)).toBeVisible();
}

async function closeMapConfiguration(page) {
    await editor(page).locator('.on-close-btn').click();
    await expect(editor(page)).toHaveCount(0);
}

async function editorTab(page, glyph) {
    await editor(page).locator(`.nav-tabs a:has(.glyphicon-${glyph})`).click();
}

/** Opens the settings of a layer of the map configuration on one of its tabs. */
async function layerSettings(page, title, tabGlyph) {
    await tocNode(page, title).locator('.ms-node-title').click();
    await editorToolbar(page, 'wrench').click();
    await page.locator(`a:has(.glyphicon-${tabGlyph})`).filter({ visible: true }).last().click();
}

async function openStory(page, story) {
    await openGeostory(page, story.id);
    await enterEditMode(page);
    await expect(sectionMap(page)).toBeVisible({ timeout: 30000 });
}

/** Clicks the centre of the map of the first section, where Rome is. */
async function clickMapCenter(page) {
    const box = await sectionMap(page).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function storyData(api, story) {
    return api.getData(story.id);
}

/** A layer of the map of the first section, as saved with the changes of the section. */
async function sectionMapLayer(api, story, layerId) {
    const { sections } = await storyData(api, story);

    return sections[0].contents[0].background.map.layers.find(({ id }) => id === layerId);
}

describeIfFeature('geoserverIntegration', 'GeoStory map configuration', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('Identify is enabled on a story map', fromScenario('GeoStory/Media_Content/Edit/Edit_map_content — Add Identify'), async({ page, data }) => {
        const story = await mapStory(data, [cities()]);

        await openStory(page, story);
        await configureMap(page);
        await editorTab(page, 'wrench');
        const identify = editor(page).getByText('Identify', { exact: true }).locator('xpath=following::input[@type="checkbox"][1]');
        await identify.evaluate((input) => input.click());
        await expect(identify).toBeChecked();
        await closeMapConfiguration(page);
        await saveGeostory(page);

        await clickMapCenter(page);
        await expect(page.getByText('Roma').first()).toBeVisible({ timeout: 20000 });
    });

    test('A layer of a story map is hidden', fromScenario('GeoStory/Media_Content/Edit/Edit_map_content — Enable/disable layers'), async({ page, data, api }) => {
        const story = await mapStory(data, [cities()]);

        await openStory(page, story);
        await expect.poll(() => mapPixels(page, RED), { timeout: 20000 }).toBeGreaterThan(20);
        await configureMap(page);
        await tocNode(page, 'E2E cities').locator('.ms-visibility-check').first().click();
        await closeMapConfiguration(page);
        await expect.poll(() => mapPixels(page, RED), { timeout: 20000 }).toBe(0);
        await saveGeostory(page);

        expect((await sectionMapLayer(api, story, 'e2e_cities')).visibility).toBe(false);
    });

    test('The image format of a layer of a story map is changed', fromScenario('GeoStory/Media_Content/Edit/Edit_map_content — Edit layer'), async({ page, data }) => {
        const story = await mapStory(data, [cities()]);

        await openStory(page, story);
        await configureMap(page);
        await layerSettings(page, 'E2E cities', 'eye-open');
        const jpeg = page.waitForRequest((r) => /request=GetMap/i.test(r.url()) && /format=image%2Fjpeg/i.test(r.url()));
        const format = page.getByText('Format', { exact: true }).locator('xpath=following::*[contains(@class,"Select-control")][1]');
        await format.click();
        await page.locator('.Select-option').filter({ hasText: /^image\/jpeg$/ }).click();
        await jpeg;
        await editorToolbar(page, '1-close').click();
        await closeMapConfiguration(page);
        await saveGeostory(page);
    });

    test('The style of a layer of a story map is changed', fromScenario('GeoStory/Media_Content/Edit/Edit_map_content — Edit layer style'), async({ page, data, api }) => {
        await authorizeGeoServerRest(page);
        const story = await mapStory(data, [cities()]);

        await openStory(page, story);
        await configureMap(page);
        await layerSettings(page, 'E2E cities', 'dropper');
        const styled = page.waitForRequest((r) => /request=GetMap/i.test(r.url()) && /styles=(e2e(%3A|:))?e2e_points_by_category/i.test(r.url()));
        await editor(page).locator('.Select-control').filter({ hasText: 'Default Style' }).click();
        await page.locator('.Select-option').filter({ hasText: 'E2E cities by category' }).click();
        await styled;
        await editorToolbar(page, '1-close').click();
        await closeMapConfiguration(page);
        await saveGeostory(page);

        expect((await sectionMapLayer(api, story, 'e2e_cities')).style).toMatch(/e2e_points_by_category$/);
    });

    test('A layer is added to a story map from the advanced map editor', fromScenario('GeoStory/Media_Content/Edit/Edit_map_content — Edit map from the Inline Editor'), async({ page, data }) => {
        const story = await mapStory(data, [cities()]);

        await openStory(page, story);
        await configureMap(page);
        await editorToolbar(page, 'pencil').click();
        const mapEditor = page.locator('.modal-dialog').filter({ hasText: 'Map Editor' }).last();
        await expect(mapEditor).toBeVisible();
        await mapEditor.locator('button:has(.glyphicon-folder-open)').click();
        await mapEditor.getByText('e2e:e2e_events', { exact: true })
            .locator('xpath=ancestor::*[.//button[.//*[contains(@class,"glyphicon-plus")]]][1]')
            .locator('button:has(.glyphicon-plus)').click();
        await mapEditor.getByRole('button', { name: 'ok' }).click();
        await expect(mapEditor).toHaveCount(0);

        // Confirming the map editor closes the map configuration too.
        await configureMap(page);
        await expect(tocNode(page, 'e2e_events')).toBeVisible();
        await closeMapConfiguration(page);
        await saveGeostory(page);
    });

    test('Center and scale of a map are applied to the other maps of the story', fromScenario('GeoStory/Media_Content/Edit/Edit_map_content — Update the center and scale of maps (@GH-12096)'), async({ page, data, api }) => {
        const story = await mapStory(data, [cities()], [cities()]);

        await openStory(page, story);
        await configureMap(page);
        await editorTab(page, 'wrench');
        const lat = editor(page).getByText('Lat', { exact: true }).locator('xpath=following::input[1]');
        const lon = editor(page).getByText('Lon', { exact: true }).locator('xpath=following::input[1]');
        await lat.fill('45.46');
        await lon.fill('9.19');
        await page.waitForTimeout(1000);
        await editor(page).getByText('Center', { exact: true }).locator('xpath=following::button[1]').click();
        await editor(page).getByText('Scale', { exact: true }).locator('xpath=following::*[contains(@class,"Select-control")][1]').click();
        await page.locator('.Select-option').filter({ hasText: /^1 : 2311167$/ }).click();
        await editor(page).getByText('Scale', { exact: true }).locator('xpath=following::button[1]').click();
        await closeMapConfiguration(page);
        await saveGeostory(page);

        // The maps of the sections keep their own center and zoom over the ones of the resources.
        const { sections } = await storyData(api, story);
        for (const { map } of sections.map(({ contents }) => contents[0].background)) {
            expect(map.center.y).toBeCloseTo(45.46, 1);
            expect(map.center.x).toBeCloseTo(9.19, 1);
            expect(map.zoom).toBe(8);
        }
    });

    test('Layers and groups of a story map are managed from its table of contents', fromScenario('GeoStory/Media_Content/Edit/Edit_map_content — TOC on Map contect (@GH-10237)'), async({ page, data, api }) => {
        const story = await groupStory(data);

        await openStory(page, story);
        await configureMap(page);

        await test.step('Legend', async() => {
            await tocNode(page, 'E2E cities').locator('.ms-node-expand').click();
            await expect(tocNode(page, 'E2E cities').locator('img[src*="GetLegendGraphic"]')).toBeVisible();
        });

        await test.step('Opacity', async() => {
            const handle = tocNode(page, 'E2E cities').locator('.noUi-handle');
            const box = await handle.boundingBox();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.mouse.move(box.x - 150, box.y + box.height / 2, { steps: 10 });
            await page.mouse.up();
            await expect(handle).not.toHaveText('100 %');
        });

        await test.step('Order', async() => {
            await tocNode(page, 'E2E cities').locator('.grab-handle').dragTo(tocNode(page, 'E2E other').locator('.ms-node-title'), { targetPosition: { x: 5, y: 2 } });
            await expect(editor(page).locator('.ms-node-layer .ms-node-title').first()).toHaveText('E2E cities');
        });

        await test.step('Layer visibility', async() => {
            const check = tocNode(page, 'E2E other').locator('.ms-visibility-check').first();
            await check.click();
            await expect(check).not.toHaveClass(/active/);
        });

        await test.step('Group visibility and collapse', async() => {
            const group = editor(page).locator('.ms-node-group').filter({ hasText: 'E2E group' }).first();
            const check = group.locator('.ms-visibility-check').first();
            await check.click();
            await expect(check).not.toHaveClass(/active/);
            await expect.poll(() => mapPixels(page, CAPITAL, 12)).toBe(0);
            await group.locator('.ms-node-expand').first().click();
            await expect(tocNode(page, 'E2E cities')).toBeHidden();
        });

        await closeMapConfiguration(page);
        await saveGeostory(page);

        const { groups, layers } = (await storyData(api, story)).sections[0].contents[0].background.map;
        const [first, second] = layers.filter(({ group }) => group === 'e2e_group');
        expect([first.id, second.id]).toEqual(['e2e_other', 'e2e_cities']);
        expect(second.opacity).toBeLessThan(1);
        expect(first.visibility).toBe(false);
        expect(groups.find(({ id }) => id === 'e2e_group')).toMatchObject({ visibility: false, expanded: false });
    });

    test('The interactive legend of a story map filters its layer', fromScenario('GeoStory/Media_Content/Edit/Edit_map_content — Interactive legend in geostory (@GH-10235)'), async({ page, data }) => {
        const story = await groupStory(data);

        await openStory(page, story);
        await configureMap(page);
        await layerSettings(page, 'E2E cities', 'eye-open');
        await editor(page).getByText('Enable interactive legend').click();
        await editorToolbar(page, '1-close').click();
        await tocNode(page, 'E2E cities').locator('.ms-node-expand').click();
        const filtered = page.waitForRequest((r) => /request=GetMap/i.test(r.url()) && /capital/.test(decodeURIComponent(r.url())));
        // The interactive legend lists the rules by name.
        await tocNode(page, 'E2E cities').getByText('capital', { exact: true }).click();
        await filtered;
        await expect.poll(() => mapPixels(page, CITY, 12), { timeout: 20000 }).toBe(0);
        await expect.poll(() => mapPixels(page, CAPITAL, 12)).toBeGreaterThan(20);
    });
});
