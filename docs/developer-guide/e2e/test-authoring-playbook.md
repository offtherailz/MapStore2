# Prompt & Skill Guide - Tester-First E2E Authoring

This guide is designed for QA testers with limited coding experience.
Its purpose is to help transform original tests (manual scripts, CucumberStudio scenarios, legacy checklists) into Playwright tests for MapStore2, and to create new tests consistently using the existing E2E infrastructure.

## 1) Who this guide is for

- QA testers who know the business behavior but are not Playwright experts.
- Functional analysts who can describe expected outcomes.
- Technical reviewers who validate generated tests before merge.

## 2) What you need before writing tests

Collect this information first. If one item is missing, do not start test generation.

1. Test objective in one sentence.
2. Preconditions (user role, data, required services).
3. Expected result visible to the user.
4. Related feature, if profile-dependent (`ldap`, `geoserverIntegration`, `oidc`, ...).
5. Source scenario (manual test case ID or CucumberStudio scenario name).

## 3) Map original tests to Playwright format

Convert each original test to this simple structure:

- Given: initial state and prerequisites.
- When: user actions.
- Then: visible and verifiable outcome.

Then map it to runner concepts:

- Suite: where the test belongs (`auth`, `smoke`, `homepage`, `maps`, `ldap`, `geoserver`, ...).
- Feature gate: needed or not needed.
- Reusable helper: login/navigation/helper flow to reuse.
- Cleanup: what must be removed after test execution.

## 4) Tester workflow (no-code assisted)

1. Write the scenario in natural language using Given/When/Then.
2. Fill the prompt template in section 5.
3. Ask the AI assistant to generate or update the test.
4. Verify generated steps against the original scenario intent.
5. Execute the target suite locally.
6. Submit for technical review using the checklist in section 7.

## 5) Prompt templates

### 5.1 Convert existing original test to Playwright

```text
Convert this original MapStore2 test scenario into a Playwright E2E test in utility/e2e-test-runner.

Original scenario:
<PASTE MANUAL OR CUCUMBER SCENARIO>

Context and constraints:
- Keep business behavior identical to original scenario intent.
- Use existing helpers under tests/helpers when possible.
- Select the right suite in suites.json.
- If the behavior is profile-dependent, add feature gating with hasFeature('<feature>').
- Use test.step blocks with readable user-level actions.
- Avoid hard-coded waits; use stable assertions.
- Include cleanup actions for created resources.

Output:
- Files to modify.
- Proposed test code.
- Why this suite and feature gate were chosen.
- Command to run this scenario.
```

### 5.2 Create a new test from scratch

```text
Create a new Playwright E2E test for MapStore2 under utility/e2e-test-runner.

Business goal:
<ONE SENTENCE>

Given:
<INITIAL CONDITIONS>

When:
<USER ACTIONS>

Then:
<EXPECTED USER-VISIBLE OUTCOME>

Constraints:
- Suggest target suite.
- Add hasFeature guard only if needed.
- Reuse helpers and follow existing style.
- Add cleanup if resources are created.
- Keep selectors robust and accessible-first.

Output:
- New/updated files.
- Test code.
- Minimal run command.
```

### 5.3 Improve an unstable test

```text
Refactor this MapStore2 Playwright test to reduce flakiness without changing business behavior.

Test file:
<PATH>

Requirements:
- Remove brittle timing assumptions.
- Improve selector robustness.
- Keep feature gating logic correct.
- Preserve suite ownership and intent.

Output:
- Updated code.
- Explanation of stability improvements.
```

## 6) Feature decision quick guide

Use this table before generating code.

| Behavior type | Use feature gate? | Typical suite |
| --- | --- | --- |
| Core behavior available everywhere | No | `auth`, `smoke`, `homepage`, `maps` |
| LDAP-specific authentication behavior | Yes (`ldap`) | `ldap` |
| GeoServer catalog integration behavior | Yes (`geoserverIntegration`) | `geoserver` |
| Behavior needing the PostGIS fixture layer | Yes (`geoserverDb`) | `geoserver` |
| Optional integration/capability behavior | Yes | profile-specific suite |

