# MapStore2 — End-to-End Testing Guide (Playwright)

## Introduction

MapStore2's E2E test framework is a centralized [Playwright](https://playwright.dev/) runner (`utility/e2e-test-runner`) for automated browser testing.
This framework is used for validating MapStore2 functionality in various environments (local dev, QA, test deployments) and configurations (with or without GeoServer, LDAP, etc.) through reusable test suites.

**Key concepts:**

- **Suites** — logical groups of tests (for example `auth`, `smoke`...) selectable with `--suites`. By default all configured suites run.
- **Profiles** — when running with Docker, profiles (`base`, `geoserver`, `ldap` ...) determine which services are started and which optional capabilities are enabled.
- **Features** — `features=oidc,ldap,geoserverIntegration`; profile-specific tests are enabled only when the related feature is available.
- **Authoring playbook** — for AI prompt templates and feature-first test design rules, see `test-authoring-playbook.md`.

**Usage modes:**

- **Local** — run against any already-running MapStore2 instance (dev server, QA, customer deployment) by pointing `BASE_URL` to it.
- **npx** — use the published `@mapstore/e2e-test-runner` package to test a specific released version without cloning the repository; suites can be selected with `--suites`.
- **Docker** — use `npm run e2e:docker` to build the WAR, start the full stack, run all profiles sequentially, and tear everything down — identical to CI.

---

## Requirements

| Requirement | Details |
| --- | --- |
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| **Local / npx** | A running MapStore2 instance reachable via `BASE_URL` |
| **Docker** | Docker, Java 17, Maven (the script builds the WAR automatically) |

Playwright and Chromium are pre-installed in the repository. To reinstall:

```bash
npm install
npx playwright install chromium
```

---

## Quick Start

All commands run from the **repository root**.

### Local — against an existing instance

```bash
# One-time setup: copy and edit credentials
cp utility/e2e-test-runner/.env.example .env
# set BASE_URL, MS_USER, MS_PASSWORD in the file

npm run e2e                          # headless, all default suites
npm run e2e:headed                   # with visible browser
npm run e2e -- --list-suites         # list available suites

npm run e2e -- --suites smoke        # single suite
npm run e2e -- --suites auth,smoke   # multiple suites
npm run e2e:ui                       # interactive Playwright UI
```

### npx — against any instance, no clone required

```bash
BASE_URL=https://mapstore.example.com/mapstore \
  MS_USER=admin MS_PASSWORD=secret \
  npx @mapstore/e2e-test-runner                          # all default suites

BASE_URL=https://mapstore.example.com/mapstore \
  MS_USER=admin MS_PASSWORD=secret \
  npx @mapstore/e2e-test-runner --suites smoke --headed  # single suite, headed
```

### Docker — full stack, all profiles

```bash
npm run e2e:docker                                                   # all profiles
npm run e2e:docker -- --help                                         # list options and available profiles
npm run e2e:docker -- --profiles base                                # base only
npm run e2e:docker -- --profiles base,geoserver --skip-build         # skip WAR build
npm run e2e:docker -- --no-fast-fail --headed --profiles geoserver   # debug mode
```

**Prerequisites for Docker:** Docker, Java 17, Maven.

---

## Reference

### Environment configuration

Create a local `.env` file from the template:

```bash
cp utility/e2e-test-runner/.env.example .env
```

Minimum required variables:

```dotenv
BASE_URL=http://localhost:8081/   # full URL including base path
MS_USER=admin
MS_PASSWORD=admin
```

Common `BASE_URL` values:

```dotenv
BASE_URL=http://localhost:8081/
BASE_URL=https://qa-mapstore.example/mapstore/
BASE_URL=https://customer.example/sit/mapstore/
```

> **Note:** `.env` is git-ignored; never commit credentials.

#### Multiple environment profiles

```bash
cp utility/e2e-test-runner/.env.example .env.local
cp utility/e2e-test-runner/.env.example .env.qa
cp utility/e2e-test-runner/.env.example .env.customer-acme
```

Select at runtime:

```bash
E2E_ENV=local npm run e2e
E2E_ENV=qa npm run e2e:headed
E2E_ENV_FILE=.env.customer-acme npm run e2e
```

