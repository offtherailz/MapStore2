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
├── playwright.config.js      # Main Playwright configuration
├── .env                      # Fallback local credentials and base URL (git-ignored)
├── .env.example              # Template for environment profiles
├── loadEnv.js                # Loads the selected environment profile
├── .gitignore
└── tests/
    ├── config.js             # Reads env variables, capabilities, and services
    ├── helpers/
    │   ├── auth.js           # login() and logout() helpers
    │   └── navigation.js     # Opens app URLs respecting custom base paths
    ├── auth.spec.js          # Example: authentication tests
    └── maps.spec.js          # Example: maps section tests
```

All test files must end in `.spec.js`.

---

## 3. Environment setup

1. Copy the template to create your local or customer-specific configuration:

   ```bash
   cp e2e/.env.example e2e/.env
   ```

2. Open `e2e/.env` and set the values for your target environment:

   ```dotenv
   BASE_URL=http://localhost:8081/   # local dev
   MS_USER=admin                     # Admin username
   MS_PASSWORD=admin                 # Admin password
   ```

   Common `BASE_URL` examples:

   ```dotenv
   BASE_URL=http://localhost:8081/
   BASE_URL=https://qa-mapstore.example/mapstore/
   BASE_URL=https://customer.example/sit/mapstore/
   ```

   If your tests are trying to open `http://localhost/mapstore/#/`, it means your current `e2e/.env` is pointing there. For local development the expected value is usually `http://localhost:8081/`, not `http://localhost/mapstore`.

   > **Note:** `e2e/.env` is git-ignored; never commit credentials.

### Environment profiles

An E2E environment can be local, shared QA/DEV, or a customer deployment. The minimum contract is:

- `BASE_URL`: full application URL, including any base path
- `MS_USER` and `MS_PASSWORD`: admin account for setup and privileged checks

Optional parts of the contract are:

- feature flags such as `GEOSERVER_MAPSTORE_USERS`, `LDAP_ENABLED`, `OIDC_ENABLED`
- extra capabilities listed in `E2E_CAPABILITIES`
- third-party endpoints in `E2E_SERVICES_JSON`
- environment-specific maps, contexts, and other data in `E2E_RESOURCES_JSON`

Examples:

```bash
cp e2e/.env.example e2e/.env.local
cp e2e/.env.example e2e/.env.qa
cp e2e/.env.example e2e/.env.customer-acme
```

Then select the profile at runtime:

```bash
E2E_ENV=local npm run e2e
E2E_ENV=qa npm run e2e:headed
E2E_ENV_FILE=e2e/.env.customer-acme npm run e2e
```

---

## 4. Running the tests

All commands are run from the **repository root**.

| Command | Description |
| --- | --- |
| `npm run e2e` | Run all tests headlessly (default, for CI) |
| `npm run e2e:headed` | Run all tests with a visible browser window |
| `npm run e2e:ui` | Open the Playwright interactive UI (recommended for debugging) |
| `npm run e2e -- --suites <name>` | Run one or more named suites from `e2e/suites.json` |
| `npm run e2e:suites` | List configured suites and defaults |
| `npm run e2e:raw` | Run Playwright directly, bypassing suite selection |
| `npm run e2e:report` | Open the HTML report from the last run |

You can pass additional Playwright arguments through the existing npm scripts with `--`.

### Running a specific test file

```bash
npm run e2e -- e2e/tests/auth.spec.js
```

### Running a specific test by name

```bash
npm run e2e -- -g "admin can log in"
```

### Running a specific line in a test file

```bash
npm run e2e -- e2e/tests/auth.spec.js:10
```

### Running only one browser

```bash
npm run e2e -- --project=chromium
```

### Running only part of the migration

Run one spec against one environment:

```bash
E2E_ENV=qa npm run e2e -- e2e/tests/project_export_auth.spec.js
```

Run the current project export specs only:

```bash
E2E_ENV=local npx playwright test e2e/tests/project_export_*.spec.js --config=e2e/playwright.config.js
```

Run a subset by title:

```bash
E2E_ENV_FILE=e2e/.env.customer-acme npm run e2e -- -g "Homepage"
```

Run tests from one file and one scenario title together:

```bash
E2E_ENV=local npm run e2e -- e2e/tests/auth.spec.js -g "admin can log in"
```

### Running independent named subsets

Use the default `npm run e2e` command and pass subsets only when needed.

Without `--suites`, it runs the preconfigured default/active suites.

List available suites:

```bash
npm run e2e:suites
```

Run a suite:

```bash
npm run e2e -- --suites auth
```

Run multiple suites:

```bash
npm run e2e -- --suites auth,smoke
```

Run a suite on a specific environment and browser:

```bash
E2E_ENV=qa npm run e2e -- --suites smoke --project chromium
```

Run in UI mode:

```bash
npm run e2e:ui -- --suites auth
```

Override title matching at runtime:

```bash
npm run e2e -- --suites auth --grep "log in"
```

How this helps portability:

- `e2e/suites.json` contains suite names, test files, and a plain-language description of purpose.
- You can copy `runner.js` and `suites.json` into another project, then only adapt file paths and suite descriptions.
- The natural-language `title` and `why` fields explain to the executor what is being validated and why.

### Reusing as an `npx` package

