

/**
 * Route patterns for all resource types
 * Note: Order matters - more specific patterns should be checked first
 */
const ROUTE_PATTERNS = {
    dashboard: /\/dashboard\/([^\/]+)/,
    geostory: /\/geostory\/([^\/]+)/,
    map: /\/viewer\/([^\/]+)/,
    contextMap: /\/context\/([^\/]+)\/([^\/]+)/,
    context: /\/context\/([^\/]+)$/,
    homePage: /^\/$/
};

/**
 * Resource type constants
 */
const RESOURCE_TYPES = {
    DASHBOARD: 'DASHBOARD',
    GEOSTORY: 'GEOSTORY',
    MAP: 'MAP',
    CONTEXT_MAP: 'CONTEXT_MAP',
    CONTEXT: 'CONTEXT',
    HOME_PAGE: 'HOME_PAGE'
};

/**
 * Detects the resource type from the pathname
 * @param {string} pathname - Current pathname
 * @returns {Object} Object with resourceType and pattern match
 */
export const detectResourceType = (pathname) => {
    if (!pathname) {
        return { type: null, match: null };
    }

    // Check contextMap first (more specific pattern: /context/xxx/123)
    if (ROUTE_PATTERNS.contextMap.test(pathname)) {
        return {
            type: RESOURCE_TYPES.CONTEXT_MAP,
            match: pathname.match(ROUTE_PATTERNS.contextMap)
        };
    }

    // Then check context (less specific: /context/xxx)
    if (ROUTE_PATTERNS.context.test(pathname)) {
        return {
            type: RESOURCE_TYPES.CONTEXT,
            match: pathname.match(ROUTE_PATTERNS.context)
        };
    }

    // Check dashboard
    if (ROUTE_PATTERNS.dashboard.test(pathname)) {
        return {
            type: RESOURCE_TYPES.DASHBOARD,
            match: pathname.match(ROUTE_PATTERNS.dashboard)
        };
    }

    // Check geoStory
    if (ROUTE_PATTERNS.geostory.test(pathname)) {
        return {
            type: RESOURCE_TYPES.GEOSTORY,
            match: pathname.match(ROUTE_PATTERNS.geostory)
        };
    }

    // Check map/viewer
    if (ROUTE_PATTERNS.map.test(pathname)) {
        return {
            type: RESOURCE_TYPES.MAP,
            match: pathname.match(ROUTE_PATTERNS.map)
        };
    }

    // Check home page (root path)
    if (ROUTE_PATTERNS.homePage.test(pathname)) {
        return {
            type: RESOURCE_TYPES.HOME_PAGE,
            match: pathname.match(ROUTE_PATTERNS.homePage)
        };
    }

    // Default to null for unknown routes
    return { type: null, match: null };
};

/**
 * Extracts resource ID from the pattern match
 * @param {string} resourceType - Type of resource
 * @param {Array} match - Regex match result
 * @returns {string|null} Resource ID or null
 */
export const extractResourceId = (resourceType, match) => {
    if (!match) return null;

    // For CONTEXT_MAP, we want the second capture group (mapId)
    if (resourceType === RESOURCE_TYPES.CONTEXT_MAP) {
        return match[2] || null;
    }

    // For CONTEXT with just context path, we don't extract resource ID
    if (resourceType === RESOURCE_TYPES.CONTEXT) {
        return null;
    }

    // For HOME_PAGE, no resource ID
    if (resourceType === RESOURCE_TYPES.HOME_PAGE) {
        return null;
    }

    // For all other types (DASHBOARD, GEOSTORY, MAP), return the first capture group
    return match[1] || null;
};

/**
 * Extracts appContext (context name) from the pattern match
 * @param {string} resourceType - Type of resource
 * @param {Array} match - Regex match result
 * @returns {string|null} Context name or null
 */
export const extractAppContext = (resourceType, match) => {
    if (!match) return null;

    // For CONTEXT and CONTEXT_MAP, match[1] is the context name
    if (resourceType === RESOURCE_TYPES.CONTEXT || resourceType === RESOURCE_TYPES.CONTEXT_MAP) {
        return match[1] || null;
    }

    // For other resource types, no appContext from URL
    return null;
};

