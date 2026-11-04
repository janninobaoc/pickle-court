---
name: plan-feature
description: Plan new features for the PickleCourt Laravel and Next.js application by inspecting the existing architecture, identifying requirements, and creating incremental implementation plans without modifying code.
---

# Plan Feature

## Purpose

Create clear, realistic, incremental implementation plans based on the actual PickleCourt repository.

This skill is planning-only. Do not modify application source code, tests, or configuration.

## Workflow

### 1. Understand the Feature

Identify:

- The problem the feature solves.
- The intended users and their roles.
- Expected behavior.
- Inputs and outputs.
- User journeys.
- Acceptance criteria.
- Relevant business rules.
- Error states and edge cases.

Ask clarifying questions only when missing information materially changes the implementation.

Clearly label assumptions that have not been confirmed.

### 2. Inspect the Existing Codebase

Read applicable `AGENTS.md` files.

Inspect relevant:

**Laravel backend**

- Routes
- Controllers
- Form Requests
- Services
- Models
- Resources
- Policies and authorization
- Database migrations
- Existing tests

**Next.js frontend**

- App Router pages and layouts
- Components
- Hooks
- Contexts
- Shared API helpers
- Types
- Existing tests
- Responsive UI conventions

Inspect only files relevant to the proposed feature.

Do not assume a file, endpoint, database field, or function exists without verification.

### 3. Analyze the Architecture

Determine:

- What functionality already exists.
- What can be reused.
- What is missing.
- Which backend components are responsible.
- Which frontend components are responsible.
- Whether database changes are necessary.
- Which API contracts are involved.
- Authentication and authorization requirements.
- Potential dependencies and compatibility risks.

Prefer existing project conventions over introducing new abstractions.

Preserve Laravel Sanctum session authentication, CSRF handling, and backend authorization.

### 4. Define Acceptance Criteria

Specify observable, testable outcomes.

Include relevant:

- Successful user flows
- Validation failures
- Authorization failures
- Network and server errors
- Loading and disabled states
- Responsive behavior
- Accessibility
- Data consistency

Avoid vague criteria such as "the feature works correctly."

### 5. Create an Incremental Implementation Plan

Break the feature into small, logical steps.

For each step, specify:

1. Objective
2. Relevant files
3. Required changes
4. Dependencies
5. Acceptance criteria
6. Recommended verification
7. Risks or assumptions

Prefer small changes that can be implemented and reviewed independently.

Distinguish required MVP functionality from optional future improvements.

Avoid unnecessary abstractions or premature optimization.

### 6. Evaluate the Plan

Before finalizing:

- Identify missing requirements.
- Identify conflicting business rules.
- Check for unnecessary complexity.
- Check for security and authorization concerns.
- Identify potential API contract mismatches.
- Consider concurrency and data consistency when relevant.
- Identify likely UX problems.
- Identify regression risks.

Do not introduce speculative requirements as mandatory features.

### 7. Recommend Verification

For frontend features, recommend appropriate:

- TypeScript checks
- Vitest tests
- ESLint checks
- Manual browser verification

For backend features, recommend appropriate:

- Unit tests
- Feature tests
- Authorization tests
- Validation tests
- Database safety checks

Do not run migrations, seeders, or destructive database operations during planning.

Do not run the complete test suite unless verification is specifically requested and safe.

### 8. Report the Plan

Use this format:

**FEATURE:** Feature name

**GOAL:** Problem being solved

**CURRENT IMPLEMENTATION:** Relevant existing functionality verified in the repository

**REQUIREMENTS:** Confirmed requirements and labeled assumptions

**ACCEPTANCE CRITERIA:** Testable expected outcomes

**AFFECTED FILES:** Existing files and proposed new files, clearly distinguished

**IMPLEMENTATION PLAN:** Numbered, incremental development steps

**TESTING STRATEGY:** Automated and manual verification

**RISKS AND OPEN QUESTIONS:** Only relevant unresolved issues

**RECOMMENDED FIRST STEP:** One small, actionable implementation task

## Safety Rules

- Planning-only; do not edit application files.
- Do not create migrations or modify schemas.
- Do not install dependencies.
- Do not modify environment files.
- Do not execute destructive database commands.
- Do not commit or push changes.
- Do not reset branches or discard changes.
- Do not modify tests.
- Do not implement features without explicit authorization.

## Efficiency Rules

- Keep plans proportional to feature complexity.
- Inspect relevant files rather than the entire repository.
- Reuse existing architecture and functionality.
- Avoid repeating instructions already documented in `AGENTS.md`.
- Clearly distinguish verified findings, proposed changes, and assumptions.
- Prioritize the smallest useful implementation step.
- Do not produce unnecessary boilerplate or lengthy theoretical explanations.
