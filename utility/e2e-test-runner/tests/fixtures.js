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
 * @property {(label: string) => string} name unique fixture name, not persisted
 * @property {(resource: object) => void} track adopt an object created by the UI
 */

const test = base.extend({
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
        const created = { resources: [], users: [], groups: [] };

        const factory = {
            name: (label) => uniqueName(bundle, label),

            track: ({ id, name, category = 'MAP' }) => {
                created.resources.push({ id, name, category });
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
 * Records the original manual scenario a test comes from, keeping the imported
 * CucumberStudio corpus traceable without a separate tracking document.
 *
 * @param {string} scenario e.g. 'Maps/CreateDelete — Create a Map (@GH-11458)'
 */
function fromScenario(scenario) {
    return { annotation: { type: 'cucumber', description: scenario } };
}

export { test, expect, describeIfFeature, fromScenario };
