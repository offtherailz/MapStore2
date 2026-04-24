/**
 * MapStore2 test credentials and base URL.
 * All values can be overridden using environment variables.
 */
export const config = {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8081/',
    adminUser: process.env.MS_USER ?? 'admin',
    adminPassword: process.env.MS_PASSWORD ?? 'admin',
};