The same root-level `.env` files work with `npx` as well, for example:

```bash
E2E_ENV_FILE=.env.customer-acme npx @mapstore/e2e-test-runner --suites auth
```

#### Optional environment variables

| Variable | Purpose |
| --- | --- |
| `E2E_FEATURES` | Comma-separated feature list (for example `oidc,ldap,geoserverIntegration`), see `KNOWN_FEATURES` in `tests/config.js` |
| `E2E_SERVICES_JSON` | JSON map of third-party service endpoints |
| `E2E_RESOURCES_JSON` | JSON map of environment-specific resources |
| `E2E_IDENTITIES_JSON` | JSON map of named identities, for example `{"ldapUser":{"username":"ldapuser","password":"…","role":"USER"}}` |
| `MS_USER_STANDARD` | Non-admin user for LDAP / mixed-auth tests, exposed as the `standardUser` identity |
| `MS_PASSWORD_STANDARD` | Password for `MS_USER_STANDARD` |

---

### npm scripts

| Command | Description |
| --- | --- |
| `npm run e2e` | Run all default suites headlessly |
| `npm run e2e:headed` | Run with a visible browser window |
| `npm run e2e:ui` | Open the Playwright interactive UI |
| `npm run e2e -- --suites <name>` | Run one or more named suites |
| `npm run e2e -- --list-suites` | List all configured suites |
| `npm run e2e:raw` | Run Playwright directly, bypassing suite selection |
| `npm run e2e:report` | Open the HTML report from the last run |
| `npm run e2e:codegen` | Open Playwright Codegen for recording tests |
| `npm run e2e:docker` | Build WAR, run all Docker profiles, tear down |
| `npm run e2e:docker -- --help` | Show Docker runner help (includes available profiles) |
| `npm run e2e:docker -- --profiles <p>` | Run specific Docker profiles |
| `npm run e2e:docker -- --skip-build` | Reuse existing WAR |
| `npm run e2e:docker -- --no-fast-fail` | Wait full timeout even on startup errors |
| `npm run e2e:docker -- --headed` | Run Docker tests with a visible browser |

### Running specific tests

```bash
# By file
npm run e2e -- utility/e2e-test-runner/tests/auth.spec.js

# By test name
npm run e2e -- -g "admin can log in"

# By file + line
npm run e2e -- utility/e2e-test-runner/tests/auth.spec.js:10

# Single browser
npm run e2e -- --project=chromium
```

---

### Suites

List available suites:

```bash
npm run e2e -- --list-suites
```

`suites.json` defines suite names, test file mappings, and `grep` patterns. The `title` and `why` fields document what is validated and why.

Default suite mapping by Docker profile:

| Docker profile | Suites |
| --- | --- |
| `base` | `smoke`, `auth`, `accounts`, `homepage`, `maps`, `geostory`, `context` |
| `geoserver` | `smoke`, `geoserver`, `map-toc`, `map-tools`, `dashboard` |
| `oidc` | `smoke` |
| `ldap` | `smoke`, `ldap` |

The suites of the `geoserver` profile read data, so they are gated on the
`geoserverIntegration` and `geoserverDb` features and are skipped elsewhere. Everything
they display comes from the `e2e:e2e_points` layer the profile publishes.

The profile installs the GeoServer WPS extension (`STABLE_EXTENSIONS=wps`): chart and
counter widgets aggregate through `gs:Aggregate`, and without it MapStore answers
"the server doesn't provide the needed services for the layer". The extension is fetched
when the container starts, so that profile needs registry access on a cold start.

---

### npx — full reference

