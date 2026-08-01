/* eslint-disable no-console */

/**
 * Removes fixtures left behind by an interrupted run, so every run starts from the
 * same state and the suites stay idempotent.
 *
 * Failures are reported but never fatal: an instance with a read-only user store
 * (LDAP-direct profile) rejects the user and group lookups, and the suites that
 * need them are feature-gated anyway.
 */

import { createGeoStoreClient, FIXTURE_PREFIX } from './api/geostore.js';

async function globalSetup() {
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

export default globalSetup;
