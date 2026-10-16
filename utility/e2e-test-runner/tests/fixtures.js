/**
 * Shared fixtures for the E2E suites.
 *
 * Specs import `test` and `expect` from here instead of `@playwright/test`, so they
 * get an authenticated GeoStore client and a data factory whose objects are always
 * removed, even when the test fails halfway through.
 */

import { test as base, expect } from '@playwright/test';
import { createGeoStoreClient, uniqueName } from './api/geostore.js';
import { hasFeature } from './config.js';

/**
 * @typedef {object} DataFactory
 * @property {(overrides?: object) => Promise<object>} map
 * @property {(overrides?: object) => Promise<object>} dashboard
 * @property {(overrides?: object) => Promise<object>} geostory
 * @property {(overrides?: object) => Promise<object>} user
 * @property {(overrides?: object) => Promise<object>} group
 * @property {(overrides?: object) => Promise<object>} tag
 * @property {(resource: object, options?: object) => Promise<object>} thumbnail attach a generated thumbnail
 * @property {(resource: object, html: string, options?: object) => Promise<object>} details attach a details page
 * @property {(resource: object) => Promise<void>} publish make a resource readable by everyone
 * @property {(label: string) => string} name unique fixture name, not persisted
 * @property {(resource: object) => void} track adopt a resource created by the UI
 * @property {(user: {id: number, name: string}) => void} trackUser adopt a user created by the UI
 * @property {(group: {id: number, groupName: string}) => void} trackGroup adopt a group created by the UI
 */

/** 1x1 PNG, the smallest image a thumbnail can hold. */
const THUMBNAIL_DATA_URI = 'data:image/png;base64,'
    + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const test = base.extend({
    /**
     * Every page starts with the cookie policy accepted: the banner covers the bottom of
     * the viewport and intercepts clicks on whatever sits under it.
     */
    page: async({ page }, use) => {
        // Legacy key, still honoured by epics/cookies.js and independent of the storage prefix.
        await page.addInitScript(() => window.localStorage.setItem('cookies-policy-approved', 'true'));
        await use(page);
    },

    /** Administrator-level GeoStore client. */
    api: async({}, use) => {
        const client = await createGeoStoreClient();

        await use(client);
        await client.dispose();
    },

    /**
     * Test data factory. Everything it creates is deleted after the test, in reverse
     * creation order, through the API — so teardown does not depend on the UI.
     */
    data: async({ api }, use, testInfo) => {
        const bundle = testInfo.titlePath[0] ?? 'suite';
        const created = { resources: [], users: [], groups: [], tags: [] };

        const factory = {
            name: (label) => uniqueName(bundle, label),

            track: ({ id, name, category = 'MAP' }) => {
                created.resources.push({ id, name, category });
            },

            trackUser: ({ id, name }) => {
                created.users.push({ id, name });
            },

            trackGroup: ({ id, groupName }) => {
                created.groups.push({ id, groupName });
            },

            map: async(overrides = {}) => {
                const resource = await api.createResource({
                    name: uniqueName(bundle, 'map'),
                    category: 'MAP',
                    data: { version: 2, map: { center: { x: 11, y: 43, crs: 'EPSG:4326' }, zoom: 5, layers: [] } },
                    ...overrides
                });

                created.resources.push(resource);

                return resource;
            },

            dashboard: async(overrides = {}) => {
                const resource = await api.createResource({
                    name: uniqueName(bundle, 'dashboard'),
                    category: 'DASHBOARD',
                    data: { widgets: [], layouts: {} },
                    ...overrides
                });

                created.resources.push(resource);

                return resource;
            },

            geostory: async(overrides = {}) => {
                const resource = await api.createResource({
                    name: uniqueName(bundle, 'geostory'),
                    category: 'GEOSTORY',
                    data: { type: 'cascade', sections: [] },
                    ...overrides
                });

                created.resources.push(resource);

                return resource;
            },

            user: async(overrides = {}) => {
                const name = overrides.name ?? uniqueName(bundle, 'user');
                const user = await api.createUser({
                    name,
                    password: overrides.password ?? 'E2ePassword!1',
                    role: overrides.role ?? 'USER',
                    enabled: overrides.enabled ?? true
                });

                created.users.push(user);

                return user;
            },

            group: async(overrides = {}) => {
                const group = await api.createGroup({
                    groupName: overrides.groupName ?? uniqueName(bundle, 'group'),
                    ...overrides
                });

                created.groups.push(group);

                return group;
            },

            tag: async(overrides = {}) => {
                const tag = await api.createTag({ name: uniqueName(bundle, 'tag'), ...overrides });

                created.tags.push(tag);

                return tag;
            },

            /**
             * Stores a thumbnail the way MapStore does: a THUMBNAIL resource holding a data
             * URI, linked from the `thumbnail` attribute of the resource. It gets the same
             * readers as the resource, so call `publish` first for public resources.
             */
            thumbnail: async(resource, { everyone = false } = {}) => {
                const thumbnail = await api.createResource({
                    name: `${resource.name}_thumbnail`,
                    category: 'THUMBNAIL',
                    data: THUMBNAIL_DATA_URI
                });

                created.resources.push(thumbnail);
                await api.setPermissions(thumbnail.id, { everyone });
                await api.setAttribute(resource.id, 'thumbnail', `rest/geostore/data/${thumbnail.id}/raw?decode=datauri`);

                return thumbnail;
            },

            /** Stores the details page of a resource as MapStore does: a linked DETAILS resource. */
            details: async(resource, html, { everyone = false } = {}) => {
                const details = await api.createResource({
                    name: `${resource.name}_details`,
                    category: 'DETAILS',
                    data: html
                });

                created.resources.push(details);
                await api.setPermissions(details.id, { everyone });
                await api.setAttribute(resource.id, 'details', `rest/geostore/data/${details.id}`);

                return details;
            },

            publish: async(resource) => {
                await api.setPermissions(resource.id, { everyone: true });
            }
        };

        await use(factory);

        // Teardown is best effort: one failure must not hide the others.
        for (const resource of created.resources.reverse()) {
            await api.deleteResource(resource.id).catch(() => {});
        }

        for (const user of created.users.reverse()) {
            await api.deleteUser(user.id).catch(() => {});
        }

        for (const group of created.groups.reverse()) {
            await api.deleteGroup(group.id).catch(() => {});
        }

        for (const tag of created.tags.reverse()) {
            await api.deleteTag(tag.id).catch(() => {});
        }
    }
});

/**
 * Declares a group of tests that only runs when a capability is available.
 * Use it for whole spec files; use `test.skip(!hasFeature(...))` for a single test.
 *
 * @param {string} feature see KNOWN_FEATURES in config.js
 * @param {string} title
 * @param {() => void} body
 */
function describeIfFeature(feature, title, body) {
    test.describe(title, () => {
        // Callback form: in describe scope Playwright expects a predicate, not a boolean.
        test.skip(() => !hasFeature(feature), `Requires feature ${feature}`);
        body();
    });
}

/**
 * Records the original manual scenarios a test comes from, keeping the imported
 * CucumberStudio corpus traceable without a separate tracking document.
 *
 * @param {...string} scenarios e.g. 'Maps/CreateDelete — Create a Map (@GH-11458)'
 */
function fromScenario(...scenarios) {
    return { annotation: scenarios.map((description) => ({ type: 'cucumber', description })) };
}

export { test, expect, describeIfFeature, fromScenario };
