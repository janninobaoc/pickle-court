---
name: review-changes
description: Review code changes in the PickleCourt Laravel and Next.js repository. Use when asked to review, audit, inspect, or verify an implementation, recent changes, bug fix, or feature without modifying source code.
---

# Review Changes

## Purpose

Review implementation changes for correctness, security, maintainability, and regressions while following repository guidelines.

This skill is review-only. Do not modify application source code, tests, or configuration.

## Workflow

### 1. Identify Review Scope

- Read the applicable AGENTS.md files.
- Identify the requested feature or implementation.
- Inspect relevant Git changes and source files.
- Do not assume all uncommitted files belong to the current task.
- Identify acceptance criteria from the user's request.
- Ask for clarification only when the intended review scope cannot be determined.

### 2. Inspect Implementation

Review the actual relevant code for:

- Functional correctness
- Requirements and acceptance criteria
- Edge cases and error handling
- Authentication and authorization
- API request and response compatibility
- Duplicate or unnecessary logic
- Code quality and maintainability
- Potential regressions
- Automated test coverage
- Responsive layout and accessibility, when applicable

Distinguish confirmed defects from hypothetical risks.

### 3. Verify Changes

Run appropriate non-destructive checks from the relevant application directory.

**Frontend:**

- `npx.cmd tsc --noEmit`
- `npx.cmd vitest run`
- `npm run lint`, when relevant

Prefer focused tests when practical.

**Backend:**

- Identify relevant PHPUnit tests.
- Verify the dedicated test database and existing safety guards before executing database-dependent tests.
- Do not execute tests if database safety cannot be confirmed.
- Never change database configuration to force tests to pass.

Report tests that could not be executed.

### 4. Report Findings

Use this format:

**STATUS:** PASS / PASS WITH WARNINGS / FAIL

**SUMMARY:** What was reviewed.

**FILES INSPECTED:** Relevant files inspected.

**FINDINGS:** Blocking defects first, then non-blocking warnings.

**VERIFICATION:** Commands executed and actual results.

**REQUIRED CORRECTIONS:** Only necessary fixes.

**NEXT STEP:** One small actionable recommendation.

### 5. Status Definitions

**PASS:** All reviewed acceptance criteria are satisfied, with no identified blocking defects and no significant unresolved verification concerns.

**PASS WITH WARNINGS:** Acceptance criteria appear satisfied, but non-blocking issues or verification limitations remain.

**FAIL:** A required acceptance criterion is unmet or a confirmed blocking defect exists.

Do not classify an unrelated speculative risk as a blocking failure.

## Safety Rules

- Review-only; do not edit project files.
- Do not install dependencies.
- Do not modify environment configuration.
- Do not run migrations, seeders, or database resets.
- Do not commit or push changes.
- Do not reset branches or discard changes.
- Do not bypass security checks.
- Do not weaken tests to obtain passing results.

## Efficiency

- Focus on files relevant to the requested change.
- Avoid inspecting unrelated parts of the repository.
- Avoid repeating instructions already established in AGENTS.md.
- Prioritize confirmed defects and actionable corrections.
- Run verification proportional to the changes.
- Keep reports concise and evidence-based.