```bash
# All default suites
BASE_URL=https://mapstore.example.com/mapstore \
  MS_USER=admin MS_PASSWORD=secret123 \
  npx @mapstore/e2e-test-runner

# Specific suites, headed
BASE_URL=... MS_USER=... MS_PASSWORD=... \
  npx @mapstore/e2e-test-runner --suites auth --headed

# With optional capabilities
BASE_URL=... MS_USER=... MS_PASSWORD=... \
  E2E_FEATURES=geoserverIntegration \
  npx @mapstore/e2e-test-runner --suites auth,geoserver

# Using a .env file
E2E_ENV_FILE=.env.customer-acme npx @mapstore/e2e-test-runner --suites auth

# List available suites
npx @mapstore/e2e-test-runner --list-suites

# Dry-run (list tests without running)
npx @mapstore/e2e-test-runner --suites auth --list

# Custom suites manifest
BASE_URL=... npx @mapstore/e2e-test-runner \
  --suites-file ./my-suites.json --suites my-feature
```

#### Custom suites manifest format

```json
{
  "version": 1,
  "defaults": ["my-feature"],
  "suites": {
    "my-feature": {
      "title": "My custom feature",
      "why": "Validate a custom workflow not covered by standard suites.",
      "files": ["tests/my-feature.spec.js"],
      "grep": "My custom feature"
    }
  }
}
```

#### Local execution without publishing

```bash
node utility/e2e-test-runner/bin/e2e-test-runner.js --list-suites
node utility/e2e-test-runner/bin/e2e-test-runner.js --suites auth --list
```

---

### Docker — full reference

The `utility/e2e-test-runner/e2e-docker.sh` script handles everything: WAR build, stack startup, test run, and teardown. Compose overlays are selected automatically per profile.

```bash
# Run all profiles sequentially
npm run e2e:docker

# Single profile
npm run e2e:docker -- --profiles base

# Multiple profiles, skip build
npm run e2e:docker -- --profiles base,geoserver --skip-build

# LDAP profile with credentials
MS_USER_STANDARD=ldapuser MS_PASSWORD_STANDARD=secret \
  npm run e2e:docker -- --profiles ldap

# Debug mode (no fast-fail, visible browser)
npm run e2e:docker -- --no-fast-fail --headed --profiles geoserver
```

On failure the script saves Docker logs to `e2e-docker-logs-<profile>.txt` and continues with remaining profiles before exiting non-zero.

#### Manual Docker steps (without the script)

**Build the WAR:**

```bash
mvn -pl product -am -DskipTests package          # base or geoserver
mvn -pl product -am -DskipTests -Pldap package   # LDAP profile
```

**Start the stack:**

```bash
# base
docker compose -f docker-compose.yml -f utility/e2e-test-runner/profiles/base/docker-compose.e2e.yml up -d --build

# geoserver
docker compose -f docker-compose.yml -f utility/e2e-test-runner/profiles/base/docker-compose.e2e.yml \
  -f utility/e2e-test-runner/profiles/geoserver/docker-compose.e2e.yml up -d --build

# ldap
docker compose -f docker-compose.yml -f utility/e2e-test-runner/profiles/base/docker-compose.e2e.yml \
  -f utility/e2e-test-runner/profiles/ldap/docker-compose.e2e.yml up -d --build
```

**Wait for services:**

```bash
until curl -fsS http://localhost:8081/mapstore/ > /dev/null; do sleep 5; done
# GeoServer only:
until curl -fsS http://localhost:8082/geoserver/web/ > /dev/null; do sleep 5; done
```

**Run tests:**

```bash
# base
BASE_URL=http://localhost:8081/mapstore/ \
  npm run e2e -- --suites auth,smoke,homepage,maps

# geoserver
BASE_URL=http://localhost:8081/mapstore/ \
  E2E_FEATURES=geoserverIntegration \
  E2E_SERVICES_JSON='{"geoserver":"http://localhost:8082/geoserver"}' \
  npm run e2e -- --suites auth,smoke,homepage,maps,geoserver

# ldap
BASE_URL=http://localhost:8081/mapstore/ \
  E2E_FEATURES=ldap \
  MS_USER_STANDARD=<ldap-user> MS_PASSWORD_STANDARD=<ldap-password> \
  npm run e2e -- --suites auth,smoke,homepage,maps,ldap
```

**Tear down:**

```bash
docker compose -f docker-compose.yml -f utility/e2e-test-runner/profiles/base/docker-compose.e2e.yml down -v
```

---

### Repository structure

