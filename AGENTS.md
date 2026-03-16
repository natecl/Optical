# AGENTS.md

Operating rules for AI coding agents working on **CookMate**. Follow this document exactly unless a human maintainer explicitly overrides a rule.

## Project Goal

CookMate is a production-grade cooking assistant with a separated client/server architecture.

- Keep the codebase clean, explicit, and maintainable
- Clear separation of concerns between frontend and backend
- No fragile shortcuts, hidden behavior, or overengineering
- Local dev must stay simple; code must be deployable to production
- Prefer explicit, testable code over clever abstractions

## Tech Stack

- **Client:** React + Vite + TypeScript (`client/`)
- **Server:** Express + TypeScript via `tsx` (`server/`)
- **Shared types:** `types/` at project root (`.ts` files)
- **Module system:** ESM (`import`/`export`) throughout — no CommonJS
- **State:** In-memory (no database)
- **WebSocket:** `ws/` under server for real-time cooking sessions

## Project Structure

```
cookmate/
├── client/
│   ├── components/    # Reusable UI components
│   ├── pages/         # Route-level screens
│   ├── hooks/         # Reusable hooks
│   ├── styles/        # Global/modular styles
│   └── public/        # Static assets (audio, images)
├── server/
│   ├── controllers/   # Request/response orchestration
│   ├── routes/        # HTTP method + path wiring
│   ├── services/
│   │   ├── agent/     # AI agent orchestration
│   │   ├── vision/    # Image/video processing
│   │   └── media/     # File transformation
│   ├── ws/            # WebSocket servers
│   └── utils/         # Shared generic utilities
├── types/             # Shared TypeScript types
└── docs/              # Documentation and guides
```

Preserve this structure. Do not reorganize without maintainer approval.

## Non-Negotiable Rules

1. **Never break layer boundaries**
   - `client/` must not contain backend logic
   - `server/routes/` = route wiring only
   - `server/controllers/` = request/response mapping only
   - `server/services/` = business logic and integrations
   - `types/` = shared type definitions only

2. **No hardcoded secrets** — all secrets via env vars, documented in `.env.example`

3. **Minimal implementations** — no speculative code, unnecessary abstractions, or unused dependencies

4. **Fail safely** — validate inputs, handle errors explicitly, return structured JSON errors, never leak stack traces or secrets

5. **Keep the app runnable** — every change must preserve a working local dev flow

## API Conventions

### Health Endpoint
- `GET /api/health` → `{ "status": "success", "message": "frontend and backend connected" }`
- Do not rename or change the response shape without updating frontend + docs

### Response Shapes
```typescript
// Success
{ status: "success", data: {}, message?: string }

// Error
{ status: "error", error: { code: string, message: string } }
```
- Be consistent across all endpoints
- Never return raw thrown errors

## Frontend Rules

- **Pages** (`pages/`): route-level screens, keep thin
- **Components** (`components/`): reusable UI, functional components only
- **Hooks** (`hooks/`): reusable stateful logic, named `useSomething`
- **Styles** (`styles/`): global or modular CSS
- Use hooks for state and side effects; clean up subscriptions/timers/listeners
- Centralize API base URLs via env vars — never hardcode `localhost` in components
- Show loading states for async actions; show user-friendly errors; never silently fail
- Local dev: client at `localhost:3000`, server at `localhost:5000`

## Backend Rules

### Route → Controller → Service Split
- **Routes:** define method/path, attach middleware, delegate to controllers — no logic
- **Controllers:** read request, call services, map output to HTTP response — stay thin
- **Services:** core business logic, external API calls, testable in isolation — no Express req/res

### Middleware
- JSON body parsing, CORS, request logging, centralized error handling
- Rate limiting for public endpoints
- Input validation for non-trivial endpoints

### Error Handling
- Centralize error handling; use consistent HTTP status codes
- 400 validation | 404 not found | 409 conflict | 429 rate limit | 500 internal
- Log useful context, never secrets; keep logs readable in dev and prod

