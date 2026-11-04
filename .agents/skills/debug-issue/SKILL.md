---
name: debug-issue
description: Diagnose and troubleshoot bugs, errors, failed tests, API integration issues, authentication problems, and unexpected behavior in Laravel and Next.js applications. Inspect relevant code and logs, identify evidence-based root causes, and recommend minimal fixes without modifying files unless explicitly authorized.
---

# Debug Issue

## Purpose

Systematically investigate problems in the PickleCourt application, identify evidence-supported root causes, and recommend the smallest reliable correction.

This skill is investigation-only by default. Do not modify application source code, tests, database contents, or configuration.

## Workflow

### 1. Understand the Problem

Identify:

- Observed behavior
- Expected behavior
- Error messages and logs
- Steps to reproduce
- Affected feature or page
- Relevant frontend or backend components
- When the problem started
- Recent relevant code changes

Use information already supplied by the user.

Ask for additional details only when necessary to establish the cause.

Do not invent missing error messages or reproduction results.

### 2. Inspect Relevant Files

Read the applicable `AGENTS.md` instructions.

Inspect relevant files rather than searching the entire repository unnecessarily.

For Laravel issues, inspect as applicable:

- API routes
- Controllers
- Form Requests
- Services
- Models and relationships
- Resources
- Middleware and authorization
- Database-related configuration
- Relevant application logs
- Existing automated tests

For Next.js issues, inspect as applicable:

- App Router pages and layouts
- Components
- Hooks
- Contexts
- API helpers
- Environment-variable usage
- Authentication guards
- Relevant error logs
- Existing automated tests

For integration issues, trace the request across frontend and backend boundaries.

### 3. Trace the Execution Flow

Identify the actual execution path from the triggering action to the failing operation.

When relevant, examine:

- User interaction
- Frontend event handler
- API helper
- HTTP request and response
- Backend route and middleware
- Controller and service logic
- Database query
- Response transformation
- Frontend state updates
- UI rendering and navigation

Identify where actual behavior differs from expected behavior.

Do not assume the first visible error is the underlying cause.

### 4. Investigate Common Failure Categories

Evaluate only categories relevant to the reported issue.

**Frontend**

- Incorrect state updates
- Rendering errors
- Missing or incorrect dependencies
- Invalid API response assumptions
- TypeScript errors
- Route or redirect issues
- Responsive layout problems

**Backend**

- Validation errors
- Business-rule errors
- Authorization failures
- Incorrect API responses
- Database query errors
- Model or relationship problems
- Route and middleware issues

**Integration**

- Incorrect API base URLs
- CORS issues
- CSRF protection
- Sanctum session authentication
- Cookie and credential handling
- HTTP status codes
- API contract mismatches

**Development environment**

- Port conflicts
- Incorrect environment configuration
- Missing dependencies
- Service startup failures
- Development versus testing database mismatches

Do not expose secrets while inspecting configuration or logs.

### 5. Form and Verify Hypotheses

For each relevant hypothesis:

1. State the suspected cause.
2. Identify supporting evidence.
3. Identify contradictory or missing evidence.
4. Perform safe, non-destructive checks when available.
5. Update the diagnosis based on results.

Prefer reproducible evidence over speculation.

Do not claim a root cause is confirmed without sufficient evidence.

If multiple explanations remain possible, rank them by supporting evidence and propose the smallest next diagnostic check.

### 6. Recommend the Smallest Fix

Once the cause is sufficiently understood:

- Identify the exact relevant file and function.
- Explain why the bug occurs.
- Recommend the smallest correction.
- Preserve existing architecture and behavior.
- Avoid unrelated refactoring.
- Consider authentication, authorization, data integrity, and compatibility.
- Explain meaningful trade-offs when necessary.

Do not modify files unless a separate explicit implementation authorization is given.

If the user authorizes implementation, follow the repository's implementation and safety rules.

### 7. Recommend Verification

Identify appropriate checks to confirm the fix.

For frontend issues:

- Relevant focused Vitest tests
- `npx.cmd tsc --noEmit`
- `npx.cmd vitest run` when appropriate
- ESLint when relevant
- Manual browser reproduction

For backend issues:

- Relevant focused PHPUnit tests
- Feature or authorization tests
- API response verification
- Existing dedicated test database safety checks

Do not run database-dependent tests unless the dedicated test configuration and safety guards are verified.

Do not execute destructive database operations.

### 8. Report Findings

Use this format:

**STATUS:** ROOT CAUSE CONFIRMED / LIKELY CAUSE / INCONCLUSIVE

**ISSUE:** Brief description of the observed problem.

**EXPECTED BEHAVIOR:** What should happen.

**ROOT CAUSE:** Confirmed explanation or current evidence-supported hypothesis.

**EVIDENCE:** Relevant files, functions, logs, or test results.

**RECOMMENDED FIX:** The smallest appropriate correction.

**VERIFICATION:** Checks performed and suggested regression tests.

**NEXT STEP:** One actionable recommendation.

If the evidence is insufficient, state what specific information or diagnostic check is needed next.

## Safety Rules

- Default to investigation-only.
- Do not modify source files or tests without authorization.
- Do not install or update dependencies without approval.
- Do not modify environment files.
- Do not expose passwords, API keys, session tokens, or credentials.
- Do not run migrations, seeders, resets, or destructive database operations.
- Do not start, stop, or reconfigure system services without authorization.
- Do not commit or push changes.
- Do not reset branches or discard user changes.
- Do not disable security controls to work around errors.

Use safe, non-destructive diagnostics only.

## Efficiency Rules

- Inspect only files relevant to the issue.
- Avoid repeating debugging steps that have already been completed and verified.
- Do not recommend multiple unrelated fixes at once.
- Separate confirmed defects from possible risks.
- Prefer one evidence-based correction over broad refactoring.
- Do not repeatedly request information already available in logs or source files.
- Keep debugging reports clear, concise, and actionable.
