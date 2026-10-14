# W9 lint and agent layer — before and after

Before = `cbdc9124` (W8 close-out), after = `master` at the W9 close-out. Counted with `wc -l`.

## Shipped agent layer

| File                        | Before | After |
| --------------------------- | ------ | ----- |
| `rules/basalt-batteries.md` | 92     | 42    |
| `rules/basalt-charts.md`    | 87     | 37    |
| `rules/basalt-controls.md`  | 154    | 46    |
| `rules/basalt-mantine.md`   | 114    | 49    |
| `rules/basalt-state.md`     | 118    | 39    |
| `rules/basalt-tokens.md`    | 139    | 58    |
| **rules**                   | 704    | 271   |
| `skills/basalt-app`         | 100    | 217   |
| `skills/basalt-charts`      | 81     | 40    |
| `skills/basalt-design`      | 70     | 18    |
| `templates/AGENTS-block`    | 40     | 30    |
| **layer total**             | 995    | 576   |

1.41's layer was 1,136 lines; the plan's target was "fewer". `check-budgets` gates rule lines at the landed 277
(its own count, one extra per file; spec target ≤ 450) and `check-coverage` gates every file and the layer total
at the landed values. `basalt-app` grew by the chat, table, route and router-plugin snippets the DX trial asked
for (`w9/dx-trial.md`); every one of them is type-checked in `bun test`.

**The tag law** (`check-agent-doc-drift`, checks F–H): every bullet in a shipped rule ends in the enforcement that
catches its mistake — `[basalt/<rule>]`, `[check-theme <kind>]` or `[type <Name>]`, the name resolved against the
plugin registry, the guard kinds or the package's published exports. A repo-local or retired rule id in shipped
prose fails. Bullets that had no enforcement were deleted (Eden Treaty section, "never construct a second
`QueryClient`", "one `PageBar` per page", the leaf-module nav convention, the deprecation paragraph).
`llms.txt`'s header names are checked against the subpath they claim.

## oxlint plugin

| Measure                                 | Before                                     | After                                                                                                 |
| --------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `configs/oxlint-plugin.js` lines        | 4 428                                      | 4 127                                                                                                 |
| shipped `basalt/*` rules                | 25 (23 error, 2 warn)                      | 21, all `error`                                                                                       |
| retired (unrepresentable in 2.0)        | —                                          | `provider-above-router`, `page-bar-budget`, `agent-resume-guard`, `deprecated-export`                 |
| widened                                 | —                                          | `agent-no-raw-usechat` (+ `Chat`, namespace imports, re-exports); `shadow-basalt-export` warn → error |
| new, repo-local                         | —                                          | `no-dev-helper`; `no-import-meta-env` enabled (was registered, enabled nowhere)                       |
| shipped generic preset                  | compiler rules off, `no-explicit-any` warn | React-compiler rules, `no-constant-binary-expression`, `no-explicit-any` at `error`                   |
| React-compiler exemptions in basalt src | 26 file × rule                             | 5                                                                                                     |

`router-view-transition` was built and merged (#163), then deleted (#166) on the owner's decision of 2026-10-14:
route view transitions come back through the router, so the replacement rule belongs to the rendering wave.
A dogfood test pins every shipped `basalt/*` level equal in `/.oxlintrc.json`.

## CLI (`init` / `sync` / `doctor`)

`doctor` gains four hard checks: `tsconfig-base`, `retired-lint-rules`, `dropped-subpaths` (the 1.x → 2.0 upgrade
path: each names the 2.0 replacement and `MIGRATING.md` § 2.0) and `app-wiring`. A read or parse failure is a
skip, never a pass. `sync` is proven against a 1.41-shaped install (untouched files update, an edited rule is
reported, the block is rewritten). `init` seeds `main.tsx`, `__root.tsx`, `nav.tsx`, extends the tsconfig, merges
the lint preset and fixes create-vite's build order, so `init` → `doctor` is red only on what the consumer still
owns. CLI source stays inside its 4 250-line ceiling — the pre-1.41 `CLAUDE.md` → `AGENTS.md` block migration was
deleted to pay for it.