/**
 * Gets the current resource context based on the pathname
 * Extracts resourceType, resourceId, and appContext from URL patterns
 * @param {string} pathname - Current pathname from router
 * @returns {Object} Resource context information
 */
export const getResourceRelatedMetadata = (pathname) => {
    const currentPathname = pathname || '';

    // Detect resource type using pattern matching
    const { type: resourceType, match } = detectResourceType(currentPathname);

    // If no resource type detected, return default (home page)
    if (!resourceType) {
        return {
            resourceType: null,
            resourceId: null,
            appContext: null
        };
    }

    // Extract resource ID based on resource type and match
    const resourceId = extractResourceId(resourceType, match);

    // Extract appContext (context name) from URL for context-based routes
    const appContext = extractAppContext(resourceType, match);

    return {
        resourceType,
        resourceId,
        appContext
    };
};

/**
 * Enriches audit data by merging standard data with additional data
 * @param {Object} standardData - Standard audit fields (eventType, resourceType, resourceId, appContext)
 * @param {Object} additionalData - Additional action-specific data (optional)
 * @returns {Object} Enriched audit data
 */
export const enrichAuditData = (standardData, additionalData = {}) => {
    return {
        ...standardData,
        ...additionalData
    };
};

/**
 * Checks if a pathname is accessing an existing resource (not creating a new one)
 * Used to filter out RESOURCE_ACCESS events during new resource creation
 *
 * @param {string} pathname - The pathname to check
 * @returns {boolean} true if accessing existing resource, false if creating new
 */
export const isPathForExistingResource = (pathname) => {
    if (!pathname) return false;
    // Exclude pathnames that indicate new resource creation
    return !pathname.includes('/new') &&
           !pathname.includes('/newgeostory') &&
           !pathname.match(/\/dashboard\/?$/);
};

/**
 * Generates standard audit fields from Redux state
 * This is used by the generic audit epic to add standard metadata
 * Standard fields: eventType, resourceType, resourceId, appContext
 *
 * @param {Object} state - Redux state
 * @param {string} eventType - Type of event
 * @returns {Object} Standard audit fields
 */
export const generateStandardAuditFields = (state, eventType) => {
    const pathname = state.router?.location?.pathname;

    const resourceContext = getResourceRelatedMetadata(pathname);

    return {
        eventType,
        ...resourceContext
    };
};

/**
 * Bidirectional parser to convert between client-side field names and database column names
 *
 * Standard fields (eventType, resourceType, resourceId, appContext, timestamp) and
 * dedicated columns (layer_url, layer_name) are always kept as-is.
 *
 * @param {Object} data - Audit data to transform
 * @param {Object} keysMap - Mapping { key1: 'fieldName', key2: 'anotherField', ... } [DBkey: clientKey]
 * @param {boolean} reverse - If true, converts DB keys → client fields; if false, client fields → DB keys
 * @returns {Object} Transformed data
 *
 * @example
 * // Client to DB
 * auditKeysParser(
 *   { eventType: 'SEARCH', service: 'nominatim', searchText: 'Paris' },
 *   { key1: 'service', key2: 'searchText' },
 *   false
 * )
 * // => { eventType: 'SEARCH', key1: 'nominatim', key2: 'Paris' }
 *
 * @example
 * // DB to Client
 * auditKeysParser(
 *   { eventType: 'SEARCH', key1: 'nominatim', key2: 'Paris' },
 *   { key1: 'service', key2: 'searchText' },
 *   true
 * )
 * // => { eventType: 'SEARCH', service: 'nominatim', searchText: 'Paris' }
 */
export const auditKeysParser = (data, keysMap = {}, reverse = false) => {
    if (!data) return data;

    const preservedFields = ['eventType', 'resourceType', 'resourceId', 'appContext', 'timestamp', 'layerUrl', 'layerName'];

    // Build mapping based on direction
    const mapping = reverse
        ? keysMap // DB → Client
        : Object.fromEntries(Object.entries(keysMap).map(([k, v]) => [v, k])); // Client → DB: reverse the map

    const result = {};
    Object.entries(data).forEach(([key, value]) => {
        result[preservedFields.includes(key) ? key : (mapping[key] || key)] = value;
    });

    return result;
};
