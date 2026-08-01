/**
 * Environment contract for the E2E suites.
 *
 * Everything environment specific is injected through variables, so the same
 * suites run against a local Docker stack, a QA server or a customer instance.
 * No spec may hardcode a host, a credential or a remote service URL.
 */

/** Feature gates a suite can require through `hasFeature`. */
const KNOWN_FEATURES = [
    'ldap',                  // LDAP user store (WAR built with -Pldap)
    'oidc',                  // OpenID Connect provider configured (Keycloak sample)
    'geoserverIntegration',  // a GeoServer is reachable and preconfigured in the catalog
    'geoserverDb',           // that GeoServer publishes the PostGIS fixture layer
    'cesium',                // 3D viewer available
    'printing',              // printing module deployed
    'rulesManager',          // GeoFence rules manager available
    'mobile'                 // run the mobile-viewport variants
];

function parseList(value) {
    return (value ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function parseJsonRecord(value) {
    if (!value) {
        return {};
    }

    try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
        return {};
    }
}

const listedFeatures = parseList(process.env.E2E_FEATURES).reduce(
    (features, feature) => ({ ...features, [feature]: true }),
    {}
);

const admin = {
    username: process.env.MS_USER ?? 'admin',
    password: process.env.MS_PASSWORD ?? 'admin',
    role: 'ADMIN'
};

const standardUser = {
    username: process.env.MS_USER_STANDARD ?? '',
    password: process.env.MS_PASSWORD_STANDARD ?? '',
    role: 'USER'
};

/**
 * Named identities, so specs refer to a role ("ldapUser") instead of raw
 * credentials. `admin` and `standardUser` are always defined; profile specific
 * ones come from E2E_IDENTITIES_JSON, for example:
 *
 *   {"ldapUser":{"username":"ldapuser","password":"…","role":"USER"}}
 *
 * An identity may declare a `provider` when login goes through an external
 * identity provider button instead of the basic login form.
 */
const identities = {
    admin,
    standardUser,
    ...parseJsonRecord(process.env.E2E_IDENTITIES_JSON)
};

const environment = {
    name: process.env.E2E_ENV ?? 'local',
    baseURL: process.env.BASE_URL ?? 'http://localhost:8081/',
    admin,
    user: standardUser,
    identities,
    features: listedFeatures,
    services: parseJsonRecord(process.env.E2E_SERVICES_JSON),
    resources: parseJsonRecord(process.env.E2E_RESOURCES_JSON)
};

const config = {
    baseURL: environment.baseURL,
    adminUser: environment.admin.username,
    adminPassword: environment.admin.password
};

function hasFeature(name) {
    return Boolean(environment.features[name]);
}

/**
 * @param {string} name identity name, see `identities`
 * @returns {{username: string, password: string, role?: string, provider?: string}|undefined}
 */
function getIdentity(name) {
    const identity = environment.identities[name];

    return identity && identity.username ? identity : undefined;
}

function getServiceUrl(name) {
    return environment.services[name] ?? '';
}

function getResource(name) {
    return environment.resources[name] ?? '';
}

export {
    KNOWN_FEATURES,
    environment,
    config,
    hasFeature,
    getIdentity,
    getServiceUrl,
    getResource
};
