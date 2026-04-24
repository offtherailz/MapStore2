# MapStore2 — End-to-End Testing Guide (Playwright)

> **Audience:** QA engineers and testers who need to write, run, or record automated browser tests for MapStore2.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Repository structure](#2-repository-structure)
3. [Environment setup](#3-environment-setup)
4. [Running the tests](#4-running-the-tests)
5. [Recording a new test with Codegen](#5-recording-a-new-test-with-codegen)
6. [Writing tests manually](#6-writing-tests-manually)
7. [Page helpers and utilities](#7-page-helpers-and-utilities)
8. [Reports and artifacts](#8-reports-and-artifacts)
9. [CI environment variables](#9-ci-environment-variables)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

| Requirement | Version |
| --- | --- |
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| MapStore2 running instance | reachable via HTTP |

Playwright and Chromium are already installed in the repository.
If you need to reinstall them:

```bash
npm install
npx playwright install chromium
```

---

## 2. Repository structure

```text
e2e/
├── playwright.config.ts      # Main Playwright configuration
├── .env                      # Local credentials and base URL (git-ignored)
├── .env.example              # Template for .env
├── .gitignore
└── tests/
    ├── config.ts             # Reads env variables (baseURL, credentials)
    ├── helpers/
    │   └── auth.ts           # login() and logout() helpers
    ├── auth.spec.ts          # Example: authentication tests
    └── maps.spec.ts          # Example: maps section tests
```

All test files must end in `.spec.ts`.

---

## 3. Environment setup

1. Copy the template to create your local configuration:

   ```bash
   cp e2e/.env.example e2e/.env
   ```

2. Open `e2e/.env` and set the values for **your** MapStore2 instance:

   ```dotenv
   BASE_URL=http://localhost:8081/   # URL of the running app
   MS_USER=admin                         # Admin username
   MS_PASSWORD=admin                     # Admin password
   ```

   > **Note:** `e2e/.env` is git-ignored; never commit credentials.

---

## 4. Running the tests

All commands are run from the **repository root**.

| Command | Description |
| --- | --- |
| `npm run e2e` | Run all tests headlessly (default, for CI) |
| `npm run e2e:headed` | Run all tests with a visible browser window |
| `npm run e2e:ui` | Open the Playwright interactive UI (recommended for debugging) |
| `npm run e2e:report` | Open the HTML report from the last run |

### Running a specific test file

```bash
npx playwright test e2e/tests/auth.spec.ts --config=e2e/playwright.config.ts
```

### Running a specific test by name

```bash
npx playwright test --config=e2e/playwright.config.ts -g "admin can log in"
```

---

## 5. Recording a new test with Codegen

Playwright's **Codegen** tool opens a browser and records your actions into a test file automatically.

### Step-by-step

1. Make sure MapStore2 is running and `e2e/.env` contains the correct `BASE_URL`.

2. Start the recorder:

   ```bash
   npm run e2e:codegen
   ```

   This opens two windows:
   - **Browser window** — navigate MapStore2 as you would normally.
   - **Playwright Inspector** — shows the generated code in real time.

3. Interact with the application (click buttons, fill forms, navigate pages).
   Each action is captured as a line of TypeScript in the Inspector.

4. When done, click **Copy** in the Inspector and paste the code into a new file inside `e2e/tests/`, for example `e2e/tests/my-feature.spec.ts`.

5. Wrap the recorded code in a proper test structure (see [Section 6](#6-writing-tests-manually)).

6. Run your new test to verify it passes:

   ```bash
   npx playwright test e2e/tests/my-feature.spec.ts --config=e2e/playwright.config.ts --headed
   ```

### Tips for Codegen

- Use `page.getByRole()` and `page.getByLabel()` selectors when possible — they are more stable than CSS selectors.
- Add short `await page.waitForLoadState('networkidle')` calls after navigating to map-heavy pages.
- If a selector is fragile, refine it manually after recording.

---

## 6. Writing tests manually

### Minimal test file

```typescript
// e2e/tests/my-feature.spec.ts
import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('My Feature', () => {

    // Runs before every test in this describe block
    test.beforeEach(async ({ page }) => {
        await login(page);          // log in as admin
    });

    test('feature works correctly', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByRole('heading', { name: 'MapStore' })).toBeVisible();
    });
});
```

### Recommended locator priority

Use these selectors **in order of preference** (most to least stable):

1. `page.getByRole('button', { name: 'Save' })` — semantic role
2. `page.getByLabel('Username')` — form label
3. `page.getByText('Sign in')` — visible text
4. `page.getByTestId('my-data-testid')` — `data-testid` attribute
5. `page.locator('.my-css-class')` — CSS selector (last resort)

### Assertions

```typescript
await expect(element).toBeVisible();
await expect(element).toBeHidden();
await expect(element).toContainText('Expected text');
await expect(page).toHaveURL(/\/mapstore\/home/);
```

### Waiting for network calls

For pages that load data asynchronously (maps, dashboards):

```typescript
await page.waitForLoadState('networkidle');
// or wait for a specific request:
await page.waitForResponse(resp => resp.url().includes('/geostore/') && resp.status() === 200);
```

---

## 7. Page helpers and utilities

### `login(page, username?, password?)`

Navigates to the home page, opens the login dialog, fills in the credentials, and waits for the user to be authenticated.

```typescript
import { login } from './helpers/auth';

await login(page);                         // uses .env credentials
await login(page, 'user1', 'password1');   // custom credentials
```

### `logout(page)`

Clicks the user menu and confirms logout.

```typescript
import { logout } from './helpers/auth';

await logout(page);
```

### `config`

Provides the base URL and default credentials as constants:

```typescript
import { config } from './config';

console.log(config.baseURL);       // http://localhost:8081/
console.log(config.adminUser);     // admin
```

---

## 8. Reports and artifacts

After a test run, artifacts are saved under `e2e/reports/`:

| Artifact | Location | When created |
|---|---|---|
| HTML report | `e2e/reports/html/` | Always |
| Screenshots | `e2e/reports/test-results/` | On failure |
| Videos | `e2e/reports/test-results/` | On first retry |
| Traces | `e2e/reports/test-results/` | On first retry |

Open the HTML report with:

```bash
npm run e2e:report
```

To view a trace file (step-by-step replay of a failed test):

```bash
npx playwright show-trace e2e/reports/test-results/<test-name>/trace.zip
```

---

## 9. CI environment variables

When running in a CI pipeline (GitHub Actions, Jenkins, etc.), pass the variables as environment variables instead of using `.env`:

```yaml
# GitHub Actions example
- name: Run E2E tests
  env:
    BASE_URL: ${{ secrets.MS_BASE_URL }}
    MS_USER: ${{ secrets.MS_USER }}
    MS_PASSWORD: ${{ secrets.MS_PASSWORD }}
    CI: true
  run: npm run e2e
```

The `CI=true` variable activates stricter settings (no `test.only`, 2 retries, 1 worker).

---

## 10. Troubleshooting

### Tests fail with "net::ERR_CONNECTION_REFUSED"

MapStore2 is not reachable at `BASE_URL`. Check:

- The Docker stack is running: `docker compose ps`
- The URL in `e2e/.env` is correct.

### Login helper cannot find the "Sign in" button

The selector may differ from the default. Use the **Playwright Inspector** to identify the correct selector:

```bash
npm run e2e:ui
```

Then refine `e2e/tests/helpers/auth.ts` accordingly.

### Tests are flaky on map pages

Map tiles load asynchronously. Add a `waitForLoadState` or a `waitForResponse` call:

```typescript
await page.waitForLoadState('networkidle');
```

### How to debug a single failing test

```bash
npx playwright test e2e/tests/auth.spec.ts --config=e2e/playwright.config.ts --headed --debug
```

This opens the Playwright Inspector in step-through mode.
