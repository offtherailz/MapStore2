const { config } = require('../config');

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

module.exports = { resolveAppUrl, openAppTarget };