## Service Layer Rules

### `agent/`
- Keep AI orchestration separate from HTTP layer
- Prompt construction must be explicit and versionable
- Never assume model output is valid — always validate and sanitize

### `vision/`
- Validate uploaded file types and sizes server-side
- Never trust client-provided MIME type alone
- Handle malformed input gracefully; avoid blocking the event loop

### `media/`
- Sanitize filenames and paths — no arbitrary path traversal
- Store temp files safely; clean up when done
- Never execute uploaded content

## Security Rules

- **Input:** validate all request bodies, params, query strings; treat all input as untrusted
- **Secrets:** env vars only; never log secrets; never commit `.env`; maintain `.env.example`
- **CORS:** explicit allowed origins only; avoid `origin: *` in production
- **File uploads:** restrict types and sizes; validate before processing; never execute
- **Dependencies:** avoid unnecessary packages; prefer mature libraries; remove unused deps

## Code Style

- TypeScript throughout; use `const` by default, `let` only when needed, never `var`
- `async`/`await` over raw promise chains
- Descriptive names; focused functions; no giant files; no duplicated logic
- Comments explain intent only, not obvious syntax

### Naming Conventions
- Components: `PascalCase`
- Hooks: `useSomething`
- Functions/utils: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Routes: resource-oriented, predictable
- Types/interfaces: `PascalCase`

## Git and Change Management

- Changes should be small, scoped to one concern, reviewable
- Do not reformat entire files, rename without reason, or mix unrelated refactors
- No dead code "for later"; no breaking changes without necessity
- Prefer incremental, backward-compatible improvements

## Environment Variables

```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000
API_BASE_URL=http://localhost:5000
OPENAI_API_KEY=
GOOGLE_API_KEY=
```
- Required vars must be documented in `.env.example`
- Fail early with clear message if critical vars are missing

## AGENTS.md Maintenance

### When to Update
- New architecture decisions or directory conventions
- New env vars or deployment requirements
- New security or rate-limit policies
- Major API contract changes
- Important lessons that future agents need

### What to Record
- What changed, why, and what constraints to preserve
- Keep entries concise and actionable

### Do Not Record
- Trivial bug fixes, temporary debug notes, duplicate info, rapidly changing details

## Operational Notes

- `2026-03-09`: Standardized health route to `GET /api/health`; frontend depends on JSON response shape.
- `2026-03-09`: AGENTS.md must be updated when tasks introduce durable architecture or deployment context.
- `2026-03-10`: Security hardening applied — helmet, rate-limiting, CORS restrictions, secret scrubbing.
- `2026-03-14`: Tech stack migrated to TypeScript throughout. Server runs via `tsx`. Shared types at `types/`.
- `2026-03-16`: Production deployment path uses Google Cloud Run for backend hosting with GitHub Actions auto-deploy (`main`) via Workload Identity Federation (no static service-account keys).
- `2026-03-16`: Backend production deploy workflow also supports GitHub Actions manual dispatch for redeploys and rollback operations.
- `2026-03-16`: Frontend production deployment uses Vercel with GitHub Actions auto-deploy on `main` for `client/**` and `types/**`; Vercel project root must remain `client`.

## Definition of Done

A task is done only when:
- Code is consistent with project architecture
- App runs locally without errors
- Errors are handled safely
- Code is readable and maintainable
- API contracts remain clear and consistent
- Docs/env examples updated if behavior changed
- Implementation is reasonable to ship to production

## Agent Operating Sequence

1. Identify the smallest correct change
2. Preserve architecture boundaries
3. Implement clearly with TypeScript types
4. Validate inputs and handle errors
5. Keep API responses consistent
6. Update docs if behavior changed
7. Update AGENTS.md if durable context was created
8. Leave the codebase cleaner than you found it

If a requested change conflicts with this file, follow this file unless the human maintainer explicitly overrides.

## AI Agent Skills