The runner is a standalone CLI package (`utility/e2e-test-runner`) that bundles the test files and a Playwright config. Once published, no test files are needed on the consumer side.

#### Running against a custom environment

Pass environment variables before the `npx` command. No config file is required.

```bash
# Run the default suites against a custom instance
BASE_URL=https://mapstore.custom.example.com/mapstore \
  MS_USER=admin \
  MS_PASSWORD=secret123 \
  npx @mapstore/e2e-test-runner

# Run only the auth suite in headed mode
BASE_URL=https://mapstore.custom.example.com/mapstore \
  MS_USER=admin \
  MS_PASSWORD=secret123 \
  npx @mapstore/e2e-test-runner --suites auth --headed

# Enable optional capabilities (e.g. the instance has GeoServer user sync)
BASE_URL=https://mapstore.custom.example.com/mapstore \
  MS_USER=admin \
  MS_PASSWORD=secret123 \
  GEOSERVER_MAPSTORE_USERS=true \
  npx @mapstore/e2e-test-runner --suites auth,geoserver
```

Alternatively, put the variables in a `.env` file and reference it:

```bash
# .env.custom-acme
BASE_URL=https://mapstore.custom.example.com/mapstore
MS_USER=admin
MS_PASSWORD=secret123
GEOSERVER_MAPSTORE_USERS=true
```

```bash
E2E_ENV_FILE=.env.custom-acme npx @mapstore/e2e-test-runner --suites auth
```

#### Listing available suites

```bash
npx @mapstore/e2e-test-runner --list-suites
```

#### Dry-run (list tests without running them)

```bash
npx @mapstore/e2e-test-runner --suites auth --list
```

#### Adding custom suites on top of the bundled ones

Create a `my-suites.json` file next to your custom test files:

```json
{
  "version": 1,
  "defaults": ["my-feature"],
  "suites": {
    "my-feature": {
      "title": "My custom feature",
      "why": "Validate a custom specific workflow not covered by standard suites.",
      "files": ["tests/my-feature.spec.js"],
      "grep": "My custom feature"
    }
  }
}
```

Then run with your manifest (file paths are resolved relative to `my-suites.json`):

```bash
BASE_URL=https://mapstore.custom.example.com/mapstore \
  npx @mapstore/e2e-test-runner --suites-file ./my-suites.json --suites my-feature
```

#### Local execution (without publishing)

```bash
node utility/e2e-test-runner/bin/e2e-test-runner.js --list-suites
node utility/e2e-test-runner/bin/e2e-test-runner.js --suites auth --list
```

#### Publish flow

1. `cd utility/e2e-test-runner`
2. `npm version patch`
3. `npm publish --access public` (or your private registry configuration)

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

4. When done, click **Copy** in the Inspector and paste the code into a new file inside `e2e/tests/`, for example `e2e/tests/my-feature.spec.js`.

5. Wrap the recorded code in a proper test structure (see [Section 6](#6-writing-tests-manually)).

6. Run your new test to verify it passes:

   ```bash
   npx playwright test e2e/tests/my-feature.spec.js --config=e2e/playwright.config.js --headed
   ```

### Tips for Codegen

- Use `page.getByRole()` and `page.getByLabel()` selectors when possible — they are more stable than CSS selectors.
- Add short `await page.waitForLoadState('networkidle')` calls after navigating to map-heavy pages.
- If a selector is fragile, refine it manually after recording.

---

## 6. Writing tests manually

### Minimal test file

```javascript
// e2e/tests/my-feature.spec.js
const { test, expect } = require('@playwright/test');
const { login } = require('./helpers/auth');

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

```javascript
await expect(element).toBeVisible();
await expect(element).toBeHidden();
await expect(element).toContainText('Expected text');
await expect(page).toHaveURL(/\/mapstore\/home/);
```

### Waiting for network calls

For pages that load data asynchronously (maps, dashboards):

```javascript
await page.waitForLoadState('networkidle');
// or wait for a specific request:
await page.waitForResponse(resp => resp.url().includes('/geostore/') && resp.status() === 200);
```

---

## 7. Page helpers and utilities

### `login(page, username?, password?)`

Navigates to the home page, opens the login dialog, fills in the credentials, and waits for the user to be authenticated.

```javascript
const { login } = require('./helpers/auth');

await login(page);                         // uses .env credentials
await login(page, 'user1', 'password1');   // custom credentials
```

### `logout(page)`

Clicks the user menu and confirms logout.

```javascript
const { logout } = require('./helpers/auth');

await logout(page);
```

### `config`

Provides the base URL and default credentials as constants:

```javascript
const { config } = require('./config');

console.log(config.baseURL);       // http://localhost:8081/
console.log(config.adminUser);     // admin
```

---

## 8. Reports and artifacts

After a test run, artifacts are saved under `e2e/reports/`:

| Artifact | Location | When created |
| --- | --- | --- |
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

Then refine `e2e/tests/helpers/auth.js` accordingly.

### Tests are flaky on map pages

Map tiles load asynchronously. Add a `waitForLoadState` or a `waitForResponse` call:

```typescript
await page.waitForLoadState('networkidle');
```

### How to debug a single failing test

```bash
npx playwright test e2e/tests/auth.spec.js --config=e2e/playwright.config.js --headed --debug
```

This opens the Playwright Inspector in step-through mode.
