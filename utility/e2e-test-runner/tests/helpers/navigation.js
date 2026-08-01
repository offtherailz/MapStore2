import { config } from '../config.js';

function normalizeBase(baseURL) {
    const base = new URL(baseURL);

    if (!base.pathname.endsWith('/')) {
        base.pathname = `${base.pathname}/`;
    }

    return base;
}

function resolveAppUrl(target, baseURL = config.baseURL) {
    const base = normalizeBase(baseURL);

    if (/^https?:\/\//i.test(target)) {
        const source = new URL(target);

        source.protocol = base.protocol;
        source.host = base.host;
        source.pathname = base.pathname;

        return source.toString();
    }

    if (target.startsWith('#') || target.startsWith('?')) {
        return new URL(target, base.toString()).toString();
    }

    return new URL(target, base.toString()).toString();
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} target
 */
async function openAppTarget(page, target) {
    await page.goto(resolveAppUrl(target));
}

/**
 * Moves the pointer to an empty area of the viewport.
 *
 * MapStore renders its button tooltips as overlays that stay under the pointer after a
 * click; they intercept pointer events on the toolbar button next to them, so the next
 * click times out. Call this between two clicks on adjacent toolbar buttons.
 *
 * @param {import('@playwright/test').Page} page
 */
async function moveAwayFromTooltips(page) {
    const viewport = page.viewportSize() ?? { width: 1280, height: 720 };

    await page.mouse.move(Math.round(viewport.width / 2), Math.round(viewport.height / 2));
    await page.locator('[role="tooltip"]').first().waitFor({ state: 'hidden' }).catch(() => {});
}

/**
 * Dismisses the guided tour shown on the first visit of a viewer.
 *
 * The tour renders a full page overlay that swallows every click, so specs have to get
 * rid of it before touching the UI. It is not always there, hence the soft check.
 *
 * @param {import('@playwright/test').Page} page
 */
async function dismissTutorial(page, { timeout = 8000 } = {}) {
    const overlay = page.locator('.joyride-overlay');

    // The tour mounts a moment after the viewer, so waiting for it is what makes this
    // reliable: a plain visibility check can run before the overlay exists.
    await overlay.waitFor({ state: 'visible', timeout }).catch(() => {});

    const skip = page.getByRole('button', { name: 'Skip' });

    if (await skip.isVisible().catch(() => false)) {
        await skip.click();
        await overlay.waitFor({ state: 'detached', timeout }).catch(() => {});
    }
}

export { resolveAppUrl, openAppTarget, moveAwayFromTooltips, dismissTutorial };