The full list of gates is `KNOWN_FEATURES` in `tests/config.js`; a profile enables them
through `E2E_FEATURES`.

Gate a whole spec file with `describeIfFeature`:

```js
import { test, expect, describeIfFeature } from './fixtures.js';

describeIfFeature('ldap', 'LDAP', () => {
    test('profile-specific behavior', async({ page }) => {
        // steps
    });
});
```

Gate a single test with `test.skip` when the rest of the file is core behavior:

```js
import { hasFeature } from './config.js';

test('behavior needing the fixture layer', async({ page }) => {
    test.skip(!hasFeature('geoserverDb'), 'Requires feature geoserverDb');
    // steps
});
```

Never hardcode credentials: ask for a named identity instead, so the same spec runs
against a local stack, an LDAP profile or a customer instance.

```js
import { getIdentity } from './config.js';

const identity = getIdentity('ldapUser') ?? getIdentity('standardUser');
test.skip(!identity, 'Requires an ldapUser identity');
await login(page, identity.username, identity.password);
```

## 7) Selector strategy (long-term stability)

Use selectors in this priority order to reduce maintenance cost:

1. `getByRole` with accessible name.
2. `getByLabel` / `getByPlaceholder` for form controls.
3. `getByText` only for stable user-facing text.
4. `getByTestId` when available and intentionally maintained.
5. CSS selectors only as last resort.

In the viewers, most toolbar buttons carry no accessible name and only show a tooltip on
hover, so their glyph is the stable hook — `button.toc-toolbar-button:has(.glyphicon-wrench)`
rather than a position or a tooltip text. Two glyphs are worth remembering: `floppy-disk`
saves a resource in place, `floppy-open` creates a copy of it.

Reuse the helpers instead of rediscovering those selectors:

| Helper | Covers |
| --- | --- |
| `helpers/map.js` | fixture layer descriptor, viewer routes, layers drawer, layer toolbar |
| `helpers/dashboard.js` | dashboard editor, widget wizard, widget and resource saving |
| `helpers/geostory.js` | story view and edit mode, section add bar |
| `helpers/context.js` | context creator wizard |
| `helpers/navigation.js` | app URLs, guided tour dismissal, tooltip clearing |

Rules:

- Prefer one stable selector over chained brittle locators.
- Avoid selectors coupled to visual classes likely to change.
- If fallback selector is needed, document why in a short comment.
- Reuse helper-level selectors for recurring flows.

## 8) Assertion quality (what makes a test trustworthy)

A good assertion validates behavior, not implementation detail.

Prefer:

- User-visible outcomes (messages, state changes, resource presence).
- Post-condition checks after each critical action.
- Negative checks where relevant (for example, no error banner).

Avoid:

- Assertions that only confirm click/navigation happened.
- Assertions on unstable internal markup.
- Single final assertion for a long multi-step flow.

Quality pattern:

1. Assert precondition.
2. Execute action.
3. Assert immediate result.
4. Assert persisted result if relevant.

## 9) Anti-patterns to avoid

- Hard-coded sleeps (`waitForTimeout`) for core synchronization.
- Copy-paste of login/navigation instead of using helpers.
- Suite pollution: putting profile-specific behavior in core suites.
- Overly broad tests covering unrelated business behaviors.
- Random test data without deterministic cleanup.
- Importing `test`/`expect` from `@playwright/test` instead of `./fixtures.js`.
- Hardcoded hosts, credentials or data owned by a third party.
- Merging generated code without human validation.

## 10) Automation scope and cost awareness

Not everything should be automated at the same depth.

Use this prioritization model:

1. High business risk + high frequency path -> automate first.
2. High regression risk integration points -> automate with profile coverage.
3. Low-value or volatile flows -> keep minimal smoke coverage.

Cost controls:

- Keep PR suite fast (smoke/critical subset).
- Run broader suites on schedule or targeted triggers.
- Track maintenance hotspots (frequent flaky tests, unstable pages).
- Refactor helpers before adding more scenarios in unstable areas.