Reusable skill documents are available at `.claude/skills/` for any AI agent working on this project. These provide structured workflows, processes, and guidelines that agents should reference when applicable.

### Skills Directory

```
.claude/skills/
├── superpowers/                        # Core development workflow skills
│   ├── brainstorming/                  # Design ideation before implementation
│   │   ├── SKILL.md                    # Main brainstorming process
│   │   ├── spec-document-reviewer-prompt.md
│   │   └── visual-companion.md         # Browser-based visual brainstorming
│   ├── dispatching-parallel-agents/    # Run independent tasks concurrently
│   ├── executing-plans/                # Execute written implementation plans
│   ├── finishing-a-development-branch/ # Merge, PR, or cleanup after implementation
│   ├── receiving-code-review/          # Evaluate review feedback with rigor
│   ├── requesting-code-review/         # Dispatch code review subagents
│   │   ├── SKILL.md
│   │   └── code-reviewer.md            # Review agent prompt template
│   ├── subagent-driven-development/    # Execute plans via subagents with two-stage review
│   │   ├── SKILL.md
│   │   ├── implementer-prompt.md
│   │   ├── spec-reviewer-prompt.md
│   │   └── code-quality-reviewer-prompt.md
│   ├── systematic-debugging/           # 4-phase root cause debugging
│   │   ├── SKILL.md
│   │   ├── condition-based-waiting.md
│   │   ├── defense-in-depth.md
│   │   └── root-cause-tracing.md
│   ├── test-driven-development/        # TDD: RED-GREEN-REFACTOR cycle
│   │   ├── SKILL.md
│   │   └── testing-anti-patterns.md
│   ├── using-git-worktrees/            # Isolated workspaces for feature work
│   ├── using-superpowers/              # Meta-skill: when/how to invoke skills
│   ├── verification-before-completion/ # Evidence before success claims
│   ├── writing-plans/                  # Create implementation plans from specs
│   │   ├── SKILL.md
│   │   └── plan-document-reviewer-prompt.md
│   └── writing-skills/                 # Create and test new skills (TDD for docs)
│       ├── SKILL.md
│       ├── anthropic-best-practices.md
│       ├── persuasion-principles.md
│       └── testing-skills-with-subagents.md
├── code-review/
│   └── code-review.md                  # Automated PR code review with parallel agents
├── frontend-design/
│   └── SKILL.md                        # Distinctive, production-grade UI design
└── security-guidance/
    └── SKILL.md                        # Secure coding patterns for Express/TypeScript
```

### When to Use Skills

| Skill | Use When |
|-------|----------|
| **brainstorming** | Before any creative work — creating features, components, or modifying behavior |
| **systematic-debugging** | Encountering any bug, test failure, or unexpected behavior |
| **test-driven-development** | Implementing any feature or bugfix, before writing implementation code |
| **writing-plans** | You have a spec or requirements for a multi-step task |
| **executing-plans** | You have a written plan to execute in a separate session |
| **subagent-driven-development** | Executing plans with independent tasks in the current session |
| **dispatching-parallel-agents** | Facing 2+ independent tasks with no shared state |
| **requesting-code-review** | Completing tasks, major features, or before merging |
| **receiving-code-review** | Receiving review feedback, especially if unclear or questionable |
| **finishing-a-development-branch** | Implementation complete, deciding how to integrate |
| **using-git-worktrees** | Starting feature work that needs isolation |
| **verification-before-completion** | About to claim work is complete or passing |
| **frontend-design** | Building web components, pages, or applications with high design quality |
| **code-review** | Reviewing a pull request for bugs, CLAUDE.md compliance, and code quality |
| **security-guidance** | Modifying endpoints, handling input, file uploads, secrets, middleware, or adding routes |

### How to Use

Agents should read the relevant `SKILL.md` file before starting applicable work. Each skill contains:
- **When to use** — triggering conditions
- **Process** — step-by-step workflow
- **Red flags** — common mistakes to avoid
- **Integration** — how skills connect to each other
