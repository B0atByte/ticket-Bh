---
name: universal-project-engineering
description: Universal, project-aware engineering workflow for safely working in any software repository regardless of language, framework, or stack. Use when Codex is asked to inspect, build, debug, refactor, test, secure, document, or modify any project; when the project stack is unknown; when choosing commands, conventions, architecture, or verification steps; or when coordinating frontend, backend, database, CI/CD, dependency, AI-agent, and security-sensitive changes.
---

# Universal Project Engineering

## Overview

Use this skill as the default operating guide for any software project. First understand the repository, then choose the smallest safe workflow that fits the stack and task.

## First Pass

Before editing, build a quick map of the project:

- Identify the language, package manager, framework, build system, test runner, database, deployment target, and entry points.
- Read README, package/config files, scripts, CI workflow, environment examples, and nearby tests.
- Check current git state before editing; preserve user-made changes.
- Prefer existing project commands over generic commands.
- If commands are missing, infer the least risky verification path and state the assumption.

## Universal Workflow

1. Understand the task.
   - Separate requested behavior from implementation guesses.
   - Ask only when a wrong assumption could cause data loss, security exposure, broken compatibility, or large wasted work.

2. Locate the smallest relevant surface.
   - Search for existing implementations, helpers, tests, types, schemas, routes, components, jobs, and config.
   - Avoid broad rewrites unless the task explicitly requires one.

3. Choose the playbook.
   - Use the sections below that match the work: frontend, backend, database, testing, CI/CD, dependencies, AI agents, or security.
   - Combine playbooks when a task crosses boundaries.

4. Implement conservatively.
   - Match the repository's style, naming, error handling, validation, and folder structure.
   - Add abstractions only when they remove real duplication or protect a clear boundary.
   - Keep changes reviewable and directly connected to the request.

5. Verify.
   - Run the narrowest useful checks first, then broader checks when risk justifies it.
   - Prefer project scripts such as test, lint, typecheck, build, format:check, audit, or e2e.
   - Add focused tests for behavior changes, bug fixes, and security decisions.

6. Deliver clearly.
   - State what changed, why it is safe, what was verified, and what remains unverified.
   - Include exact commands run and meaningful failures.

## Frontend Playbook

Use when touching UI, client state, forms, routing, styling, accessibility, or browser behavior:

- Preserve existing design system, component patterns, spacing, typography, icons, and state conventions.
- Implement loading, empty, disabled, error, success, and validation states where users can encounter them.
- Validate forms on the client for usability, but rely on server validation for trust.
- Prevent XSS by avoiding unsafe HTML injection and by treating API/model output as untrusted.
- Check keyboard navigation, labels, focus states, contrast, responsive layout, and text overflow.
- Verify with build, lint/typecheck, unit tests, and browser smoke tests when available.

## Backend and API Playbook

Use when touching routes, services, controllers, jobs, auth, integrations, validation, or server-side logic:

- Validate input at the server boundary.
- Enforce authorization on the exact resource and action.
- Use typed DTOs, schemas, serializers, or validators already used by the project.
- Handle errors explicitly; return stable client-safe errors and log server-safe diagnostics.
- Use timeouts and retries deliberately for external calls.
- Avoid leaking secrets, tokens, stack traces, private data, or internal identifiers.
- Verify allowed, denied, invalid, and failure paths.

## Database Playbook

Use when touching schema, migrations, seed data, queries, indexes, transactions, or persistence:

- Prefer reversible, incremental migrations.
- Preserve existing data unless deletion is explicitly requested and safe.
- Consider nullability, defaults, uniqueness, foreign keys, indexes, and backfills.
- Use transactions where partial writes would corrupt state.
- Avoid N+1 queries and unbounded reads on user-controlled filters.
- Test migration, rollback if supported, and affected queries.

## Testing and Verification Playbook

Use for every code change:

- Prefer tests that fail before the fix and pass after it.
- Cover core behavior, edge cases, regression cases, and security denials.
- Keep tests deterministic; avoid real network, wall-clock, random, and production services unless the project already controls them.
- Run targeted tests first, then the relevant suite.
- If tests are impossible to run, explain the blocker and provide the command.

## CI/CD and Operations Playbook

Use when touching workflows, Docker, deployment, environment, release, infrastructure, or scripts:

- Treat CI/CD as production-sensitive code.
- Do not print secrets, write credentials to artifacts, or broaden permissions unnecessarily.
- Keep workflow permissions minimal.
- Pin actions/images/dependencies where the project requires reproducibility.
- Add caching only when correctness cannot be affected by stale artifacts.
- Verify with local build scripts and, when possible, the same commands CI runs.

## Dependency and Supply Chain Playbook

Use when installing, removing, upgrading, or auditing packages:

- Prefer existing dependencies and standard libraries before adding new packages.
- Check maintenance, license compatibility, vulnerability status, package reputation, and transitive impact when practical.
- Avoid broad version upgrades unless requested.
- Preserve lockfiles and package manager conventions.
- Run install, build, tests, and audit commands appropriate to the repo.

## AI Agent and LLM Playbook

Use when building systems that call models, tools, MCP servers, browsers, files, shell commands, databases, or external APIs:

- Treat model input and output as untrusted.
- Defend against prompt injection, indirect prompt injection, tool misuse, excessive agency, secret exposure, and unsafe output handling.
- Give agents least-privilege tools and scoped credentials.
- Require human approval for destructive, financial, privacy-sensitive, or externally visible actions.
- Validate model output before using it in code execution, database writes, commands, HTML, URLs, or API calls.
- Log enough for auditability without storing secrets or sensitive prompts unnecessarily.

## Security Baseline

Apply to all projects:

- Validate untrusted input.
- Authorize server-side actions.
- Avoid injection through SQL, shell, paths, templates, HTML, serialization, and command construction.
- Protect secrets and personal data.
- Use safe file handling and archive extraction.
- Set secure defaults for cookies, CORS, redirects, permissions, and network access.
- Avoid inventing cryptography.
- Fail closed when safety checks are uncertain.

## Stop Conditions

Pause and ask for confirmation before:

- Deleting data, rewriting history, force-pushing, rotating credentials, changing production deployment, or running destructive commands.
- Making a breaking API/schema change not requested by the user.
- Expanding access permissions, disabling security checks, or bypassing tests.
- Continuing after discovering unrelated user changes that directly conflict with the task.
