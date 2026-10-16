/* eslint-disable no-console */

/**
 * Prepares the instance before any suite runs:
 *
 * 1. checks that the administrator credentials are accepted, so a wrong environment
 *    fails once with a clear message instead of in every test;
 * 2. removes fixtures left behind by an interrupted run, so every run starts from the
 *    same state and the suites stay idempotent.
 *
 * Fixture cleanup failures are reported but never fatal: an instance with a read-only
 * user store (LDAP-direct profile) rejects the user and group lookups, and the suites
 * that need them are feature-gated anyway.
 */

import { createGeoStoreClient, FIXTURE_PREFIX } from './api/geostore.js';
import { config } from './config.js';

/**
 * @returns {Promise<{status: number, id?: number}>} status of the details request
 * and, when authenticated, the id of the user
 */
async function authenticate(username, password) {
    const client = await createGeoStoreClient({ username, password });

    try {
        const user = await client.whoAmI();

        return { status: 200, id: Number(user?.id) };
    } catch (error) {
        const status = Number(/failed: (\d{3})/.exec(error.message)?.[1] ?? 0);

        if (!status) {
            throw error;
        }

        return { status };
    } finally {
        await client.dispose();
    }
}

/**
 * Disposable stacks built from a version that still seeded admin/admin ignore
 * INITIAL_ADMIN_PASSWORD. Their administrator is moved to the configured password,
 * so the suites use the same credentials on every version.
 */
async function adoptLegacyAdministrator() {
    const legacy = await authenticate(config.adminUser, config.legacyAdminPassword);

    if (legacy.status !== 200) {
        return false;
    }

    const client = await createGeoStoreClient({ username: config.adminUser, password: config.legacyAdminPassword });

    try {
        await client.changePassword(legacy.id, config.adminPassword);
    } finally {
        await client.dispose();
    }

    console.log(`[e2e] '${config.adminUser}' still had the former default password: changed to MS_PASSWORD`);

    return true;
}

async function checkAdministrator() {
    if (!config.adminPassword) {
        throw new Error(
            '[e2e] MS_PASSWORD is not set. MapStore has no default administrator password: '
            + 'use the one the instance was initialized with (INITIAL_ADMIN_PASSWORD).'
        );
    }

    const { status } = await authenticate(config.adminUser, config.adminPassword);

    if (status === 200) {
        return;
    }

    if (status !== 401) {
        // Some user stores (LDAP direct) do not expose the details endpoint: the
        // login suites are then the ones that tell whether the credentials work.
        console.warn(`[e2e] administrator check inconclusive (HTTP ${status}), continuing`);
        return;
    }

    if (config.legacyAdminPassword && await adoptLegacyAdministrator()) {
        return;
    }

    throw new Error(
        `[e2e] the instance at ${config.baseURL} rejects MS_USER '${config.adminUser}' (HTTP ${status}). `
        + 'Check BASE_URL, MS_USER and MS_PASSWORD.'
    );
}

async function cleanFixtures() {
    let client;

    try {
        client = await createGeoStoreClient();
        const removed = await client.deleteFixtures(FIXTURE_PREFIX);
        const total = removed.resources + removed.users + removed.groups;

        if (total > 0) {
            console.log(
                `[e2e] cleaned ${total} leftover ${FIXTURE_PREFIX}* fixtures `
                + `(${removed.resources} resources, ${removed.users} users, ${removed.groups} groups)`
            );
        }
    } catch (error) {
        console.warn(`[e2e] fixture cleanup skipped: ${error.message}`);
    } finally {
        await client?.dispose();
    }
}

async function globalSetup() {
    await checkAdministrator();
    await cleanFixtures();
}

export default globalSetup;