```text
utility/e2e-test-runner/
├── e2e-docker.sh            # Docker profile runner (build, up, test, teardown)
├── profiles/
│   ├── base/
│   │   └── docker-compose.e2e.yml   # Base overlay: WAR mount and port mapping
│   ├── geoserver/
│   │   ├── docker-compose.e2e.yml   # GeoServer integration overlay
│   │   └── localConfig.e2e.geoserver.patch.json
│   └── ldap/
│       └── docker-compose.e2e.yml   # LDAP authentication overlay
├── playwright.config.js      # Main Playwright configuration
├── suites.json               # Named test suites and their file/grep mappings
├── loadEnv.js                # Loads the selected environment profile
├── .env                      # Local credentials and base URL (git-ignored)
├── .env.example              # Template for environment profiles
├── bin/
│   └── e2e-test-runner.js   # CLI entry point (used by npx)
├── src/
│   └── cli.js               # Suite resolution and Playwright invocation logic
└── tests/
    ├── config.js             # Reads env variables, capabilities, and services
    ├── helpers/
    │   ├── auth.js           # login() and logout() helpers
    │   └── navigation.js     # Opens app URLs respecting custom base paths
    ├── auth.spec.js          # Authentication tests
    └── smoke.spec.js         # Core smoke tests
```

The base `docker-compose.yml` at repository root is always used as the first `-f` argument.

All test files must end in `.spec.js`.

---

## 5. Recording a new test with Codegen

Playwright's **Codegen** tool opens a browser and records your actions into a test file automatically.

### Step-by-step

1. Make sure MapStore2 is running and `.env` contains the correct `BASE_URL`.

2. Start the recorder:

   ```bash
   npm run e2e:codegen
   ```

   This opens two windows:
   - **Browser window** — navigate MapStore2 as you would normally.
   - **Playwright Inspector** — shows the generated code in real time.

3. Interact with the application (click buttons, fill forms, navigate pages).
   Each action is captured as a line of JavaScript in the Inspector.

4. When done, click **Copy** in the Inspector and paste the code into a new file inside `utility/e2e-test-runner/tests/`, for example `tests/my-feature.spec.js`.

