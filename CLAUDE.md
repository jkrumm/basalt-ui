# Basalt UI — Project Context

An opinionated framework for **Mantine-based React apps**, extracted from argo (the POC). A
consumer app instantly gets: a Mantine theme + `cssVariablesResolver`, a `BasaltProvider`, an app
shell (`BasaltShell` + sidebar / mobile-nav / breadcrumbs / page-header), a visx chart system, a
three-tier `--vx-*` token system, a theme-lab, a Vite preset, raw toolchain config presets, and a
`basalt-ui` CLI (bin named like the package — never `bunx basalt`).

**Breaking 1.0** (`feat!:`, same npm name `basalt-ui`): the package pivoted from the old Tailwind
CSS theme into the Mantine framework above. v0.4.2 had zero external consumers, so the pivot ships
clean. The old `./css` and `./starlight` Tailwind exports are **dropped**. Anything below
referencing Tailwind / OKLCH foundation palettes / ShadCN / Tremor / Starlight / Biome / Prettier /
Astro docs is obsolete — that doctrine no longer applies.

## Working Instructions

The full S0→S5 argo extraction is **implemented** on `feat/s0-mantine-pivot` — `packages/basalt-ui/src/**`
is real code, not stubs (see `packages/basalt-ui/CLAUDE.md`'s Status section). The historical plan
lives in `docs/archive/BLUEPRINT.md`. `docs/STATUS.md` is the live single-source-of-truth for
current state; `docs/archive/MATURATION-REVIEW.md` is the (now-executed) quality ledger. Do what is
explicitly requested — don't autonomously execute large roadmap phases.

## Critical Rules (READ FIRST)

- **Runtime**: Bun (not npm/pnpm)
- **UI lib**: Mantine v9 (NOT Tailwind — that era is over)
- **Tokens**: three-tier `--vx-*` CSS-variable system (palette data → CSS vars → `VX.*` refs)
- **Lint**: oxlint (NOT Biome). **Format**: oxfmt (NOT Prettier). No ESLint, no Biome, no Prettier.
- **TypeScript**: strict mode, no `any`, type inference preferred, explicit types on public exports
- **Git**: conventional commits, **empty scope** (commitlint `scope-empty: always`), `master` branch
- **Exports**: named only, **no default exports**
- **Files**: `kebab-case.ts`; components `PascalCase.tsx`
- **basalt-ui is ALWAYS a separate commit** (NPM published — lefthook `isolated-basalt-ui` guard)

## Tech Stack

- **Runtime**: Bun
- **Monorepo**: Bun workspaces (`packages/*`, `apps/*`)
- **UI**: Mantine v9 (`@mantine/core` + `@mantine/hooks` `^9.3`)
- **React**: 19 (peer)
- **Charts**: visx (9 `@visx/*` packages, pinned exact stable `4.0.0`)
- **Lint/format**: oxlint + oxfmt
- **Type-check**: tsc (strict)
- **Git**: conventional commits enforced via commitlint; lefthook pre-commit hooks
- **Release**: semantic-release-monorepo + npm provenance

## Structure

```
basalt-ui/
├── packages/basalt-ui/    # the ONLY published package (npm: basalt-ui, v1.0.0)
├── apps/playground/        # @basalt-ui/playground — workspace:* consumer, everyday iteration surface
├── apps/marketing/         # basalt-ui.com — CONTENT-FROZEN until rebuilt on Mantine post-migration
├── docs/archive/BLUEPRINT.md  # the 5-stage argo-extraction plan
└── CLAUDE.md               # you are here
```

- `packages/basalt-ui` — the published framework. See its own `CLAUDE.md`.
- `apps/playground` — the everyday iteration surface; grows as the package gains surface. Instant
  HMR, exact types, zero linking via `workspace:*`.
- `apps/marketing` — basalt-ui.com. Content-frozen until rebuilt on Mantine post-migration; will
  vendor its own legacy CSS and stop depending on the package. Don't iterate on it for now.
- `examples/*` was removed from the workspace.

## Commands

**Root:**

```bash
bun install                # install all workspaces
bun run dev                # = dev:playground
bun run dev:playground     # start the playground consumer
bun run lint               # oxlint
bun run fmt                # oxfmt (write)
bun run fmt:check          # oxfmt (check only)
bun run typecheck          # tsc across package + playground
bun run pre                # fmt:check && lint && typecheck (run before committing)
```

**Package (`packages/basalt-ui`):**

```bash
cd packages/basalt-ui && bun run build   # dist-first tsup + styles.css copy + tsc declarations
```

**Pack-test (the dist gate, runs in CI):** `bun pm pack` + scratch-install of the tarball. The
playground only exercises `src/`, never `dist/` — the pack-test is what proves the published
artifact resolves.

## Mantine-Free Boundary (enforced)

`src/charts/**` and `src/tokens/**` may **not** import `@mantine/*`. `@visx/*` may **only** be
imported inside `src/charts/**`. Enforced by oxlint `no-restricted-imports` — both repo-local AND
in the shipped consumer oxlint preset. This keeps the `./charts` and `./tokens` subpath exports
Mantine-free, so a charts/tokens-only consumer never pulls in Mantine.

## Validation & Quality Workflow

1. Make changes.
2. Run `bun run pre` (fmt:check + lint + typecheck) to validate.
3. Fix errors in changed files only — don't refactor untouched code.
4. Commit with conventional format (empty scope).

The user validates running apps manually — don't start dev servers.

## Git Workflow

**Branch**: `master`.

**Commit format** — conventional, **empty scope**:

```bash
feat: add chart legend kind
fix: correct dark-scheme surface var
docs: update README
chore: bump dev dep
```

`commitlint.config.ts` enforces `scope-empty: always` — never `feat(scope):`.

**The basalt-ui separate-commit rule (critical):** `packages/basalt-ui/**` changes must be
committed **separately** from everything else. The lefthook `isolated-basalt-ui` pre-commit hook
fails a mixed staging set.

**Pre-commit hooks** (lefthook): oxlint + oxfmt on staged files; commitlint on the message.

**Commit type discipline (affects npm versioning):**

- `feat:` / `fix:` — triggers minor/patch release **only when the commit touches
  `packages/basalt-ui/`** (path-filtered). `feat!:` or a `BREAKING CHANGE:` footer → major.
- `ci:` — CI/CD, lefthook, workflow changes; never triggers a release.
- `chore:` / `docs:` / `refactor:` — no release.

## Release Process

1. Trigger the **Make Release** / release workflow on GitHub Actions (workflow_dispatch).
2. `semantic-release-monorepo` analyzes only commits touching `packages/basalt-ui/`.
3. Creates git tag + GitHub release + publishes to npm **with provenance** automatically.

## Analytics & Tracking

### UTM Parameter Strategy

**Philosophy**: minimal tracking with Umami Analytics — track document source, not campaigns.

**Format**: a single parameter identifying the file/location:

```
?utm_source={file_location}
```

**Defined sources**: `root_readme`, `basalt_ui_readme`. (`brand_voice` dropped — its source doc was
deleted; `npm_package` dropped — `package.json`'s `homepage` now points to GitHub, not
`basalt-ui.com`.)

**Why**: the analytics already tracks referrers (github.com, npmjs.com), there are no active
campaigns, and one consistent parameter answers the only question that matters — "which document
did they click from?". We don't track `utm_medium` / `utm_campaign` / `utm_content` / `utm_term`.

Applies only to links that actually target `basalt-ui.com` (Umami only sees traffic on that
domain). Both READMEs' "Documentation" links currently point off-domain (GitHub / an in-page
anchor) until `apps/marketing` is rebuilt on Mantine (see "Structure" above), so
neither carries a live `utm_source` today; the convention stays defined for the next doc that
links to `basalt-ui.com` from that source:

```markdown
[Some page](https://basalt-ui.com?utm_source=root_readme)
```

## Key Principles

- **Concise over verbose** — less code is better.
- **Examples over description** — show, don't tell.
- **TypeScript strict** — no shortcuts.
- **Iterate in the playground** — see changes immediately.
- **Document decisions** — update this file as conventions evolve.

## Search Param Persistence

URL search params representing user-mutable state (date ranges, tabs, filters) MUST
use `createSearchParamStore` from `basalt-ui/router-tanstack`. See the JSDoc on
`createSearchParamStore` for the full 5-step recipe — it ships with every consumer
via autocomplete. Key rules that won't fit in a JSDoc bullet:

- Page components accept the param as a **prop**, never via `useSearch({ from:
'/dashboard' })` — sibling routes fail that `from`.
- Dashboard `<Link>`s use `search={true}` guarded by `href.startsWith('/dashboard')`
  so sub-page switches preserve the filter; non-dashboard links get no search injection.
- The localStorage fallback in `validateSearch` restores the value when navigating
  back; the filter's `navigate({ search: (prev) => (...) })` keeps it current.
