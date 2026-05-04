const path = require('node:path');
const { defineConfig, devices } = require('@playwright/test');
const { loadE2EEnv } = require('./loadEnv');

const { envFile, envName } = loadE2EEnv();
const baseURL = process.env.BASE_URL ?? 'http://localhost:8081/';

module.exports = defineConfig({
    testDir: path.join(__dirname, 'tests'),
    metadata: {
        envName,
        envFile: envFile ?? 'process.env'
    },
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : 1,
    reporter: [
        ['html', { outputFolder: path.join(process.cwd(), 'reports', 'html'), open: 'never' }],
        ['list']
    ],
    use: {
        baseURL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'on-first-retry',
        actionTimeout: 15000,
        navigationTimeout: 30000
    },
    timeout: 60000,
    outputDir: path.join(process.cwd(), 'reports', 'test-results'),
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }
    ]
});
