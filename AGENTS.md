# AGENTS.md

## Purpose

This file defines the operating rules, coding standards, architecture constraints, and production expectations for AI coding agents working on **CookMate**.

CookMate is a full-stack application with a separated frontend and backend architecture. Any agent contributing code must follow this document exactly unless a human maintainer explicitly overrides a rule.

---

## Project Goal

CookMate should be built as a **production-grade, maintainable, secure, and extensible** application.

Primary goals:

* Keep the codebase clean and easy for humans to maintain
* Preserve a clear separation of concerns between frontend, backend, and database layers
* Avoid fragile shortcuts, hidden behavior, and overengineering
* Make local development simple
* Ensure deployment is realistic for production environments
* Prefer explicit, testable code over clever abstractions

---

## Current Project Structure

```text
cookmate
│
├── client
│   ├── components
│   ├── pages
│   ├── hooks
│   └── styles
│
├── server
│   ├── controllers
│   ├── routes
│   ├── services
│   │   ├── agent
│   │   ├── vision
│   │   └── media
│   └── utils
│
├── database
│   └── migrations
│
└── README.md
```

Agents must preserve this structure unless a maintainer requests a deliberate refactor.

---

## Non-Negotiable Rules

### 1. Never break layer boundaries

* `client/` must not contain backend business logic
* `server/routes/` should only define route wiring
* `server/controllers/` should handle request/response orchestration only
* `server/services/` should contain business logic and integrations
* `database/migrations/` should contain schema evolution only
* Utility code belongs in `server/utils/` only if it is truly shared and generic

### 2. Do not hardcode secrets

* Never hardcode API keys, tokens, passwords, DB URLs, or secrets
* All secrets must come from environment variables
* If a variable is required, document it in `.env.example` and README

### 3. Prefer minimal, explicit implementations

* Do not introduce frameworks, abstractions, or dependencies without a strong reason
* Do not create “helper” layers that hide simple logic unnecessarily
* Do not add code that is speculative or not used yet

### 4. Production code must fail safely

* Validate all inputs
* Handle errors explicitly
* Return structured JSON errors from the backend
* Never leak stack traces or secrets to the client

### 5. Keep the app runnable at all times

* Any change should preserve a working local dev flow
* If adding a feature, do not break the health route or baseline boot sequence

---

## Expected Tech Direction

Unless otherwise specified by maintainers, agents should align with this stack direction:

### Frontend

* React or Next.js frontend in `client/`
* Use functional components
* Use hooks for stateful behavior
* Keep pages thin and move reusable UI into `components/`
* Keep fetch/API logic out of presentation-heavy components when possible

### Backend

* Node.js + Express
* `cors` configured intentionally, never permissively in production without reason
* Route prefix should be consistent across the app
* JSON request/response contract must be stable and explicit

### Database

* Use migrations for every schema change
* Never modify production schema manually without recording the migration
* Avoid destructive migrations unless explicitly approved

---

## Canonical API Conventions

### Health Endpoint

The baseline connectivity route should remain stable.

**Preferred canonical route:**

* `GET /api/health`

**Expected response:**

```json
{
  "status": "success",
  "message": "frontend and backend connected"
}
```

Rules:

* Do not rename this route casually
* Do not change the response shape without updating frontend usage and docs
* Use JSON, never plain text responses for API routes

### API Response Format

Successful responses should generally follow:

```json
{
  "status": "success",
  "data": {},
  "message": "Optional human-readable message"
}
```

Error responses should generally follow:

```json
{
  "status": "error",
  "error": {
    "code": "SOME_ERROR_CODE",
    "message": "Human-readable explanation"
  }
}
```

Rules:

* Be consistent across endpoints
* Do not return raw thrown errors
* Avoid ambiguous response shapes

---

## Frontend Rules

### File organization

* `pages/` = route-level screens/pages
* `components/` = reusable UI components
* `hooks/` = reusable hooks only
* `styles/` = global or modular style assets

### Frontend coding standards

* Prefer clear state names
* Avoid large components that mix rendering, fetching, and transformation logic
* Keep side effects in `useEffect` or dedicated hooks
* Clean up subscriptions, timers, and listeners
* Do not duplicate API URLs across many files; centralize configuration

### Networking

* Frontend should call backend through configured base URL
* Use environment variables for API base URLs
* Do not hardcode localhost values directly inside many components

Example:

