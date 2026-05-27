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
| Optional integration/capability behavior | Yes | profile-specific suite |

Pattern:

```js
import { test } from '@playwright/test';
import { hasFeature } from './config.js';

test('profile-specific behavior', async({ page }) => {
    test.skip(!hasFeature('ldap'), 'Requires feature ldap');
    // steps
});
```

## 7) Selector strategy (long-term stability)

Use selectors in this priority order to reduce maintenance cost:

1. `getByRole` with accessible name.
2. `getByLabel` / `getByPlaceholder` for form controls.
3. `getByText` only for stable user-facing text.
4. `getByTestId` when available and intentionally maintained.
5. CSS selectors only as last resort.

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

## 11) Shared-state strategy: one-time setup with `beforeAll`

Creating one map per test gives strong isolation but can be slow and noisy.
Using pre-existing maps is faster but can create domino failures.

Recommended compromise for MapStore2 suites:

- Create one dedicated baseline map in `test.beforeAll` per spec file (or per suite shard).
- Reuse that map across tests only if tests operate on separate, non-conflicting areas.
- Remove baseline resources in `test.afterAll`.

Guardrails to avoid cascade failures:

1. Do not share mutable objects across unrelated behaviors.
2. Keep test data names unique and traceable (`E2E <suite> <timestamp>`).
3. If tests mutate shared state, use serial execution for that block.
4. Never rely on pre-existing manual maps as test fixtures.
5. If a test can permanently alter the baseline map, clone/reset first.

Minimal pattern:

```js
import { test, expect } from '@playwright/test';

let baselineMapName;

test.beforeAll(async({ browser }) => {
    const page = await browser.newPage();
    baselineMapName = `E2E Baseline ${Date.now()}`;
    // create baseline map once
    await page.close();
});

test.afterAll(async({ browser }) => {
    const page = await browser.newPage();
    // delete baseline map
    await page.close();
});

test('scenario A uses baseline safely', async({ page }) => {
    // use baseline map without breaking scenario B
    await expect(page).toBeTruthy();
});
```

Use this strategy when speed is critical and behavior can be partitioned safely.
If behavior is highly stateful or destructive, prefer strict per-test isolation.

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
