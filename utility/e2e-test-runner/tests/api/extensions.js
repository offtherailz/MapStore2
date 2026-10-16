/**
 * Client of the MapStore extension services (upload service of the context creator).
 *
 * Extensions are not GeoStore resources: they live in the extensions folder and are
 * listed in extensions.json, so they get their own client for setup and teardown.
 */

import { request } from '@playwright/test';
import { config } from '../config.js';

/** Prefix of the extensions installed by the suites; plugin names allow no separator. */
const EXTENSION_PREFIX = 'E2E';

function baseUrl() {
    return config.baseURL.endsWith('/') ? config.baseURL : `${config.baseURL}/`;
}

async function createExtensionsClient() {
    const context = await request.newContext({
        baseURL: baseUrl(),
        extraHTTPHeaders: {
            Authorization: `Basic ${Buffer.from(`${config.adminUser}:${config.adminPassword}`).toString('base64')}`
        }
    });

    /** @returns {Promise<string[]>} names of the installed extensions */
    async function list() {
        const response = await context.get('extensions/extensions.json');

        // No extension installed yet: the registry does not exist.
        if (response.status() === 404) {
            return [];
        }

        if (!response.ok()) {
            throw new Error(`extensions list failed: ${response.status()}`);
        }

        return Object.keys(await response.json());
    }

    async function uninstall(name) {
        const response = await context.delete(`rest/config/uninstallPlugin/${encodeURIComponent(name)}`);

        if (!response.ok() && response.status() !== 404) {
            throw new Error(`uninstall of extension ${name} failed: ${response.status()}`);
        }
    }

    /** @returns {Promise<number>} how many extensions were removed */
    async function removeFixtures(prefix = EXTENSION_PREFIX) {
        const names = (await list()).filter((name) => name.startsWith(prefix));

        for (const name of names) {
            await uninstall(name);
        }

        return names.length;
    }

    return { list, uninstall, removeFixtures, dispose: () => context.dispose() };
}

export { EXTENSION_PREFIX, createExtensionsClient };
