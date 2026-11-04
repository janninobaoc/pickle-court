# Repository Guidelines

## Project Structure

This repository contains two applications:

- **Laravel Backend:** `backend-laravel/system-backend/`
  - Application code: `app/`
  - Routes: `routes/`
  - Migrations, factories, and seeders: `database/`
  - Automated tests: `tests/`

- **Next.js Frontend:** `frontend-nextjs/system-frontend/`
  - Routes and UI: `app/`
  - Shared contexts: `contexts/`
  - Types: `app/types/`
  - API helpers: `app/lib/`
  - Static assets: `public/`
  - Automated tests: `tests/`

Read the frontend's nested `AGENTS.md` before modifying Next.js code. Follow the relevant installed Next.js documentation under `node_modules/next/dist/docs/` when available.

## Development and Test Commands

Run commands from the relevant application directory.

### Frontend — `frontend-nextjs/system-frontend/`

- `npm run dev` — Start the Next.js development server.
- `npm run build` — Create a production build.
- `npm run lint` — Run ESLint.
- `npm test` — Run Vitest using the configured test script.
- `npx.cmd tsc --noEmit` — Check TypeScript without generating output files.
- `npx.cmd vitest run` — Run the complete frontend test suite once.

### Backend — `backend-laravel/system-backend/`

- `php artisan serve` — Start the Laravel development server.
- `php artisan test` — Run PHPUnit/Pest-compatible tests.
- `composer test` — Execute the configured Composer test script, including Laravel configuration clearing.

### Verification Rules

- Run relevant focused tests before the full test suite when appropriate.
- For frontend changes, run TypeScript checks and relevant Vitest tests.
- Run ESLint when relevant.
- For backend changes, verify the dedicated test database and safety guards before executing database-dependent tests.
- Run production builds when necessary, not automatically after every minor change.
- Report the actual commands executed and their results.
- Never claim tests passed unless they were executed successfully.
- If verification cannot run, explain the reason.
- Do not weaken test assertions or bypass security controls to make tests pass.

### Database Safety

Backend tests use the dedicated `system_backend_test` database and an existing safety guard.

- Never point tests at the development database.
- Do not run migrations, resets, seeders, or destructive database commands without explicit authorization.
- Do not modify database configuration simply to force tests to pass.
- If database safety cannot be verified, stop and report the issue.

## Style and Naming

Follow existing code patterns and framework conventions.

- Use two-space indentation.
- Follow existing React component naming conventions, using PascalCase where established.
- Name custom hooks using `use-*.ts` or `use-*.tsx`.
- Use kebab-case filenames for utilities.
- Name frontend tests `*.test.ts` or `*.test.tsx`.
- Follow Laravel naming conventions for PHP classes.
- Keep API access in shared frontend helpers.
- Keep backend business rules in appropriate service and FormRequest layers.
- Reuse existing components, hooks, services, and utilities where appropriate.
- Avoid unrelated formatting changes, unnecessary abstractions, and duplicate logic.

## Testing Guidelines

- Write frontend tests under `frontend-nextjs/system-frontend/tests/` using Vitest.
- Mock network requests rather than depending on real external API calls.
- Write backend tests under `backend-laravel/system-backend/tests/Feature/` or `Unit/`, following existing PHPUnit-style classes and naming conventions.
- Test relevant success, failure, authorization, and edge-case behavior.
- Prefer focused regression tests for fixed bugs.
- Do not modify tests merely to hide failing application behavior.
- Distinguish automated verification from manual browser testing.

## AI-Assisted Development Workflow

Follow this workflow when handling development tasks:

1. Understand the requested feature, issue, or change.
2. Inspect the actual relevant repository files.
3. Identify dependencies, existing patterns, and risks.
4. Establish clear acceptance criteria.
5. Prepare a small, incremental implementation plan when appropriate.
6. Implement only when explicitly authorized.
7. Review the implementation against acceptance criteria.
8. Run suitable verification.
9. Report the outcome, remaining issues, and next actionable step.

For new features, identify frontend and backend responsibilities before implementation.

Prefer existing architectural patterns:

- **Laravel:** Controllers, FormRequests, services, resources, models, and authorization.
- **Next.js:** App Router, components, hooks, contexts, shared API helpers, responsive styling, and accessibility.

Preserve existing API contracts unless changes are explicitly requested.

Avoid excessive planning or repeated review cycles for trivial changes.

### Permission Defaults

**Review-only is the default for inspection requests.**

When asked to inspect, investigate, audit, review, debug, or prepare an implementation guide:

