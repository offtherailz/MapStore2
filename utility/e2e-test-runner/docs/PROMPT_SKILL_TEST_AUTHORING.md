# Prompt & Skill Guide for Authoring E2E Tests

This document complements the testing guide and focuses on how to request, design, and review new E2E tests using the current feature-driven model.

## 1) Is the current setup over-engineered?

Short answer: no, if the team keeps the current boundaries.

Why it is reasonably maintainable:

- Feature gating is centralized (`E2E_FEATURES` + `hasFeature(...)`) instead of duplicated in many tests.
- Docker profiles (`base`, `geoserver`, `ldap`) explicitly define enabled services and default suites.
- Environment parsing is in one place (`tests/config.js`), reducing hidden assumptions in specs.
- Docs and scripts are now co-located under `utility/e2e-test-runner`.

What would make it hard to maintain:

- Adding profile-specific logic directly inside tests without `hasFeature(...)` checks.
- Introducing new env flags outside the existing model.
- Creating tests coupled to unstable selectors without fallbacks.

## 2) Golden Rules (feature-first)

1. Start from behavior, then map behavior to features.
2. Add/extend feature flags only when behavior is profile-dependent.
3. Gate profile-specific tests with `test.skip(!hasFeature('featureName'), ...)`.
4. Keep environment contracts in `tests/config.js` and `.env.example`.
5. Prefer reusable helpers (`tests/helpers/*`) over repeated UI flows.
6. Use resilient selectors (role/label first, fallback locator when needed).
7. Keep suites coherent in `suites.json`.

## 3) Feature-to-Test Mapping Pattern

Use this pattern before writing a new test:

- Feature: which capability must exist? (example: `geoserverIntegration`)
- Profile: where is it enabled? (example: `geoserver`)
- Preconditions: credentials, services, seed data
- Expected behavior: user-visible, verifiable outcome
- Suite placement: which suite owns the test

Example mapping:

- `geoserverIntegration` -> profile `geoserver` -> suite `geoserver` -> `tests/geoserver.spec.js`
- `ldap` -> profile `ldap` -> suite `ldap` -> `tests/ldap.spec.js`

## 4) Prompt Template (for AI-assisted test creation)

Use this prompt when asking an AI tool to generate tests:

```text
Create (or update) Playwright E2E tests for MapStore2 under utility/e2e-test-runner.

Context:
- Feature model is E2E_FEATURES + hasFeature(...) from tests/config.js.
- Profile-specific tests must be skipped when feature is missing.
- Keep suites aligned in suites.json.
- Reuse existing helpers in tests/helpers when possible.
- Use role-based selectors first, with robust fallback selectors only if needed.

Task:
- Add test(s) for: <describe behavior>
- Required feature(s): <feature list or none>
- Target suite: <suite name>
- Preconditions/data: <credentials/services/resources>

Output requirements:
- Modify only necessary files.
- Include test.step blocks with clear user-level actions.
- Add feature gating using hasFeature('<feature>').
- Avoid hard-coded waits; use expect(...).toBeVisible with timeouts when needed.
- If env contracts change, update .env.example and related docs.
- Ensure lint/style consistency with existing files.
```

## 5) Skill Checklist (before opening PR)

- Test has a clear business behavior statement.
- Correct feature gate is present (or explicitly not needed).
- Suite assignment in `suites.json` is correct.
- Selectors are accessible-first and stable.
- Test data cleanup is handled (if resource creation occurs).
- No duplicated login/navigation logic if helper exists.
- Local run command for the intended profile is documented in PR notes.

## 6) Acceptance Criteria Template

Use these acceptance criteria for each new profile-aware test:

1. Test passes when required feature is enabled.
2. Test is skipped (not failed) when feature is disabled.
3. Test does not depend on unrelated profiles.
4. Test is deterministic across at least 2 local re-runs.
5. Test leaves no residual data or handles cleanup explicitly.

## 7) Minimal Code Patterns

Feature gating in a spec:

```js
import { test } from '@playwright/test';
import { hasFeature } from './config.js';

test('example profile-aware behavior', async({ page }) => {
    test.skip(!hasFeature('geoserverIntegration'), 'Requires feature geoserverIntegration');
    // test body
});
```

Reading profile-dependent credentials safely:

```js
import { environment } from './config.js';

const username = environment.user.username;
const password = environment.user.password;
```

## 8) Suggested PR Description Snippet

```text
E2E test update (feature-driven)
- Added/updated suite: <name>
- Feature gates: <list>
- Profiles validated: <list>
- Commands executed: <exact commands>
- Notes: selector strategy, cleanup strategy, known limitations
```

## 9) Anti-Patterns to Avoid

- Checking profile name inside test logic instead of using features.
- Adding one-off env variables when an existing config contract can be reused.
- Writing monolithic tests that cover multiple unrelated behaviors.
- Depending on fixed timing (`waitForTimeout`) for core assertions.
- Merging tests without proving skip behavior for missing features.

## 10) Where this guide fits

- Use this guide to design prompts and review generated tests.
- Use `docs/TESTING_GUIDE.md` for full operational commands and environment setup.
