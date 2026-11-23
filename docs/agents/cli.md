# basalt-ui CLI: agent notes

## Key commands

`tokens:css`/`fonts:css` are the only commands with no install to resolve, so `bunx` is correct for
them **and only while basalt is not installed here** — once it is, they run through the local bin
like everything else. `init` always runs from the local bin: install `basalt-ui` first. See the note below.

```bash
./node_modules/.bin/basalt-ui init   # FIRST STEP, after `bun add basalt-ui`: scaffold .claude/rules/ + .claude/skills/, managed AGENTS.md block, DESIGN.md seed, toolchain seeds
basalt-ui --version         # one bare line, exit 0 — which CLI is actually running (also -v / version)
basalt-ui sync              # reconcile managed files (.claude/rules/, .claude/skills/, AGENTS.md block) + delete the ones this version retired
basalt-ui sync --check      # CI freshness gate — exits non-zero if any managed file drifted or a retired one is still present
basalt-ui add <block>       # copy a block (a whole reference page, as source) into src/blocks/<block>/; add --list names them
basalt-ui doctor            # integration health — SKIPPED is a third outcome and exits non-zero
bunx basalt-ui tokens:css   # emit the --basalt-* stylesheet (no React, no bundler) — bunx ONLY if basalt is not installed
bunx basalt-ui fonts:css    # emit the shipped --basalt-font-* stacks — same exception
```

Every subcommand rejects a flag it does not accept, exiting 1 and naming it; an unknown command says
so above the usage block. Neither is ever ignored — `doctor --json` used to run doctor and exit 0.

**One resolver (C2, 1.29.0): `BASALT_CWD` → cwd, and a declared `basalt.roots` — nothing inferred.**
`doctor`, `sync` and `lint` all resolve their project the same way; there is no ascend/descend
guess. Two candidates is ambiguous and reported, never guessed. `sync` on a `tokens-only` consumer
prints `n/a` and exits 0.

**Run the local bin, not `bunx`.** `bunx` does not re-resolve a cached package, so it can execute
the version you just upgraded away from — one consumer filed a P0 against a 1.20.0 cache while
believing it was on 1.22.0. `init` and `sync` render every seeded script, CI step and hook with the
resolved local bin for this reason (`BASALT_BIN` overrides it). `basalt-ui --version` is the
one-second check.

The editor hook is `.basalt/hook.mjs` (`basalt-ui lint --hook`), placed and registered in
`.claude/settings.json` by `init` and `sync`, so the agent's off-law edits are caught as it writes.

**The escape hatch is `// oxlint-disable-next-line basalt/<rule-id> -- <why>`**, scoped to that one rule
and line; a waiver without `-- <why>` is itself a finding (`basalt/waiver-needs-reason`). The 2.x
`theme-allow` and `theme-allow-file` annotations are inert: no rule reads them.

> **Framework-internal only** — `bun scripts/check-coverage.ts` (a script, not a CLI subcommand
> as of C2/1.29.0) is a self-consistency gate for the basalt-ui repo itself (asserts SURFACES ↔
> rule files ↔ skill files ↔ package.json exports). Not a consumer command.
