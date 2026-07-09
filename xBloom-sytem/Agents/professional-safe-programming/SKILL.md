---
name: professional-safe-programming
description: Professional software engineering workflow for implementing, reviewing, debugging, refactoring, and documenting code with strong safety, security, maintainability, and verification discipline. Use when Codex is asked to write production-quality code, fix bugs, add features, review changes, improve architecture, handle secrets or authentication, modify data access, change APIs, update dependencies, create tests, or make any security-sensitive programming change.
---

# Professional Safe Programming

## Overview

Use this skill to produce code that is correct, maintainable, secure by default, and consistent with the existing project. Treat every change as production-bound unless the user explicitly says it is a throwaway prototype.

## Operating Workflow

1. Clarify the target only when necessary.
   - If the request is actionable, proceed using reasonable assumptions.
   - Ask before making irreversible, destructive, externally visible, or high-risk changes.
   - If the user asks only for analysis, explanation, or a review, do not edit files unless asked.

2. Read the codebase before deciding.
   - Inspect nearby files, tests, configuration, dependencies, and existing conventions.
   - Prefer established local patterns over new abstractions.
   - Identify ownership boundaries, public APIs, data contracts, and migration risks.
   - Check for uncommitted or user-made changes before editing files you touch.

3. Plan the smallest safe change.
   - Keep the blast radius narrow.
   - Avoid unrelated formatting, rewrites, dependency upgrades, or architecture changes.
   - Choose boring, explicit code over clever code.
   - Preserve backwards compatibility unless the user requested a breaking change.

4. Implement with safety controls.
   - Validate all untrusted input at trust boundaries.
   - Enforce authorization on server-side operations; do not rely on UI checks.
   - Use parameterized queries or ORM-safe APIs for database access.
   - Do not hardcode secrets, tokens, private keys, credentials, or environment-specific values.
   - Avoid logging sensitive data, including passwords, tokens, cookies, personal data, and full payment details.
   - Handle errors explicitly without leaking internals to end users.
   - Use safe defaults for permissions, CORS, cookies, redirects, file paths, serialization, and cryptography.
   - Make concurrent, retry, timeout, and cancellation behavior deliberate when relevant.

5. Verify the result.
   - Run the most relevant tests, type checks, linters, builds, or smoke checks available.
   - Add or update focused tests when behavior changes, a bug is fixed, or a regression risk exists.
   - For security-sensitive code, test both allowed and denied paths.
   - If verification cannot be run, state exactly why and provide the command that should be run.

6. Report clearly.
   - Summarize what changed and where.
   - Include verification performed and any remaining risk.
   - Mention assumptions only when they affect correctness, safety, or future maintenance.

## Engineering Standards

Write code that a strong maintainer would accept:

- Prefer simple control flow, clear names, and explicit data shapes.
- Keep functions and modules cohesive; split only when it reduces real complexity.
- Make invalid states hard to represent where the language allows it.
- Use typed interfaces, schema validation, or assertions at important boundaries.
- Avoid swallowing exceptions; preserve useful diagnostic context.
- Keep comments rare and useful: explain intent, invariants, or non-obvious tradeoffs.
- Make configuration environment-driven, documented by existing project patterns, and fail fast when required values are missing.
- Respect accessibility, internationalization, and responsive behavior in user-facing code.

## Security Checklist

Apply this checklist before finishing any change that touches users, data, auth, network calls, files, dependencies, or execution:

- Authentication: verify identity using the project's trusted mechanism.
- Authorization: check the actor is allowed to perform the exact action on the exact resource.
- Input validation: validate type, size, format, range, and allowed values.
- Injection: avoid SQL, shell, template, LDAP, path, and HTML/script injection.
- Secrets: never commit, print, expose, or persist secrets outside approved secret storage.
- Data privacy: minimize collection, retention, exposure, and logs of personal or sensitive data.
- File handling: normalize paths, restrict directories, check file type and size, avoid unsafe extraction.
- Network calls: use timeouts, handle failures, validate URLs, and block unsafe redirects where relevant.
- Dependencies: avoid unnecessary packages; prefer maintained packages already used by the repo.
- Cryptography: use standard libraries and established project helpers; do not invent algorithms.

## Review Mode

When asked to review code, prioritize findings over summaries:

- Lead with concrete bugs, security issues, regressions, race conditions, missing tests, and maintainability risks.
- Cite exact files and lines when possible.
- Explain impact and a practical fix.
- Do not list low-value style preferences unless they hide a real defect.
- If no issues are found, say so and name any verification gaps.

## Risk Triggers

Pause and reassess before continuing when a change involves:

- Data deletion, migration, payment, authentication, authorization, encryption, production credentials, CI/CD deployment, legal or compliance logic.
- Broad rewrites across unrelated modules.
- Ambiguous requirements where a wrong assumption could expose data or break production behavior.
- A failing test that appears unrelated but could indicate hidden coupling.

## Delivery Format

When finishing a coding task, include:

- The important files changed.
- The behavior implemented or fixed.
- The verification command results.
- Any limitations, skipped tests, or follow-up work that matters.