* Local frontend: `http://localhost:3000`
* Local backend: `http://localhost:5000`
* Health check call: `GET http://localhost:5000/api/health`

### UX rules

* Show loading states for async actions
* Show user-friendly error states
* Do not silently fail
* Never expose raw server traces in the UI

---

## Backend Rules

### Route/controller/service split

#### Routes

Routes should:

* Define HTTP method and path
* Attach middleware
* Hand off to controller functions
* Avoid business logic

#### Controllers

Controllers should:

* Read request params/body/query
* Call services
* Map service output to HTTP response
* Handle expected errors cleanly
* Stay thin

#### Services

Services should:

* Contain core business logic
* Talk to external APIs, models, media processing, or DB layers
* Be testable in isolation
* Avoid direct Express request/response usage

### Middleware expectations

Agents should add middleware thoughtfully when needed:

* JSON body parsing
* CORS
* Request logging
* Error handling middleware
* Authentication/authorization middleware when protected routes are added
* Rate limiting for public endpoints if relevant
* Input validation middleware for non-trivial endpoints

### Error handling

* Centralize backend error handling where possible
* Use consistent HTTP status codes
* 400 for validation issues
* 401 for unauthenticated
* 403 for unauthorized
* 404 for missing resources
* 409 for conflicts
* 429 for rate limits
* 500 for unexpected internal errors

### Logging

* Use structured logs where possible
* Log useful context, but never secrets
* Keep logs readable in development and production

---

## Reinforcement Learning and Agent Memory Rules

CookMate may include agents that improve through feedback loops, evaluation traces, user corrections, or reward-style signals. Any reinforcement-learning-inspired behavior must follow these rules.

### Allowed RL-style behavior

* Use explicit feedback signals such as thumbs up/down, task success/failure, correction acceptance, completion quality, or evaluator scores
* Store learning signals in a structured, inspectable format
* Keep learning logic separated from request handling logic
* Prefer offline evaluation and controlled updates over self-modifying production behavior

### Not allowed

* Do not let agents rewrite core production logic autonomously at runtime
* Do not let model outputs directly change system prompts, policies, permissions, or routing rules without human review
* Do not treat unverified user behavior as a trustworthy reward signal
* Do not create hidden memory that cannot be inspected or cleared

### RL architecture guidance

If RL or adaptive behavior is added, keep it split into clear layers:

* `server/services/agent/` for orchestration
* `server/services/agent/memory/` for persistent memory or summaries
* `server/services/agent/evals/` for scoring and evaluation logic
* `server/services/agent/policies/` for routing, policy versions, and decision rules
* `server/services/agent/feedback/` for explicit user feedback capture

### Learning loop requirements

Any learning loop must:

* be versioned
* be auditable
* be reversible
* support human override
* log why a change happened
* avoid contaminating production memory with low-quality or adversarial data

### Safe update pattern

Preferred order:

1. collect interaction data
2. score outcomes with explicit metrics
3. summarize useful patterns
4. review changes offline or behind a feature flag
5. promote only validated improvements into production

### Reward signal guidance

Acceptable reward-like signals may include:

* task completed successfully
* user accepted generated result
* user manually corrected output
* latency stayed within target
* safety checks passed
* evaluator score exceeded threshold

Reward signals must never be assumed perfect. They should be treated as noisy indicators, not ground truth.

### Memory and context retention

If the agent stores memory/context for future tasks:

* store concise summaries, not raw uncontrolled transcripts unless required
* tag memory with timestamps, source, task type, and confidence
* allow pruning, expiration, and human review
* separate user-specific context from global system knowledge
* never store secrets or sensitive data unless explicitly required and properly protected

## AGENTS.md Maintenance Rules

This file is a living operational contract and must be updated when meaningful work is completed.

### When to update AGENTS.md

Agents should update this file whenever a completed task introduces durable project knowledge, including:

* new architecture decisions
* new environment variables
* new production constraints
* new service domains or directory conventions
* new deployment requirements
* new safety, security, or rate-limit policies
* new evaluation or reinforcement-learning workflows
* major API contract changes
* important lessons learned that should guide future agents

### What should be recorded

Updates should add concise, high-signal context such as:

* what changed
* why the decision was made
* constraints future agents must preserve
* migration notes for future work
* links or references to related files if appropriate

### What should not be recorded

Do not bloat `AGENTS.md` with:

* trivial one-off bug fixes
* temporary debugging notes
* personal chatter
* duplicate information already stated clearly elsewhere
* rapidly changing implementation details better kept in code comments or README

