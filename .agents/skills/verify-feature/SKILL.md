---
name: verify-feature
description: Verify implemented features and bug fixes in Laravel and Next.js applications by running appropriate automated tests, TypeScript checks, linting, and safe validation commands. Report actual results, failures, coverage gaps, and recommended next steps without modifying source code or tests unless explicitly authorized.
---

# Verify Feature

## Purpose

Verify that implemented features, bug fixes, and refactoring changes satisfy their requirements through automated checks and appropriate manual verification recommendations.

This skill is verification-only by default. Do not modify application source code, tests, or configuration.

## Workflow

### 1. Identify Verification Scope

Read the applicable `AGENTS.md` instructions.

Determine:

- Feature or bug fix being verified
- Expected behavior and acceptance criteria
- Relevant changed files
- Frontend and backend responsibilities
- Existing tests that cover the feature
- Appropriate verification commands

Inspect relevant Git changes when useful.

Do not assume every uncommitted change belongs to the requested feature.

Ask for clarification only when the verification scope cannot reasonably be determined.

### 2. Inspect Existing Tests

Identify existing tests relevant to the feature.

For frontend changes, inspect:

- Vitest test files
- Component and hook tests
- API helper tests
- Authentication and navigation tests
- Relevant mocks and test configuration

For backend changes, inspect:

- PHPUnit feature tests
- Unit tests
- Validation tests
- Authentication and authorization tests
- Relevant testing configuration

Determine which expected behaviors are already tested.

Do not create or modify tests without explicit authorization.

### 3. Run Frontend Verification

Run commands from:

`frontend-nextjs/system-frontend/`

Use the following commands when appropriate:

**TypeScript verification**

`npx.cmd tsc --noEmit`

**Focused Vitest verification**

`npx.cmd vitest run <relevant-test-file>`

Replace the placeholder with the actual test path.

**Complete Vitest suite**

`npx.cmd vitest run`

**ESLint**

`npm run lint`

**Production build**

`npm run build`

Run production builds only when relevant and safe, not automatically for every minor change.

Prefer focused tests before executing the complete suite.

Do not claim a command passed unless it actually executed successfully.

### 4. Run Backend Verification

Run commands from:

`backend-laravel/system-backend/`

Before running database-dependent tests:

1. Inspect the existing testing configuration.
2. Confirm the dedicated `system_backend_test` database is configured.
3. Confirm the existing database safety guards.
4. Ensure tests cannot accidentally target the development database.

Use appropriate commands when safe:

**Focused test**

`php artisan test --filter=<test-name>`

**Relevant test file**

`php artisan test tests/Feature/<TestFile>.php`

**Complete backend suite**

`php artisan test`

Use actual test names and paths discovered from the repository.

Do not run database-dependent tests when test database isolation cannot be confirmed.

Do not modify environment configuration to force tests to pass.

### 5. Verify Acceptance Criteria

For each applicable acceptance criterion:

- Identify the expected behavior.
- Identify the relevant automated test.
- Record whether the test passed or failed.
- Identify missing test coverage.
- Distinguish automated verification from manual verification.

Pay particular attention to:

- Successful operations
- Validation failures
- Authentication and authorization
- Error handling
- API contracts
- Loading and disabled states
- Regression risks
- Data consistency

Do not claim an acceptance criterion is fully verified solely because TypeScript compilation succeeds.

### 6. Analyze Failures

When verification fails:

1. Identify the failing command.
2. Capture relevant error messages.
3. Identify the affected test or file.
4. Determine whether the failure is related to the requested change.
5. Distinguish confirmed causes from hypotheses.
6. Recommend the smallest next diagnostic or corrective step.

Do not modify production code or weaken tests to make verification pass.

Use the `debug-issue` skill for deeper root-cause investigation when appropriate.

### 7. Recommend Manual Verification

For UI or authentication changes, recommend focused browser tests.

Consider:

- Desktop and mobile layout
- Navigation and redirects
- Loading states
- Error messages
- Keyboard accessibility
- Authentication boundaries
- Session expiration
- API integration behavior

Do not claim manual browser testing passed unless it was actually performed.

### 8. Report Verification Results

Use the following format:

**STATUS:** PASS / PASS WITH WARNINGS / FAIL / BLOCKED

**FEATURE:** Feature or change being verified.

**SCOPE:** Files, components, and behavior included.

**COMMANDS EXECUTED:** Actual commands run.

**TEST RESULTS:** Passed, failed, and skipped tests where available.

**ACCEPTANCE CRITERIA:** Verified, failed, or not covered.

**COVERAGE GAPS:** Important missing automated tests.

**MANUAL CHECKS:** Browser or environment checks still required.

**RECOMMENDED NEXT STEP:** One actionable recommendation.

### 9. Status Definitions

**PASS**

All required executed checks pass, relevant acceptance criteria are supported by verification, and no significant verification gaps remain.

**PASS WITH WARNINGS**

Required checks pass, but non-blocking coverage gaps, skipped checks, or manual verification requirements remain.

**FAIL**

One or more required checks fail, or a required acceptance criterion is demonstrably not satisfied.

**BLOCKED**

Verification cannot be completed because of missing dependencies, unsafe database configuration, unavailable services, or other environmental restrictions.

Never report PASS when required checks were skipped or could not execute.

## Safety Rules

- Verification-only by default.
- Do not modify application source code.
- Do not create or change tests without explicit authorization.
- Do not install dependencies.
- Do not modify environment files.
- Do not run migrations, seeders, database resets, or destructive operations.
- Do not bypass database isolation or safety guards.
- Do not commit or push changes.
- Do not reset branches or discard existing changes.
- Do not weaken assertions to make tests pass.
- Do not expose credentials or environment secrets.
- Avoid commands with unnecessary filesystem or database side effects.

## Efficiency Rules

- Run checks proportional to the requested change.
- Prefer focused tests first.
- Avoid repeating expensive checks unless needed.
- Reuse existing test commands and conventions.
- Report evidence rather than assumptions.
- Keep results concise and actionable.
- Avoid unnecessary implementation recommendations when