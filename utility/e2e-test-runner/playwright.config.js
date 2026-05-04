import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { loadE2EEnv } from './loadEnv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { envFile, envName } = loadE2EEnv();
const baseURL = process.env.BASE_URL ?? 'http://localhost:8081/';

export default defineConfig({
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
