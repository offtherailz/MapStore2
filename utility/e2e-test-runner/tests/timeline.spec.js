import { test, expect, describeIfFeature, fromScenario } from './fixtures.js';
import { hasFeature, getServiceUrl } from './config.js';
import { login } from './helpers/auth.js';
import { fixtureLayer, fixtureTableLayer, mapConfig, openMapViewer } from './helpers/map.js';

const background = () => fixtureLayer({ id: 'e2e_background', title: 'E2E background', group: 'background', search: undefined, visibility: false });

/**
 * e2e_events, one event a day from 2024-01-01 to 2024-01-05. Its time values come from
 * the DescribeDomains of the WMTS multidimensional extension of GeoServer.
 */
function eventsLayer() {
    return fixtureTableLayer('e2e_events', {
        dimensions: [{ name: 'time', source: { type: 'multidim-extension', url: `${getServiceUrl('geoserver')}/gwc/service/wmts` } }]
    });
}

const timeline = (page) => page.locator('.timeline-plugin');
const timelineButton = (page, glyph) => timeline(page).locator(`button:has(.glyphicon-${glyph})`);

/** The time asked by the next GetMap of the events, as an ISO date. */
function nextTime(page, predicate = () => true) {
    return page.waitForRequest((r) => /request=GetMap/i.test(r.url()) && r.url().includes('e2e_events')
        && /[?&]time=/i.test(r.url()) && predicate(new URL(r.url()).searchParams.get('time') ?? new URL(r.url()).searchParams.get('TIME')))
        .then((r) => new URL(r.url()).searchParams.get('time') ?? new URL(r.url()).searchParams.get('TIME'));
}

async function openEventsMap(page, data, { center = [12, 42], zoom = 5 } = {}) {
    const config = mapConfig([background(), eventsLayer()]);
    config.map.center = { x: center[0], y: center[1], crs: 'EPSG:4326' };
    config.map.zoom = zoom;
    const map = await data.map({ data: config });
    const firstTime = nextTime(page);
    await openMapViewer(page, map.id);
    await expect(timeline(page)).toBeVisible({ timeout: 30000 });

    return { map, time: await firstTime };
}

describeIfFeature('geoserverIntegration', 'Timeline', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('The timeline shows the time layers and moves the map in time', fromScenario('Maps/TOC/Timeline — Timeline plugin (@GS-11926)'), async({ page, data }) => {
        const { time } = await openEventsMap(page, data);
        // It starts on the last event and sits in the footer area, not floating on the map.
        expect(time).toMatch(/^2024-01-05/);
        const footer = await page.locator('.ms-footer, #footer-container, [class*=map-footer]').first().boundingBox();
        const bar = await timeline(page).boundingBox();
        if (footer) {
            expect(bar.y + bar.height).toBeLessThanOrEqual(footer.y + 2);
        }

        await test.step('Expanded, it lists the layer and its histogram', async() => {
            await timeline(page).locator('.ms-timeline-expand, button:has(.glyphicon-resize-full)').first().click();
            await expect(timeline(page).getByText('e2e_events').first()).toBeVisible({ timeout: 20000 });
        });

        await test.step('A step back asks the previous event', async() => {
            const previous = nextTime(page, (value) => /^2024-01-04/.test(value));
            await timelineButton(page, 'step-backward').click();
            await previous;
        });

        await test.step('The time range is enabled', async() => {
            const range = nextTime(page, (value) => value.includes('/'));
            await timelineButton(page, 'time-offset').click();
            expect(await range).toMatch(/^2024-01-04.*\/.+/);
        });

        await test.step('Play moves the time on', async() => {
            const played = nextTime(page, (value) => !/^2024-01-04/.test(value));
            await timelineButton(page, 'play').click();
            await played;
            await timelineButton(page, 'stop').click();
        });
    });

    test('The animation step is set when not snapped to the layer', fromScenario('Maps/TOC/Timeline — Timeline Settings'), async({ page, data }) => {
        await openEventsMap(page, data);
        await timelineButton(page, 'cog').click();
        // The snap option is a switch next to its label.
        const snap = page.getByText('Snap to guide layer', { exact: true }).locator('xpath=following::input[@type="checkbox"][1]');
        await expect(snap).toBeChecked();
        const step = page.getByText('Animation Step', { exact: true }).locator('xpath=following::input[1]');
        await expect(step).toBeDisabled();
        await snap.evaluate((input) => input.click());
        await expect(step).toBeEnabled();
        await step.fill('2');
        const unit = page.getByText('Animation Step', { exact: true }).locator('xpath=following::select[1]');
        await expect(unit.locator('option')).toHaveText(['Years', 'Weeks', 'Days', 'Hours', 'Minutes', 'Seconds']);
        await unit.selectOption({ label: 'Days' });
        await expect(unit.locator('option:checked')).toHaveText('Days');
    });

    test('The timeline can follow the features in view', fromScenario('Maps/TOC/Timeline — Filter timeline by viewport'), async({ page, data }) => {
        await openEventsMap(page, data, { center: [8.9463, 44.4056], zoom: 10 });
        const viewport = timelineButton(page, 'viewport-filter');
        const domains = page.waitForRequest((r) => /DescribeDomains/i.test(r.url()) && /bbox/i.test(r.url()));
        await viewport.click();
        await domains;
        await expect(viewport).toHaveClass(/active|success/);
        await viewport.click();
        await expect(viewport).not.toHaveClass(/active|success/);
    });

    test('Identify follows the time of the timeline', fromScenario('Maps/TOC/Timeline — GFI change by time (@GH-11327)'), async({ page, data }) => {
        // Genoa hosts the last event, of January the 5th.
        await openEventsMap(page, data, { center: [8.9463, 44.4056], zoom: 10 });
        const box = await page.locator('.ol-viewport').boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await expect(page.getByText('Event 5').first()).toBeVisible({ timeout: 20000 });

        const identify = page.waitForRequest((r) => /request=GetFeatureInfo/i.test(r.url()) && /time=2024-01-04/i.test(decodeURIComponent(r.url())));
        await timelineButton(page, 'step-backward').click();
        await identify;
        await expect(page.getByText('Event 5')).toHaveCount(0, { timeout: 20000 });
    });

    test('A time without data empties the layer', fromScenario('Maps/TOC/Timeline — Reload time (@GH-11803)'), async({ page, data }) => {
        await openEventsMap(page, data);
        // The year is the third field of the date: its down arrow moves to 2023.
        const year = page.locator('.timeline-plugin').getByRole('textbox').nth(2).or(timeline(page).locator('input').nth(2)).first();
        const earlier = nextTime(page, (value) => /^2023-/.test(value));
        await year.fill('2023');
        await year.press('Enter');
        expect(await earlier).toMatch(/^2023-01-05/);
    });
});
