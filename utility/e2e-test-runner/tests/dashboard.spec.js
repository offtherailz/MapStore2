import { test, expect, describeIfFeature } from './fixtures.js';
import { hasFeature } from './config.js';
import { login } from './helpers/auth.js';
import { openAppTarget, dismissTutorial } from './helpers/navigation.js';
import { FIXTURE_LAYER_TITLE, FIXTURE_FEATURES } from './helpers/map.js';
import {
    WIDGET_TYPES,
    openDashboard,
    addWidget,
    wizardNext,
    saveWidget,
    saveDashboard,
    commitTextWidgetBody,
    selectCombo,
    selectComboByLabel,
    pickFixtureLayer
} from './helpers/dashboard.js';

describeIfFeature('geoserverIntegration', 'Dashboard', () => {
    test.beforeEach(async({ page }) => {
        test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
        await login(page);
    });

    test('Saved dashboard opens in the editor with every widget type available', async({ page, data }) => {
        const dashboard = await data.dashboard();

        await openDashboard(page, dashboard.id);
        await expect(page.getByText(dashboard.name)).toBeVisible();

        await page.locator('button.btn-tray:has(.glyphicon-plus)').first().click();

        for (const type of WIDGET_TYPES) {
            await expect(page.getByText(type, { exact: true }).first()).toBeVisible();
        }
    });

    test('Text widget can be added and survives a reload', async({ page, data }) => {
        const dashboard = await data.dashboard();
        const widgetTitle = 'E2E text widget';
        const widgetBody = 'Written by the E2E suite';

        await openDashboard(page, dashboard.id);

        await test.step('Build a text widget', async() => {
            await addWidget(page, 'Text');
            await page.getByPlaceholder('Insert title...').fill(widgetTitle);

            // The body is a Draft.js editor: it only records real key events.
            const editor = page.locator('[contenteditable="true"]').first();
            await editor.click();
            await editor.pressSequentially(widgetBody, { delay: 20 });
            await expect(editor).toContainText(widgetBody);

            await commitTextWidgetBody(page);
            await saveWidget(page);
        });

        await test.step('The widget shows on the dashboard', async() => {
            await expect(page.getByText(widgetTitle)).toBeVisible({ timeout: 15000 });
            await expect(page.getByText(widgetBody)).toBeVisible();
        });

        await test.step('Save the dashboard and reload it', async() => {
            await saveDashboard(page);
            await openDashboard(page, dashboard.id);
            await expect(page.getByText(widgetTitle)).toBeVisible({ timeout: 20000 });
            await expect(page.getByText(widgetBody)).toBeVisible();
        });
    });

    test('Table widget on the fixture layer lists its features', async({ page, data }) => {
        const dashboard = await data.dashboard();
        const widgetTitle = 'E2E table widget';

        await openDashboard(page, dashboard.id);

        await test.step('Pick the fixture layer from the local service', async() => {
            await addWidget(page, 'Table');
            await expect(page.getByText('Local GeoServer WFS')).toBeVisible({ timeout: 20000 });

            const record = page.locator('.ms-catalog-card').filter({ hasText: FIXTURE_LAYER_TITLE }).first();
            await expect(record).toBeVisible({ timeout: 20000 });
            await record.click();
        });

        await test.step('Keep every column and name the widget', async() => {
            await wizardNext(page);
            await expect(page.getByText('Configure table options')).toBeVisible({ timeout: 15000 });
            await wizardNext(page);
            await page.locator('input.form-control').first().fill(widgetTitle);
            await saveWidget(page);
        });

        await test.step('The widget lists the fixture features', async() => {
            // The widget reports the total, while only the rows fitting its default height
            // are rendered: the count comes from the footer, the data from the first row.
            await expect(page.getByText(`${FIXTURE_FEATURES.length} Items`)).toBeVisible({ timeout: 30000 });
            await expect(page.locator('.react-grid-Row').first()).toBeVisible();
            await expect(page.getByText(FIXTURE_FEATURES[0], { exact: true }).first()).toBeVisible();
        });
    });

    test('Admin can create and delete a dashboard from the homepage', async({ page, api, data }) => {
        const dashboardName = data.name('dashboard');

        await test.step('Create a dashboard', async() => {
            await page.getByRole('button', { name: 'Add Resource' }).click();
            await page.getByRole('menuitem', { name: 'Create dashboard' }).click();
            await expect(page.locator('.ms-brand-navbar')).toBeVisible({ timeout: 30000 });
            await dismissTutorial(page);
        });

        await test.step('Save it under a unique name', async() => {
            // A dashboard that was never saved offers only the "save as" action.
            await page.locator('.ms-brand-navbar button:has(.glyphicon-floppy-open), '
                + '.ms-brand-navbar button:has(.glyphicon-floppy-disk)').first().click();
            await page.getByRole('textbox').fill(dashboardName);
            await page.getByRole('button', { name: /^(create|save)$/i }).click();
            // The success toast fades quickly; the editor switching to the saved resource
            // is the durable signal.
            await expect(page).toHaveURL(/#\/dashboard\/\d+/, { timeout: 20000 });
            await expect(page.getByText(dashboardName)).toBeVisible({ timeout: 20000 });
        });

        await test.step('Adopt the dashboard, so it is removed even if a later step fails', async() => {
            const [resource] = await api.findResources('DASHBOARD', dashboardName);
            expect(resource, `dashboard ${dashboardName} not found through the API`).toBeTruthy();
            data.track({ id: resource.id, name: dashboardName, category: 'DASHBOARD' });
        });

        await test.step('It shows on the homepage and can be deleted', async() => {
            await openAppTarget(page, '#/');
            const card = page.locator('.ms-resource-card').filter({ hasText: dashboardName });
            await expect(card).toBeVisible({ timeout: 15000 });
            await card.locator('.glyphicon-option-vertical').click();
            await page.getByRole('menuitem', { name: 'Delete' }).click();
            await page.getByRole('button', { name: 'Delete' }).click();
            await expect(page.locator('.ms-resource-card').filter({ hasText: dashboardName })).toHaveCount(0);
        });
    });

    test('Counter widget aggregates the fixture population', async({ page, data }) => {
        const dashboard = await data.dashboard();
        // 2748000 + 1352000 + 913000 + 361000 + 561000 of the PostGIS fixture, rendered
        // without thousands separators.
        const totalPopulation = '5935000';

        await openDashboard(page, dashboard.id);

        await test.step('Build a counter on the population attribute', async() => {
            await addWidget(page, 'Counter');
            await pickFixtureLayer(page, FIXTURE_LAYER_TITLE);
            await wizardNext(page);
            await expect(page.getByText('Configure data')).toBeVisible({ timeout: 20000 });

            await selectCombo(page, 0, 'population');
            await selectCombo(page, 1, 'SUM');
        });

        await test.step('The aggregated value is shown and kept after saving', async() => {
            await expect(page.getByText(totalPopulation)).toBeVisible({ timeout: 30000 });
            await wizardNext(page);
            await page.locator('input.form-control').first().fill('E2E counter widget');
            await saveWidget(page);
            await expect(page.getByText(totalPopulation)).toBeVisible({ timeout: 30000 });
        });
    });

    test('Chart widget groups the fixture features by category', async({ page, data }) => {
        const dashboard = await data.dashboard();

        await openDashboard(page, dashboard.id);

        await test.step('Build a bar chart of population by category', async() => {
            await addWidget(page, 'Chart');
            await pickFixtureLayer(page, FIXTURE_LAYER_TITLE);
            await wizardNext(page);
            await expect(page.getByText('X Attribute').first()).toBeVisible({ timeout: 20000 });
        });

        await test.step('The chart renders the aggregated categories', async() => {
            await selectComboByLabel(page, 'X Attribute', 'category');
            await selectComboByLabel(page, 'Y Attribute', 'population');
            await selectComboByLabel(page, 'Operation', 'SUM');
            await expect(page.locator('.js-plotly-plot')).toBeVisible({ timeout: 30000 });
            await expect(page.getByText('capital').first()).toBeVisible({ timeout: 30000 });
        });
    });

    test('Widget can be removed from the dashboard', async({ page, data }) => {
        const dashboard = await data.dashboard();
        const widgetTitle = 'E2E removable widget';

        await openDashboard(page, dashboard.id);
        await addWidget(page, 'Text');
        await page.getByPlaceholder('Insert title...').fill(widgetTitle);
        await commitTextWidgetBody(page);
        await saveWidget(page);
        await expect(page.getByText(widgetTitle)).toBeVisible({ timeout: 15000 });

        await test.step('Delete it through the widget menu', async() => {
            await page.getByText(widgetTitle).hover();
            await page.locator('button:has(.glyphicon-option-vertical)').first().click();
            await page.getByRole('menuitem', { name: /delete|remove/i }).first().click();
            const confirm = page.getByRole('button', { name: /^(delete|yes|remove)$/i }).last();
            if (await confirm.isVisible().catch(() => false)) {
                await confirm.click();
            }
            await expect(page.getByText(widgetTitle)).toHaveCount(0, { timeout: 15000 });
        });
    });
});