### Update process after task completion

When a task is completed, the agent should check:

1. Did this task create new durable rules or constraints?
2. Will a future agent make mistakes without this context?
3. Does this change affect architecture, deployment, safety, or learning behavior?

If yes, update `AGENTS.md` in the same change set.

### Change log section

Maintain a brief section near the bottom called `Agent Notes` or `Operational Notes` for durable context. Keep entries short, dated, and actionable.

Example format:

* `2026-03-09`: Standardized backend health route to `GET /api/health`; frontend depends on JSON response shape.
* `2026-03-09`: Added feedback capture hooks for agent evaluation; promotion to production requires human review.

## Service Layer Rules

Under `server/services/`, current domains include:

* `agent/`
* `vision/`
* `media/`

Agents working in these directories must follow these rules:

### agent/

* Keep AI-agent orchestration separate from HTTP layer
* Prompt construction should be explicit and versionable
* Tool usage should be controlled and documented
* Avoid hidden side effects
* Never assume model output is valid; validate and sanitize it

### vision/

* Validate uploaded file types and sizes
* Never trust client-provided MIME type alone
* Handle malformed image/video input gracefully
* Avoid blocking the event loop with heavy processing when possible

### media/

* Isolate file transformation logic
* Sanitize filenames and paths
* Never allow arbitrary path traversal
* Store temporary files safely
* Clean up temp artifacts when appropriate

---

## Security Rules

These are mandatory for any production-facing code.

### Input safety

* Validate request bodies, params, and query strings
* Sanitize user-controlled strings where relevant
* Treat all incoming input as untrusted

### Auth readiness

Even if auth is not yet fully implemented:

* Protected routes must be designed with auth in mind
* Do not build endpoints that assume trust from the client
* Keep user context injectable via middleware patterns

### Secrets

* Use environment variables only
* Do not log secrets
* Do not commit `.env`
* Provide `.env.example` with placeholder values only

### CORS

* In development, localhost origins may be allowed explicitly
* In production, only approved origins should be allowed
* Avoid `origin: *` unless endpoint exposure truly justifies it

### File handling

* Restrict upload types
* Restrict upload sizes
* Scan/validate before processing if needed
* Never execute uploaded content

### Dependency hygiene

* Avoid adding unnecessary packages
* Prefer mature, maintained libraries
* Remove unused dependencies

---

## Database and Migration Rules

### Migrations

* Every schema change must have a migration
* Migrations should be deterministic and reversible when practical
* Never edit old migrations that may already be applied elsewhere
* Add a new migration instead

### Schema changes

* Prefer additive changes first
* Be cautious with drops/renames in live environments
* Consider backward compatibility for production rollouts

### Data access

* Keep DB logic separated from route code
* If repositories/data-access helpers are introduced, keep them explicit and small

---

## Environment Variable Conventions

Agents should use a predictable naming scheme.

Examples:

```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000
API_BASE_URL=http://localhost:5000
DATABASE_URL=
OPENAI_API_KEY=
GOOGLE_API_KEY=
```

Rules:

* Required variables must be documented
* Code should fail early with a clear message if critical env vars are missing
* Provide safe defaults only for non-sensitive development settings

---

## Testing Expectations

Production-grade changes should be testable.

### Minimum expectations

* New backend logic should be structured so it can be unit tested
* Critical routes should be integration-testable
* Health route should always remain easy to verify

### Agent behavior

When adding non-trivial code, agents should:

* Add tests when a test framework exists
* Avoid fake tests or meaningless snapshot spam
* Prefer high-signal tests covering behavior, not implementation details

### What to test

* Success path
* Validation failures
* Error path
* Edge cases
* Serialization/response shape consistency

---

## Performance Rules

* Avoid unnecessary rerenders on the frontend
* Avoid deeply nested state when simpler structures work
* Avoid blocking synchronous heavy work on the server
* Paginate large responses
* Stream or chunk heavy processing when relevant
* Be careful with image/media processing memory usage

Do not optimize prematurely, but do not write obviously inefficient code either.

---

## Observability and Debuggability

Agents should build code that is easy to debug.

### Required mindset

* Fail loudly in logs, safely in user responses
* Add helpful error messages for developers
* Keep response messages user-safe
* Preserve enough context in logs to trace issues

### Preferred additions for production readiness

