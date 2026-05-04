import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { loadE2EEnv } from './loadEnv';

const { envFile, envName } = loadE2EEnv();
const baseURL = process.env.BASE_URL ?? 'http://localhost:8081/';

/**
 * MapStore2 Playwright E2E Test Configuration
 *
 * Base URL and credentials can be overridden via environment variables:
 *   BASE_URL   - default: http://localhost:8081/
 *   MS_USER    - default: admin
 *   MS_PASSWORD - default: admin
 */
export default defineConfig({
    testDir: path.join(__dirname, '..', 'tools', 'playwright-subset-runner', 'tests'),
    metadata: {
        envName,
        envFile: envFile ?? 'process.env'
    },
    /* Run tests in files in parallel */
    fullyParallel: false,
    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,
    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,
    /* Run tests sequentially in CI to avoid flakiness */
    workers: process.env.CI ? 1 : 1,
    /* Reporter to use */
    reporter: [
        ['html', { outputFolder: 'reports/html', open: 'never' }],
        ['list']
    ],
    /* Shared settings for all tests */
    use: {
        /* Base URL - override with BASE_URL env variable */
        baseURL,
        /* Collect traces on first retry */
        trace: 'on-first-retry',
        /* Take screenshot on failure */
        screenshot: 'only-on-failure',
        /* Record video on first retry */
        video: 'on-first-retry',
        /* Increase timeout for map-heavy pages */
        actionTimeout: 15000,
        navigationTimeout: 30000,
    },
    /* Global timeout per test */
    timeout: 60000,
    /* Directory for test artifacts */
    outputDir: 'reports/test-results',

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        /* Uncomment to also test on Firefox and WebKit:
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
        */
    ],
});
