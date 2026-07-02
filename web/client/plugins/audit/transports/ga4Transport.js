
let ga4Loaded = false;

/**
 * Dynamically loads the GA4 gtag.js script and initializes it.
 * Safe to call multiple times — loads only once.
 */
export const loadGa4 = (measurementId) => {
    if (ga4Loaded) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
        script.onload = () => {
            window.dataLayer = window.dataLayer || [];
            window.gtag = function() { window.dataLayer.push(arguments); };
            window.gtag('js', new Date());
            window.gtag('config', measurementId);
            ga4Loaded = true;
            resolve();
        };
        script.onerror = (e) => reject(new Error(`GA4 script load failed: ${e}`));
        document.head.appendChild(script);
    });
};

/**
 * Maps a single audit event to GA4 event parameters.
 * Events carry semantic field names (searchText, lat, lon, attributeName...)
 * before auditKeysParser converts them to key01/key02 for the REST/DB transport.
 * GA4 gets semantic names directly — readable in Explorer without a lookup table.
 * GA4 limits: event name ≤40 chars, param name ≤40 chars, param value ≤100 chars.
 */
const auditEventToGa4 = (event) => {
    const { eventType, resourceType, resourceId, appContext,
            layerUrl, layerName, timestamp, ...rest } = event;

    const params = {
        resource_type: resourceType,
        resource_id: resourceId,
        app_context: appContext,
        layer_name: layerName,
        layer_url: layerUrl ? layerUrl.slice(0, 100) : undefined,
        // spread event-specific semantic fields (searchText, lat, lon, attributeName, etc.)
        ...Object.fromEntries(
            Object.entries(rest)
                .filter(([, v]) => v !== undefined && v !== null)
                .map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, 100) : v])
        )
    };

    Object.keys(params).forEach(k => params[k] === undefined && delete params[k]);
    return { eventName: eventType, params };
};

/**
 * Sends an array of audit events to GA4.
 * No-op if gtag is not loaded.
 */
export const sendToGa4 = (events = []) => {
    if (!window.gtag) {
        console.warn('GA4 transport: gtag not loaded, skipping send');
        return;
    }
    events.forEach(event => {
        const { eventName, params } = auditEventToGa4(event);
        window.gtag('event', eventName, params);
    });
};
