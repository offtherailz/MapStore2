function parseBoolean(value) {
    return /^(1|true|yes|on)$/i.test(value ?? '');
}

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

const namedCapabilities = {
    geoserverMapStoreUsers: parseBoolean(process.env.GEOSERVER_MAPSTORE_USERS),
    ldap: parseBoolean(process.env.LDAP_ENABLED),
    oidc: parseBoolean(process.env.OIDC_ENABLED)
};

const listedCapabilities = parseList(process.env.E2E_CAPABILITIES).reduce(
    (capabilities, capability) => ({ ...capabilities, [capability]: true }),
    {}
);

const environment = {
    name: process.env.E2E_ENV ?? 'local',
    baseURL: process.env.BASE_URL ?? 'http://localhost:8081/',
    admin: {
        username: process.env.MS_USER ?? 'admin',
        password: process.env.MS_PASSWORD ?? 'admin'
    },
    user: {
        username: process.env.MS_USER_STANDARD ?? '',
        password: process.env.MS_PASSWORD_STANDARD ?? ''
    },
    capabilities: {
        ...listedCapabilities,
        ...namedCapabilities
    },
    services: parseJsonRecord(process.env.E2E_SERVICES_JSON),
    resources: parseJsonRecord(process.env.E2E_RESOURCES_JSON)
};

const config = {
    baseURL: environment.baseURL,
    adminUser: environment.admin.username,
    adminPassword: environment.admin.password
};

function hasCapability(name) {
    return Boolean(environment.capabilities[name]);
}

function getServiceUrl(name) {
    return environment.services[name] ?? '';
}

function getResource(name) {
    return environment.resources[name] ?? '';
}

module.exports = { environment, config, hasCapability, getServiceUrl, getResource };
