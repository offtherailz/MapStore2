/**
 * Minimal GeoStore REST client used by the E2E fixtures.
 *
 * Test data is created and removed through the API rather than the UI: setup stays
 * fast, and teardown still works when the UI step under test has failed. Specs that
 * validate a UI flow assert through the UI and clean up through this client.
 */

import { request } from '@playwright/test';
import { config } from '../config.js';

/** Resource categories handled by the homepage. */
const CATEGORIES = ['MAP', 'DASHBOARD', 'GEOSTORY', 'CONTEXT'];

/** Prefix every fixture name carries, so leftovers are always identifiable. */
const FIXTURE_PREFIX = 'E2E_';

function restBaseUrl(baseURL = config.baseURL) {
    const base = baseURL.endsWith('/') ? baseURL : `${baseURL}/`;

    return `${base}rest/geostore/`;
}

function basicAuth(username, password) {
    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

/** GeoStore wraps lists differently per endpoint; normalize to a plain array. */
function toArray(value) {
    if (!value) {
        return [];
    }

    return Array.isArray(value) ? value : [value];
}

function extractList(body, itemKey) {
    if (!body || typeof body !== 'object') {
        return [];
    }

    if (Array.isArray(body.results)) {
        return body.results;
    }

    if (body.results && typeof body.results === 'object') {
        return [body.results];
    }

    const wrapper = Object.values(body).find((value) => value && typeof value === 'object' && value[itemKey]);

    return wrapper ? toArray(wrapper[itemKey]) : [];
}

function uniqueName(bundle, label) {
    const suffix = Math.random().toString(36).slice(2, 8);

    return `${FIXTURE_PREFIX}${bundle}_${label}_${suffix}`;
}

/**
 * Builds an authenticated GeoStore client.
 *
 * @param {object} [options]
 * @param {string} [options.username] defaults to the configured administrator
 * @param {string} [options.password]
 * @param {string} [options.baseURL] defaults to the configured MapStore base URL
 */
async function createGeoStoreClient({ username, password, baseURL } = {}) {
    const user = username ?? config.adminUser;
    const secret = password ?? config.adminPassword;

    // Accept is set per request, not on the context: GeoStore answers the id of a
    // created resource as text/plain and rejects a JSON-only Accept with 406.
    const context = await request.newContext({
        baseURL: restBaseUrl(baseURL),
        extraHTTPHeaders: {
            Authorization: basicAuth(user, secret)
        }
    });

    async function expectOk(response, action) {
        if (!response.ok()) {
            throw new Error(`GeoStore ${action} failed: ${response.status()} ${await response.text()}`);
        }

        return response;
    }

    async function json(path) {
        const response = await expectOk(
            await context.get(path, { headers: { Accept: 'application/json' } }),
            `GET ${path}`
        );

        return response.json();
    }

    /** Verifies the credentials, so a wrong environment fails with a clear message. */
    async function whoAmI() {
        const details = await json('users/user/details?includeattributes=true');

        return details?.User ?? details;
    }

    // ── users ────────────────────────────────────────────────────────────────

    async function createUser({ name, password: userPassword, role = 'USER', enabled = true }) {
        const response = await expectOk(await context.post('users/', {
            data: { User: { name, newPassword: userPassword, password: userPassword, role, enabled } }
        }), `create user ${name}`);

        return { id: Number(await response.text()), name, password: userPassword, role };
    }

    async function findUsers(textSearch = FIXTURE_PREFIX) {
        return extractList(await json(`extjs/search/users/${encodeURIComponent(textSearch)}`), 'User');
    }

    async function deleteUser(id) {
        await expectOk(await context.delete(`users/user/${id}`), `delete user ${id}`);
    }

    // ── groups ───────────────────────────────────────────────────────────────

    async function createGroup({ groupName, description = 'Created by the E2E suite' }) {
        const response = await expectOk(await context.post('usergroups/', {
            data: { UserGroup: { groupName, description } }
        }), `create group ${groupName}`);

        return { id: Number(await response.text()), groupName };
    }

    async function findGroups(textSearch = FIXTURE_PREFIX) {
        return extractList(await json(`extjs/search/groups/${encodeURIComponent(textSearch)}`), 'UserGroup');
    }

    async function deleteGroup(id) {
        await expectOk(await context.delete(`usergroups/group/${id}`), `delete group ${id}`);
    }

    async function addUserToGroup(userId, groupId) {
        await expectOk(
            await context.post(`usergroups/group/${userId}/${groupId}/`),
            `add user ${userId} to group ${groupId}`
        );
    }

    // ── resources ────────────────────────────────────────────────────────────

    /**
     * @param {object} resource
     * @param {string} resource.name
     * @param {string} [resource.description]
     * @param {string} [resource.category] MAP, DASHBOARD, GEOSTORY, CONTEXT
     * @param {object|string} [resource.data] resource payload, defaults to an empty map
     */
    async function createResource({ name, description = '', category = 'MAP', data = {} }) {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        const response = await expectOk(await context.post('resources/', {
            headers: { 'Content-Type': 'application/xml' },
            data: `<Resource><metadata></metadata><name>${name}</name><description>${description}</description>`
                + `<category><name>${category}</name></category>`
                + `<store><data><![CDATA[${payload}]]></data></store></Resource>`
        }), `create ${category} ${name}`);

        return { id: Number(await response.text()), name, category };
    }

    async function findResources(category, textSearch = FIXTURE_PREFIX) {
        const path = `extjs/search/category/${category}/*${encodeURIComponent(textSearch)}*/thumbnail,details,featured`;
        const response = await context.get(path, { headers: { Accept: 'application/json' } });

        // A category with no resources answers 404 on some GeoStore versions.
        if (response.status() === 404) {
            return [];
        }

        await expectOk(response, `search ${category}`);

        return extractList(await response.json(), 'Resource');
    }

    async function deleteResource(id) {
        const response = await context.delete(`resources/resource/${id}`);

        // Already gone is a success for teardown purposes.
        if (response.status() !== 404) {
            await expectOk(response, `delete resource ${id}`);
        }
    }

    // ── teardown ─────────────────────────────────────────────────────────────

    /**
     * Removes every leftover fixture. Runs in globalSetup so a run that follows a
     * crashed one still starts from a clean instance.
     *
     * @returns {Promise<{resources: number, users: number, groups: number}>}
     */
    async function deleteFixtures(prefix = FIXTURE_PREFIX) {
        const removed = { resources: 0, users: 0, groups: 0 };

        for (const category of CATEGORIES) {
            const resources = await findResources(category, prefix);

            for (const resource of resources) {
                if (String(resource.name ?? '').startsWith(prefix)) {
                    await deleteResource(resource.id);
                    removed.resources += 1;
                }
            }
        }

        for (const fixtureUser of await findUsers(prefix)) {
            if (String(fixtureUser.name ?? '').startsWith(prefix)) {
                await deleteUser(fixtureUser.id);
                removed.users += 1;
            }
        }

        for (const group of await findGroups(prefix)) {
            if (String(group.groupName ?? '').startsWith(prefix)) {
                await deleteGroup(group.id);
                removed.groups += 1;
            }
        }

        return removed;
    }

    async function dispose() {
        await context.dispose();
    }

    return {
        context,
        whoAmI,
        createUser,
        findUsers,
        deleteUser,
        createGroup,
        findGroups,
        deleteGroup,
        addUserToGroup,
        createResource,
        findResources,
        deleteResource,
        deleteFixtures,
        dispose
    };
}

export { CATEGORIES, FIXTURE_PREFIX, createGeoStoreClient, uniqueName };