- Inspect and analyze existing source code.
- Identify problems and recommend specific corrections.
- Run safe, non-destructive verification when appropriate.
- Do not modify application code or tests without authorization.

When explicitly authorized to implement or fix something:

- Make the smallest necessary change.
- Modify only relevant files.
- Preserve unrelated behavior and styling.
- Avoid unrelated refactoring.
- Do not add dependencies without approval.
- Explain significant architectural changes before implementation.
- Verify the completed change without requiring an unnecessary separate review round.

An explicit implementation request authorizes the requested change, not unrelated changes.

For incremental guided development, present each implementation step before editing and offer Manual Implementation (default) or Direct Implementation (optional). Direct implementation requires explicit authorization for the specific step and file scope. Authorization does not carry over to later steps. After completing a step, verify it and ask for the implementation mode again before proceeding.

### Incremental Development

- Implement one logical feature or correction at a time.
- Prefer small, reviewable changes over large rewrites.
- Reuse existing code where possible.
- Avoid introducing additional state or abstractions without a clear purpose.
- Identify the affected files and expected behavior before changing code.
- For manual implementation requests, provide precise instructions without modifying files.
- Proceed to the next development step only after addressing blocking issues from the current step.

### Code Review Standards

Review actual repository files, not assumptions from previous conversations.

Check:

- Functional correctness
- Acceptance criteria
- Edge cases and error handling
- Authentication and authorization
- Compatibility with existing code
- Duplicate or unnecessary logic
- Unused imports and state
- Responsive UI behavior
- Accessibility
- Relevant regression risks

Distinguish blocking defects from optional improvements.

Avoid repeatedly recommending speculative hardening without a concrete, relevant risk.

Use this report format:

```text
STATUS: PASS / PASS WITH WARNINGS / FAIL

SUMMARY:
Brief description of the changes reviewed.

FINDINGS:
Blocking defects first, followed by non-blocking warnings.

VERIFICATION:
Commands executed and actual results.

REQUIRED CORRECTIONS:
Only changes necessary to satisfy the requirements.

NEXT STEP:
One small, actionable recommendation.
```

Do not report PASS when a required acceptance criterion remains unmet.

### Debugging Workflow

When investigating bugs:

1. Identify observed behavior.
2. Identify expected behavior.
3. Trace the relevant execution path.
4. Establish the likely root cause using available evidence.
5. Recommend or implement the smallest appropriate correction based on authorization.
6. Verify the result.
7. Recommend focused regression tests where useful.

Do not apply unrelated fixes before establishing the root cause.

## Authentication and Security

Preserve the existing Laravel Sanctum session-based authentication architecture.

- Maintain cookie/session authentication and CSRF protection.
- Do not replace session authentication with bearer tokens without approval.
- Preserve role-based backend authorization.
- Treat frontend role guards as UI and navigation controls only.
- Keep the Laravel API as the authorization authority.
- Preserve existing login, registration, logout, and session-refresh behavior unless changes are explicitly requested.
- Never expose credentials, API keys, or environment secrets.
- Never bypass authorization to resolve failing tests.

## Git and Repository Safety

- Do not commit unless explicitly requested.
- Do not push unless explicitly requested.
- Do not reset branches or discard uncommitted changes without approval.
- Do not overwrite unrelated user changes.
- Inspect relevant Git changes when useful for reviewing modifications.
- Keep each implementation scoped to the requested task.

## Commits and Pull Requests

Recent commits use short, descriptive lowercase subjects. No strict prefix convention is established.

When commits or pull requests are explicitly requested:

- Keep commit subjects concise and descriptive.
- Summarize behavior and changed files.
- Include actual verification results.
- Link related work when available.
- Include screenshots for relevant UI changes.
- Explain database or configuration implications.

## Manual UI Verification

Automated tests do not guarantee visual correctness or complete browser functionality.

For UI and authentication changes, recommend focused browser checks covering:

- Desktop and mobile layouts
- Navigation and redirects
- Loading and disabled states
- Error messages and recovery
- Accessibility and keyboard interaction
- Authentication and authorization boundaries

Do not claim browser testing passed unless it was actually performed.

## Communication and Efficiency

- Be concise, specific, and actionable.
- Reference exact files and functions when reporting findings.
- Distinguish verified evidence from assumptions.
- Avoid repeating documented repository context.
- Avoid repeating resolved warnings.
- Prefer targeted code snippets instead of rewriting entire files.
- Do not introduce unrelated tasks.
- Ask clarifying questions only when necessary.
- For minor fixes, avoid unnecessary multi-round approval or review cycles when implementation has already been authorized.
- Summarize changed files, verification results, remaining risks, and the next recommended step after completing a task.