* Request IDs or correlation IDs
* Structured request logging
* Centralized error middleware
* Health checks and readiness checks

---

## Code Style Guidelines

### General

* Use descriptive names
* Favor readability over terseness
* Keep functions focused
* Avoid giant files
* Avoid duplicated logic
* Add comments only when they explain intent, not obvious syntax

### JavaScript / TypeScript style direction

* Prefer `const` by default
* Use `let` only when reassignment is needed
* Avoid `var`
* Use async/await over raw promise chains when clearer
* Wrap awaited route logic in proper error handling

### Naming

* Components: `PascalCase`
* Hooks: `useSomething`
* Utilities/functions: `camelCase`
* Constants: `UPPER_SNAKE_CASE` only when truly constant
* Routes should be resource-oriented and predictable

---

## Git and Change Management Rules

Agents should keep changes disciplined.

### Every change should be:

* Small enough to review
* Scoped to one concern when possible
* Consistent with existing naming and architecture

### Do not:

* Reformat the entire codebase unnecessarily
* Rename files without reason
* Mix unrelated refactors with feature work
* Introduce dead code “for later”

### Prefer:

* Incremental improvements
* Backward-compatible changes
* Explicit TODOs only when truly necessary

---

## Documentation Requirements

When agents introduce a meaningful new feature, they should update relevant docs:

* README setup instructions
* `.env.example`
* API usage notes
* Migration notes if schema changed

If behavior changes, docs must change too.

---

## Local Development Standards

The default local development experience should remain simple.

### Baseline expectation

* Frontend runs on `localhost:3000`
* Backend runs on `localhost:5000`
* Frontend can successfully call `GET /api/health`

### Agents must avoid:

* Requiring unnecessary cloud services for basic startup
* Requiring hidden setup steps
* Breaking local boot due to undocumented env vars

---

## Production Deployment Standards

Agents should write code assuming real deployment, not just local demos.

### Production assumptions

* Environment variables are injected by hosting platform
* CORS is locked down
* Logs are aggregated externally
* Server may run behind a proxy/load balancer
* Services may scale beyond one process

### Therefore:

* Do not rely on in-memory state for critical persistent workflows
* Do not assume one single server instance forever
* Do not store important data only in process memory
* Make external integrations retry-safe where possible

---

## What Agents Should Do Before Writing Code

1. Understand which layer the change belongs to
2. Check if a similar pattern already exists
3. Preserve response shape consistency
4. Prefer the simplest working implementation
5. Think through failure cases before coding

---

## What Agents Must Not Do

* Do not hardcode credentials
* Do not bypass validation
* Do not put business logic in route files
* Do not return inconsistent JSON shapes
* Do not silently swallow errors
* Do not create massive multi-purpose files
* Do not introduce breaking changes without necessity
* Do not add dependencies casually
* Do not build features that only work in development
* Do not assume AI-generated output is trustworthy without validation

---

## Operational Notes

* `2026-03-09`: `AGENTS.md` must be updated when completed tasks introduce durable architecture, deployment, evaluation, or agent-learning context.
* `2026-03-09`: Reinforcement-learning-style improvements are allowed only through auditable, versioned, human-reviewable workflows.

---

## Definition of Done

A task is only considered done if:

* The code is consistent with the project architecture
* The app still runs locally
* Errors are handled safely
* The code is readable and maintainable
* The API contract remains clear and consistent
* Required docs/env examples are updated
* The implementation would be reasonable to ship to production

---

## Preferred First Milestone

Before adding advanced CookMate features, agents should make sure the following baseline is solid:

* Express server boots cleanly
* CORS is configured correctly
* `GET /api/health` works
* Frontend loads and fetches health status on page load
* Response renders visibly in the UI
* Environment variables are documented
* Project has a clean README setup flow

This baseline should never be broken by future changes.

---

## Instructions for AI Coding Agents

When making changes, follow this operating sequence:

1. Identify the smallest correct change
2. Preserve architecture boundaries
3. Implement clearly
4. Validate inputs and errors
5. Keep API responses consistent
6. Update docs if behavior changed
7. Leave the codebase cleaner than you found it

If a requested change conflicts with this file, follow this file unless the human maintainer explicitly says otherwise.

---

## Maintainer Intent

The maintainer values:

* clean structure
* production readiness
* simple local development
* explicit backend/frontend contracts
* code that is understandable by a student builder and scalable later

Optimize for clarity first, then extensibility.