5. Wrap the recorded code in a proper test structure (see [Section 6](#6-writing-tests-manually)).

6. Run your new test to verify it passes:

   ```bash
   npm run e2e -- utility/e2e-test-runner/tests/my-feature.spec.js --headed
   ```

## 6. Writing tests manually

### npx — running against any instance

`npx @mapstore/e2e-test-runner` accepts exactly the same environment variables described in
[Environment configuration](#environment-configuration): use inline exports, a `.env` file
(via `E2E_ENV_FILE`), or an environment profile (via `E2E_ENV`).

```bash
# All default suites against a remote instance
BASE_URL=https://mapstore.example.com/mapstore \
  MS_USER=admin MS_PASSWORD=secret \
  npx @mapstore/e2e-test-runner

# Specific suite, headed, using a named environment profile
E2E_ENV_FILE=.env.customer-acme \
  npx @mapstore/e2e-test-runner --suites smoke --headed
```

#### Extending with custom suites

Pass `--suites-file` to add project-specific suites on top of the bundled ones:

```bash
BASE_URL=... npx @mapstore/e2e-test-runner \
  --suites-file ./my-suites.json --suites my-feature
```

The custom manifest follows the same format as `suites.json`:

```json
{
  "version": 1,
  "defaults": ["my-feature"],
  "suites": {
    "my-feature": {
      "title": "My custom feature",
      "why": "Validate a custom workflow not covered by standard suites.",
      "files": ["tests/my-feature.spec.js"],
      "grep": "My custom feature"
    }
  }
}
```

#### Local execution without publishing

```bash
node utility/e2e-test-runner/bin/e2e-test-runner.js --list-suites
node utility/e2e-test-runner/bin/e2e-test-runner.js --suites auth --list
```

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
import { login } from './helpers/auth.js';

await login(page);                         // uses .env credentials
await login(page, 'user1', 'password1');   // custom credentials
```

### `logout(page)`

Clicks the user menu and confirms logout.

```javascript
import { logout } from './helpers/auth.js';

await logout(page);
```

### `config`

Provides the base URL and default credentials:

```javascript
import { config } from './config.js';

console.log(config.baseURL);       // http://localhost:8081/
console.log(config.adminUser);     // admin
```

---

## 8. Reports and artifacts

After a test run, artifacts are saved under `utility/e2e-test-runner/reports/`:

| Artifact | Location | When created |
| --- | --- | --- |
| HTML report | `reports/html/` | Always |
| Screenshots | `reports/test-results/` | On failure |
| Videos | `reports/test-results/` | On first retry |
| Traces | `reports/test-results/` | On first retry |

Open the HTML report with:

```bash
npm run e2e:report
```

To view a trace file (step-by-step replay of a failed test):

```bash
npx playwright show-trace utility/e2e-test-runner/reports/test-results/<test-name>/trace.zip
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

### GitHub Actions with Docker profiles

This repository includes a workflow that starts MapStore in Docker (with PostgreSQL) and runs Playwright suites by profile:

- Workflow: `.github/workflows/e2e-docker.yml`
- Base compose: `docker-compose.yml`
- CI override (WAR + port): `utility/e2e-test-runner/profiles/base/docker-compose.e2e.yml`
- Optional GeoServer profile: `utility/e2e-test-runner/profiles/geoserver/docker-compose.e2e.yml`
- Optional LDAP profile: `utility/e2e-test-runner/profiles/ldap/docker-compose.e2e.yml`

The workflow runs automatically every night at midnight UTC (all profiles discovered by the Docker runner). It can also be triggered
on demand from GitHub Actions > **E2E Docker Profiles** with these inputs:

- `profiles`: optional comma-separated profile list (`base`, `geoserver`, `ldap`); if omitted, the workflow discovers profiles from `utility/e2e-test-runner/e2e-docker.sh --list-profiles`
- `ldap_user` / `ldap_password`: credentials used by the LDAP login suite (`MS_USER_STANDARD`, `MS_PASSWORD_STANDARD`)

The workflow runs one job per profile in parallel, and each profile runs the full suite set configured by the Docker runner for that profile.

Suggested suite mapping pattern:

- `base`: `auth,smoke,homepage,maps`
- `geoserver`: `auth,smoke,homepage,maps,geoserver`
- `ldap`: `auth,smoke,homepage,maps,ldap`

Important for LDAP profile: MapStore is built with Maven profile `ldap` in CI, not only with the LDAP container enabled.

For profile-specific tests, gate the suite or test using features (`hasFeature('geoserverIntegration')`, `hasFeature('ldap')`) to avoid false failures when a profile is not enabled.

Each profile job publishes a job summary showing the test status and uploads:

- **Playwright HTML report** (`reports/html/`) — interactive test results with screenshots and videos
- **Playwright test results** (`reports/test-results/`) — structured data and debug artifacts
- **Docker logs** (`e2e-docker-logs-<profile>.txt`) — container logs from the run

Click the Playwright HTML report link in the job summary to view detailed test results for each profile, including:
- Pass/fail status and error messages
- Screenshots and videos (on failure)
- Traces for step-by-step replay (on first retry)

---

## 10. Running tests locally with Docker

The repository includes `utility/e2e-test-runner/e2e-docker.sh`, a script that builds the WAR, starts each Docker profile,
waits for the services, runs the tests, and tears everything down — identical to what GitHub Actions does.

### Quick start

```bash
# Run all profiles (base → geoserver → ldap)
npm run e2e:docker

# Run a single profile
npm run e2e:docker -- --profiles base

# Run two profiles, skip the Maven build (WAR already built)
npm run e2e:docker -- --profiles base,geoserver --skip-build

# Print available profiles (used by CI profile discovery)
npm run e2e:docker -- --list-profiles

# Run the LDAP profile with credentials
MS_USER_STANDARD=ldapuser MS_PASSWORD_STANDARD=secret \
  npm run e2e:docker -- --profiles ldap
```

**Prerequisites:** Docker, Java 17, Maven.

The script resolves the correct compose file combination, Maven flag (`-Pldap` only for the LDAP profile),
and environment variables for each profile automatically. On failure it saves Docker logs to
`e2e-docker-logs-<profile>.txt` and writes markdown reports under `reports/e2e-docker/`:

- `reports/e2e-docker/summary.md` — overall run summary
- `reports/e2e-docker/profiles/<profile>.md` — per-profile outcome

This makes it easier to understand whether a failure happened during startup, GeoServer readiness, or Playwright test execution.

---

### Manual step-by-step (without the script)

### Step 1 — build the WAR

```bash
# base or geoserver profile
mvn -pl product -am -DskipTests package

# LDAP profile (enables Spring Security LDAP configuration)
mvn -pl product -am -DskipTests -Pldap package
```

The WAR will be at `product/target/mapstore.war`.

### Step 2 — start the stack

Pick the compose files for the profile you want to test:

**Base (PostgreSQL + MapStore only):**

```bash
docker compose \
  -f docker-compose.yml \
  -f utility/e2e-test-runner/profiles/base/docker-compose.e2e.yml \
  up -d --build
```

**GeoServer integration:**

```bash
docker compose \
  -f docker-compose.yml \
  -f utility/e2e-test-runner/profiles/base/docker-compose.e2e.yml \
  -f utility/e2e-test-runner/profiles/geoserver/docker-compose.e2e.yml \
  up -d --build
```

**LDAP authentication:**

```bash
docker compose \
  -f docker-compose.yml \
  -f utility/e2e-test-runner/profiles/base/docker-compose.e2e.yml \
  -f utility/e2e-test-runner/profiles/ldap/docker-compose.e2e.yml \
  up -d --build
```

The proxy is exposed on port `8081`. Wait for MapStore to be ready:

```bash
# poll until the home page responds
until curl -fsS http://localhost:8081/mapstore/ > /dev/null; do sleep 5; done
```

For the GeoServer profile also wait for GeoServer on port `8082`:

```bash
until curl -fsS http://localhost:8082/geoserver/web/ > /dev/null; do sleep 5; done
```

### Step 3 — run the tests

Set the required environment variables and run the suites you need:

**Base profile:**

```bash
BASE_URL=http://localhost:8081/mapstore/ \
  npm run e2e -- --suites auth,smoke,homepage,maps
```

**GeoServer profile:**

```bash
BASE_URL=http://localhost:8081/mapstore/ \
  E2E_FEATURES=geoserverIntegration \
  E2E_SERVICES_JSON='{"geoserver":"http://localhost:8082/geoserver"}' \
  npm run e2e -- --suites auth,smoke,homepage,maps,geoserver
```

**LDAP profile:**

```bash
BASE_URL=http://localhost:8081/mapstore/ \
  E2E_FEATURES=ldap \
  MS_USER_STANDARD=<ldap-user> \
  MS_PASSWORD_STANDARD=<ldap-password> \
  npm run e2e -- --suites auth,smoke,homepage,maps,ldap
```

Or put the variables in a local `.env` file (see [Environment configuration](#environment-configuration)) and omit the inline exports.

### Step 4 — stop and clean up

```bash
docker compose \
  -f docker-compose.yml \
  -f utility/e2e-test-runner/profiles/base/docker-compose.e2e.yml \
  down -v
```

Add the same `-f` flags you used to start the stack if you added extra overlays.

---

## 11. Troubleshooting

### Tests fail with "net::ERR_CONNECTION_REFUSED"

MapStore2 is not reachable at `BASE_URL`. Check:

- The Docker stack is running: `docker compose ps`
- The URL in `.env` is correct.

### Login helper cannot find the "Sign in" button

The selector may differ from the default. Use the **Playwright Inspector** to identify the correct selector:

```bash
npm run e2e:ui
```

Then refine `utility/e2e-test-runner/tests/helpers/auth.js` accordingly.

### Tests are flaky on map pages

Map tiles load asynchronously. Add a `waitForLoadState` or a `waitForResponse` call:

```javascript
await page.waitForLoadState('networkidle');
```

### How to debug a single failing test

```bash
npm run e2e -- utility/e2e-test-runner/tests/auth.spec.js --headed --debug
```

This opens the Playwright Inspector in step-through mode.
