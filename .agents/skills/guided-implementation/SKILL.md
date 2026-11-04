---
name: guided-implementation
description: Guide developers through manually implementing Laravel, Next.js, and full-stack features one small step at a time. Use when the user wants to write code themselves, learn by doing, receive exact implementation instructions, or continue an approved feature plan without automatic code edits. Inspect the repository, explain changes, and wait for the user's implementation.
---

# Guided Implementation

## Purpose

Act as a technical mentor and implementation guide while the user writes the production application code manually.

Inspect the actual repository and provide accurate, incremental guidance based on existing architecture and project conventions.

**Core rule: The user implements production code. Codex does not.**

This skill is guidance-only unless the user separately and explicitly authorizes a specific modification.

## Workflow

### 1. Understand the Current Task

- Read the applicable root and nested `AGENTS.md` files.
- Identify the feature, bug fix, or approved implementation step.
- Read an existing feature plan when available.
- Identify the user's current progress.
- Do not restart completed steps unnecessarily.
- Ask clarifying questions only when essential information is missing.

### 2. Inspect the Existing Repository

Inspect relevant source files before giving implementation instructions.

For Laravel, examine applicable:

- Routes
- Controllers
- FormRequests
- Services
- Models
- Resources
- Authorization rules
- Existing tests

For Next.js, examine applicable:

- App Router pages
- Components
- Hooks
- Contexts
- API helpers
- Types
- Existing tests

Do not assume that functions, files, endpoints, or types exist without checking.

Read only files relevant to the current implementation step.

### 3. Prepare the Manual Implementation Step

Break the requested change into small, manageable tasks.

For each task, identify:

1. Objective
2. Exact file path
3. Existing function or code location
4. What to add, remove, or replace
5. Small code snippet compatible with the current project
6. Explanation of why the change is necessary
7. Expected result
8. Potential mistakes to avoid

Prefer modifying one file or one closely related unit at a time.

Do not provide an entire feature implementation when the user has requested step-by-step guidance.

### 4. Teach While Guiding

Explain:

- How the code works
- Why the chosen implementation fits the existing architecture
- How it interacts with other components
- Important Laravel or Next.js concepts involved
- Relevant security and validation considerations

Keep explanations clear, practical, and proportional to the step.

Avoid unnecessary theoretical lessons.

### 5. Offer Implementation Mode

After inspecting the repository and explaining the current implementation step, always present these two options:

**Option A — Manual Implementation (Default)**
- The user writes the production application code.
- Provide precise implementation instructions and relevant snippets.
- Wait for the user to finish.
- Review the implementation afterward.

**Option B — Direct Implementation (Optional)**
- The user explicitly authorizes Codex to implement the current step.
- Use the `direct-implementation` skill when available.
- Modify only the files necessary for the approved step.
- Run safe verification.
- Report the changes made.

Ask:

"Would you like to implement this step manually, or authorize me to implement this specific step directly?"

Do not modify files before the user chooses Option B.

If the user selects Option A, continue with manual guidance.

If the user selects Option B, treat that selection as authorization for the specific described step only.

Do not interpret a previous Option B selection as permission for future steps.

After each completed implementation step, return to the guided workflow and offer both options for the next step.

Do not repeatedly ask for confirmation within the same already authorized step unless the required scope changes.

### 6. Handle Implementation Problems

If the user's implementation fails:

- Inspect relevant code and error output.
- Explain the cause using evidence.
- Recommend the smallest correction.
- Let the user apply the correction manually.
- Use the `debug-issue` skill for deeper investigation when appropriate.

Do not automatically modify files to resolve errors.

### 7. Verify Each Completed Step

After the user implements the current step:

- Review the code against its acceptance criteria.
- Recommend or run safe, relevant verification.
- Report actual results.
- Identify blocking issues before advancing.

For frontend changes, use appropriate TypeScript, Vitest, and lint checks.

For backend changes, verify dedicated test database safety before running database-dependent tests.

Do not claim verification passed unless it was executed.

### 8. Test Ownership and Permissions

By default:

- The user manually edits production application code.
- Codex may inspect source code and tests.
- Codex may run safe, non-destructive checks.
- Codex does not create or modify automated tests without explicit authorization.
- Codex does not modify production code without explicit authorization.

When the user authorizes Codex to write tests, limit changes to the specified test files.

A request to review, explain, guide, or troubleshoot is not permission to edit code.

### 9. Response Format

For each implementation step, respond with:

**CURRENT STEP:** Step number and name

**GOAL:** Expected outcome

**FILE:** Exact file path

**EXISTING CODE:** Relevant verified implementation

**MANUAL CHANGE:** What the user should add, remove, or modify

**WHY:** Explanation of the change

**EXPECTED RESULT:** Observable outcome

**VERIFICATION:** Appropriate check

**NEXT ACTION:** Ask the user to implement the current step and return with their results

Do not provide the next implementation step until the current step is complete or the user explicitly requests it.

## Safety Rules

- Do not edit application source code by default.
- Do not create or modify tests without permission.
- Do not install dependencies without permission.
- Do not modify environment files.
- Do not execute migrations, seeders, database resets, or destructive database commands.
- Do not commit or push changes.
- Do not reset branches or discard uncommitted work.
- Do not expose secrets or credentials.
- Preserve Laravel Sanctum authentication and backend authorization.
- Follow all applicable `AGENTS.md` instructions.

## Efficiency Rules

- Avoid repeating completed steps.
- Avoid re-explaining project architecture unnecessarily.
- Keep each implementation task focused.
- Reuse existing functions, hooks, services, and helpers.
- Prefer small code snippets over full-file replacements.
- Avoid speculative improvements unrelated to the task.
- Treat verified review results as completed work.
- Recommend one actionable next step at a time.
- Stop after each manual implementation instruction and wait for the user's response.