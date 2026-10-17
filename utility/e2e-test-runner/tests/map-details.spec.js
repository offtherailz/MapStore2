import { test, expect, fromScenario } from './fixtures.js';
import { login } from './helpers/auth.js';
import { openAppTarget } from './helpers/navigation.js';
import { openMapViewer } from './helpers/map.js';
import { openViewerDetails, editOpenDetails, saveFromViewer, detailsPanel } from './helpers/details.js';
import { contextPayload } from './helpers/content.js';

function romeMap() {
    return { version: 2, map: { projection: 'EPSG:900913', center: { x: 12.5, y: 41.9, crs: 'EPSG:4326' }, zoom: 6, layers: [] } };
}

/** Side bar button opening the details of the map ("About this content"). */
function aboutButton(page) {
    return page.locator('button:has(.glyphicon-sheet)').first();
}

/** Opens the About tab of the properties panel in edit mode. */
async function editAbout(page) {
    await openViewerDetails(page);
    const panel = await editOpenDetails(page);
    await panel.getByRole('tab', { name: 'About' }).click();

    return panel;
}

async function writeDetails(panel, text) {
    const editor = panel.locator('.public-DraftEditor-content');
    await editor.click();
    await editor.press('ControlOrMeta+a');
    if (text) {
        await editor.pressSequentially(text, { delay: 10 });
    } else {
        await editor.press('Delete');
    }
}

async function closePanel(page) {
    await detailsPanel(page).locator('button:has(.glyphicon-1-close)').first().click();
}

test.describe('Map details', () => {
    test.beforeEach(async({ page }) => {
        await login(page);
    });

    test('Details are written and read from the side bar', fromScenario('Maps/Options/Details — Add details'), async({ page, data }) => {
        const map = await data.map({ data: romeMap() });
        const text = 'Details of the map written by the E2E suite';

        await openMapViewer(page, map.id);
        await writeDetails(await editAbout(page), text);
        await saveFromViewer(page);
        await closePanel(page);

        await aboutButton(page).click();
        await expect(page.getByText(text).first()).toBeVisible({ timeout: 15000 });
    });

    test('Details set to open at startup show in a modal when the map opens', fromScenario('Maps/Options/Details — Settings details'), async({ page, data }) => {
        const map = await data.map({ data: romeMap() });
        const text = 'Details shown at startup';

        await openMapViewer(page, map.id);
        const panel = await editAbout(page);
        await writeDetails(panel, text);
        await panel.getByRole('tab', { name: 'Settings' }).click();
        await panel.getByRole('checkbox', { name: 'Show as modal' }).check();
        await panel.getByRole('checkbox', { name: 'Show at startup' }).check();
        await saveFromViewer(page);

        await openMapViewer(page, map.id);
        await expect(page.getByRole('dialog').filter({ hasText: text })).toBeVisible({ timeout: 20000 });
    });

    test('Details are edited', fromScenario('Maps/Options/Details — Edit details'), async({ page, data }) => {
        const map = await data.map({ data: romeMap() });
        await data.details(map, '<p>Original details</p>');

        await openMapViewer(page, map.id);
        await writeDetails(await editAbout(page), 'Edited details');
        await saveFromViewer(page);
        await closePanel(page);

        await aboutButton(page).click();
        await expect(page.getByText('Edited details').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('Original details')).toHaveCount(0);
    });

    test('Details are removed', fromScenario('Maps/Options/Details — Delete details'), async({ page, data }) => {
        const map = await data.map({ data: romeMap() });
        await data.details(map, '<p>Details to remove</p>');

        await openMapViewer(page, map.id);
        await expect(aboutButton(page)).toBeVisible({ timeout: 15000 });
        await writeDetails(await editAbout(page), '');
        await saveFromViewer(page);

        await openMapViewer(page, map.id);
        await expect(aboutButton(page)).toHaveCount(0);
    });

    test('Details of a map in a context open at startup', fromScenario('Maps/Options/Details — Add details on context map (@GH-12441)'), async({ page, api, data }) => {
        const context = await data.context({ data: contextPayload({ plugins: [
            { name: 'BrandNavbar', cfg: { containerPosition: 'header' } },
            { name: 'SidebarMenu' },
            { name: 'Details' },
            { name: 'ResourceDetails', cfg: { resourceType: 'MAP' } },
            { name: 'Save', cfg: { resourceType: 'MAP' } }
        ] }) });
        const map = await data.map({ data: romeMap() });
        await api.setAttribute(map.id, 'context', String(context.id));
        await data.details(map, '<p>Details of the context map</p>');
        await api.setAttribute(map.id, 'detailsSettings', JSON.stringify({ showAsModal: false, showAtStartup: true }));

        await openAppTarget(page, `#/context/${context.name}/${map.id}`);
        await expect(page.getByText('Details of the context map').first()).toBeVisible({ timeout: 30000 });
    });
});
