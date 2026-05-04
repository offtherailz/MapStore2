import { Page } from '@playwright/test';
import { config } from '../config';

function normalizeBase(baseURL: string): URL {
    const base = new URL(baseURL);

    if (!base.pathname.endsWith('/')) {
        base.pathname = `${base.pathname}/`;
    }

    return base;
}

export function resolveAppUrl(target: string, baseURL = config.baseURL): string {
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

export async function openAppTarget(page: Page, target: string): Promise<void> {
    await page.goto(resolveAppUrl(target));
}
