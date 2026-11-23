# Freeze wave: what must be sound before 3.0

The `ga-*` rows in `docs/plan.yaml` close what seven read-only audits found on 2026-11-24. This page holds what
every one of those rows needs. A row's own file under this directory holds the rest, and the audit reports with
their `path:line` evidence are in `docs/v3/evidence/readiness-2026-11-24/`.

## Owner direction, 2026-11-24

Quoted from the owner's message of that day:

- "especially the main architecture setup and wiring and type safety and the [lint] rules and guards and this
  Claude's code skills and setup and so on need to really be sound. The rest, like the visual renderings, details,
  and so on, we can improve on over time."
- "we are a greenfield project. We don't have much or any users in the end as of now, and we can still iterate and
  improve on the setup easily."
- The yardstick: "extendability, maintainability, structure, wiring. Those are the key crucial concepts."
- After the wave he wants "another trial project and some visual verification [...] of maybe a cleaned up
  playground, which is adhering to modern Basalt UI patterns", with "Astro pages, Starlight Docs, normal guides,
  normal docs, normal articles" beside the app pages.

So no row here waits on the owner, and none takes a Spec checkpoint. Raise a Decision only for something this page
and the row's file leave open and the code cannot answer.

## What the audits found

The engine holds: the nav type inference, the table contract, the layer boundaries, named exports, one rule table
with a fixture per rule. The freeze list of `docs/v3/STOCKTAKE.md` section 4 was never worked: 12 of its 13 rows
are open, and the 770 commits since added parts and names. 3.0 would freeze the wrong things today.

## Decided

Each line is settled. The reason follows the colon.

1. **A break is free now.** Nothing past 2.29.0 is on npm. Rename and delete without an alias; the 2.x name goes
   into `migrations/areas`, `MIGRATING.md` and the codemods: an alias in an unreleased major is debt with no user.
2. **American spelling in every identifier, rule id, file name and shipped text**: the tokens, props and types
   already are.
3. **A public type is importable from a published entry.** A consumer never imports `basalt-ui/core/*` for a type:
   that path is for ejected primitives only.
4. **Every guard is a test that fails on a seeded offender.** A sentence in a document is not a guard: the audits
   found the agent block, the island rule and the rule-tag check each passing while wrong.
5. **What `init` writes, `sync` refreshes and `doctor` checks**: otherwise the first release stays in every
   install.
6. **The CLI runs under Node.** `init` offers npm, pnpm and yarn, and the edit hook runs the bin on every edit.
7. **Additive work waits unless its type would close a door.** A new part can ship in 3.1. A closed union, a
   boolean option or a `string` where a key type belongs cannot be opened later without a break.
8. **No row changes how a part looks** except where a tour page exposes a defect: rendering is not frozen by 3.0.

## Order

`ga-exports`, `ga-install-path`, `ga-cli-formats`, `ga-peers` and `ga-agent-layer` start at once: their files are
disjoint. `ga-names` and `ga-typed-nav` follow `ga-exports`; `ga-seams` follows `ga-names`; `ga-site-path` follows
the CLI and agent rows, `ga-site-pages` follows it; `ga-playground-tour` follows `ga-install-path`; `ga-contract`
documents the result and lands last.

## After the wave

A fresh builder runs a trial from the packed tarball (app and site), as `docs/v3/STOCKTAKE.md` section 9 asks, and
the owner looks at the playground tour. The release is the owner's timing and no row here files or gates it.
