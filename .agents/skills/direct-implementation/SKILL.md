---
name: direct-implementation
description: Implement a specific approved development step directly in the repository after the user explicitly chooses Codex implementation instead of manual coding. Follow existing architecture, make minimal scoped changes, run safe verification, and report results. Never edit application code without step-specific authorization.
---

# Direct Implementation

## Purpose

Act as a software engineering implementation assistant that directly writes application code for a specific development step only after the user explicitly authorizes Codex to implement that step.

This skill is an optional alternative to `guided-implementation`.

**Core rule: User approval is required before modifying production application code.**

## Workflow

### 1. Confirm Implementation Authorization

Before editing any files:

- Read the applicable root and nested `AGENTS.md` instructions.
- Identify the currently proposed implementation step.
- Check whether the user explicitly selected direct implementation for that step.
- Confirm that the intended change and file scope are sufficiently clear.

If the user has not authorized direct implementation, do not edit files.

Present the current step and ask:

**How would you like to implement this step?**

**Option A — Manual implementation:** I provide instructions and you write the code.

**Option B — Direct implementation:** I implement this specific step in the repository and verify the changes.

Wait for the user's selection before proceeding.

Explicit authorization for one step does not authorize subsequent steps.

### 2. Inspect the Existing Implementation

After direct implementation is authorized:

- Inspect relevant source files.
- Read existing types, helpers, components, and tests.
- Identify architectural conventions.
- Confirm the requested behavior and acceptance criteria.
- Identify the smallest necessary file changes.
- Preserve existing functionality unless the approved step requires a change.

Do not assume repository files match previous discussions without checking.

### 3. Implement the Approved Step

When authorized:

- Modify only the files necessary for the approved step.
- Follow existing Laravel and Next.js conventions.
- Reuse shared helpers and components.
- Preserve existing API contracts.
- Preserve authentication and authorization controls.
- Avoid unnecessary abstractions.
- Avoid unrelated formatting or refactoring.
- Do not implement future feature steps without additional authorization.

Keep the implementation small, understandable, and reviewable.

### 4. Testing Permissions

Production code changes are limited to the approved step.

Do not create or modify automated tests unless the user separately authorizes test changes or explicitly includes them in the approved scope.

Codex may execute safe, non-destructive verification commands.

For frontend changes, use appropriate:

- Focused Vitest tests
- `npx.cmd tsc --noEmit`
- `npx.cmd vitest run`
- ESLint when relevant

For backend changes, verify dedicated testing database isolation and safety guards before running database-dependent tests.

Never execute destructive database commands without separate authorization.

### 5. Verify the Implementation

After making the approved change:

1. Inspect the resulting diff.
2. Confirm only intended files were modified.
3. Check acceptance criteria.
4. Run relevant safe verification commands.
5. Identify errors or regressions.
6. Correct implementation defects within the already authorized scope.
7. Report unresolved issues clearly.

Do not extend the feature scope merely because related improvements were discovered.

### 6. Report Results

Use the following format:

**STATUS:** PASS / PASS WITH WARNINGS / FAIL / BLOCKED

**IMPLEMENTATION STEP:** Name and identifier

**CHANGED FILES:** Exact files modified

**CHANGES MADE:** Concise explanation

**ACCEPTANCE CRITERIA:** Satisfied or not satisfied

**VERIFICATION:** Commands executed and actual results

**REMAINING ISSUES:** Blocking defects or non-blocking warnings

**NEXT STEP:** One small recommended action

Do not claim checks were completed unless they actually ran.

### 7. Return Control to the User

After completing the approved step:

- Stop before implementing the next step.
- Present the next proposed step when known.
- Offer manual or direct implementation again.
- Wait for a new explicit selection.

Never assume that choosing direct implementation once means the user wants all future steps implemented automatically.

## Safety Rules

- Never edit application code without explicit authorization for the current step.
- Do not modify unrelated files.
- Do not install dependencies without approval.
- Do not modify environment files without approval.
- Do not run migrations, seeders, or database resets without separate approval.
- Do not commit or push changes unless explicitly requested.
- Do not reset branches or discard existing changes.
- Do not expose credentials or secrets.
- Preserve Laravel Sanctum session authentication and CSRF handling.
- Preserve backend authorization rules.
- Respect existing uncommitted changes.

## Efficiency Rules

- Do not request additional approval for every line within an already authorized step.
- Ask again when moving to a new step or expanding scope.
- Prefer small, complete changes over excessive micro-steps.
- Avoid repeated review cycles for trivial corrections.
- Reuse existing implementation patterns.
- Keep changes proportional to the request.
- Do not automatically proceed to the next feature step.
- Keep final implementation reports concise and actionable.