## 11) Test data: fixtures instead of pre-existing resources

Specs import `test` and `expect` from `./fixtures.js`, not from `@playwright/test`.
Two fixtures come with it:

- `data` — factory for maps, dashboards, geostories, users and groups. Everything it
  creates is deleted after the test, in reverse creation order, through the API. Names
  are unique and prefixed with `E2E_`.
- `api` — the authenticated GeoStore client (`tests/api/geostore.js`) behind the factory,
  for lookups and for cases the factory does not cover.

Setup through the API, assert through the UI:

```js
import { test, expect } from './fixtures.js';

test('a dashboard opens from the homepage', async({ page, data }) => {
    const dashboard = await data.dashboard();
    // the resource already exists, the test only validates the UI behavior
    await expect(page.locator('.ms-resource-card').filter({ hasText: dashboard.name })).toBeVisible();
});
```

When the flow under test is the creation itself, take the name from the factory and
adopt the resulting resource, so teardown works even if a later step fails:

```js
const mapName = data.name('map');
// … create the map through the UI …
const [resource] = await api.findResources('MAP', mapName);
data.track({ id: resource.id, name: mapName, category: 'MAP' });
```

Rules:

1. Never rely on pre-existing manual resources as test fixtures.
2. Never point a spec at data or services outside this repository: use the fixture layer
   published by the `geoserver` profile (`e2e:e2e_points`) and reach services through
   `getServiceUrl`.
3. Do not share mutable resources across unrelated behaviors; if a block mutates shared
   state, run it serially.
4. `globalSetup` removes leftover `E2E_*` fixtures before a run, so an interrupted run
   never breaks the next one — but a spec must still clean up after itself.
5. Only fall back to `beforeAll` for a per-file baseline when creating one resource per
   test is measurably too slow, and remove it in `afterAll`.

## 12) AI limitations and review expectations

AI is a drafting accelerator, not the final authority.

Expected human review:

1. Validate business intent against original scenario.
2. Validate suite placement and feature gating.
3. Validate selector robustness and assertion quality.
4. Validate cleanup and repeatability.
5. Run the test and review output before merge.

Known AI limitations:

- Can infer wrong selectors when UI context is partial.
- Can produce over-generic assertions.
- Can miss hidden preconditions (data, permissions, profile setup).
- Can overfit to one environment unless constraints are explicit.

## 13) Review checklist (tester + reviewer)

A test is ready only if all checks are true.

1. Business intent matches original scenario.
2. Correct suite selected.
3. Feature gate is present only when needed.
4. Assertions verify user-visible outcomes.
5. Cleanup is included when data is created.
6. No hard-coded sleep for critical flow.
7. Shared-state usage (`beforeAll`) is justified and guarded against domino effects.
8. Local run command is provided and works.

## 14) Sources to reference while authoring

Use these sources before requesting generated code:

- Main operational guide: [docs/developer-guide/e2e/testing-guide.md](docs/developer-guide/e2e/testing-guide.md)
- Suite registry: [utility/e2e-test-runner/suites.json](utility/e2e-test-runner/suites.json)
- Existing test examples: [utility/e2e-test-runner/tests](utility/e2e-test-runner/tests)
- Profile assets and compose files: [utility/e2e-test-runner/profiles](utility/e2e-test-runner/profiles)

External references:

- Playwright docs: <https://playwright.dev/docs/intro>

## 15) Practical handoff model for non-coders

Use this collaboration model:

- Tester drafts scenario and fills the prompt template.
- AI assistant produces first test version.
- Reviewer performs technical hardening only (selectors, cleanup, feature guard).
- Tester validates behavior against acceptance criteria.

This keeps scenario ownership in QA while minimizing coding dependency.

## 16) Definition of done for converted tests

A converted or newly created test is done when:

1. It preserves the original business intent.
2. It runs in the correct suite/profile.
3. It follows feature gating rules.
4. It is stable for repeated local runs.
5. It is understandable by non-coders (step names and intent are clear).
