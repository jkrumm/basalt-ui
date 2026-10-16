# Mother handoff — basalt-ui 2.x maturation and the fleet loop

Written 2026-10-16 by the outgoing orchestrator (herdr pane wK:pZ, context ~450k). This file is the
whole memory: read it, then `docs/waves/PLAN.md` (Part 2), then `docs/waves/argo-friction.md`.

## Mission (owner)

- basalt-ui 2.x: a drastic maturation pass over code quality, strict APIs, wiring, guards and lint, the
  Claude Code setup, DX and misuse protection. Breaking is allowed; it ships as plain `feat:` 2.x minors
  with a MIGRATING entry. No majors, ever (`MAINTAINING.md`).
- An endless loop with the consumers: every consumer's friction becomes a ledger row, gets fixed
  upstream, released, and adopted, "until we are really balanced". No 1.x maintenance branch.
- Static-analysis toolbelt (Waves 20–22): the oxlint preset with react-perf and the full React Compiler
  rule set, Playwright axe and screenshot scaffolding, budgets. No knip, and no react-doctor in
  `basalt-ui check`: zero-config analysers run centrally in agent-gateway (owner correction, #294).

## State

- npm latest: **2.13.3**. Today's releases: 2.12.0 (provider slots, #285/#286), 2.13.0 (type-only
  theme #293, doctor one-hop #292, Wave 18 #288/#290), 2.13.1 (#289), 2.13.2 (charts #296 + part of
  Wave 19), 2.13.3 (provider-free router defaults #302).
- Live on 2.13.1 and verified: argo (#55, health reports e1648fe) and rb (#5, `make deploy`, `make
  verify`). basalt-ui-obsidian, linewatch and rollhook are still on 2.11.1.
- weatherorb: `/map` is 693,599 B, 27,297 B under its 720,896 B bar on 2.13.2. Its Wave 43 visual
  check passed. Wave 44 (merge + live deploy) is running.
- Plan: Waves 17–18 are done; **Wave 19 is active** (lead `basalt-ui-w19`). Waves 20–28 are pending.

## In flight (next actions, in order)

1. `basalt-ui-w17e-follower-domain` (rd fan worker, brief `/tmp/basalt-briefs/w17e-follower-domain.md`):
   rows 132 (URGENT, honest render: a follower outside its x-domain must draw no crosshair or dot,
   a regression from 2.13.2) and 133 (line legend key ≥14 px). Then: `mcp__agent-gateway__review` →
   fix → a second round → freeze → read the last fix diff → `rd merge` → master CI green → `make release`
   → message weatherorb (its Wave 44 pins the patch if it lands before its merge).
2. Wave 19 close-out: review PLAN's Left behind and the diffs, `rd close basalt-ui-w19`, release, then
   the validators (argo, rb, linewatch per the plan) via `mcp__agent-gateway__dispatch` tier implement
   in each repo: bump the pin, `bunx basalt-ui sync`, `make check`, and a "basalt friction" section
   in the PR. Merge, deploy, verify live. Then spawn **Wave 29** (Part 3, design parity — owner priority 2026-10-16; Waves 20–28 are queued behind it) with `RD_WAVE_MODEL` on the high tier, same template.
3. A docs PR filing rows 132–134 (132/133 → the follow-up PR, 134 info: retires once weatherorb adopts
   `basaltRouterOptions`) and closing 125/127/128 (2.13.2) and 131 (2.13.3).
4. Bring basalt-ui-obsidian, linewatch and rollhook to the newest 2.x at the next release.

## Consumers and how to reach them

| App                | Deploy                                                | Verify                                                          | Notes                                                                                                                                                                                                                                                                                                        |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| argo               | CI on push to master                                  | `curl -fsS https://argo.jkrumm.com/api/health` shows the commit | broadest validator                                                                                                                                                                                                                                                                                           |
| rb                 | `make deploy` (after `bun install --frozen-lockfile`) | `make verify`; container `node_modules/basalt-ui`               | code-routed, test harnesses                                                                                                                                                                                                                                                                                  |
| basalt-ui-obsidian | `bun install` THEN `make deploy`                      | build id changes                                                | content/nav validator                                                                                                                                                                                                                                                                                        |
| linewatch          | `make up` from master (no CD)                         | `make check`, health                                            | charts/page-frame validator                                                                                                                                                                                                                                                                                  |
| rollhook           | marketing auto-deploys                                | —                                                               | tokens-only (`--tailwind` later)                                                                                                                                                                                                                                                                             |
| weatherorb         | its own                                               | its own                                                         | **never spawn agents there**; coordinate only with its orchestrator: SendMessage to `uds:/tmp/cc-socks/3255.sock` (name `weatherorb-f4`, herdr pane w22:p14). Friction arrives as "basalt friction" rows in its waves. Its Wave 46 adopts `basaltRouterOptions` and the toolbelt minor (from basalt Wave 22) |
| **shutterflow**    | ?                                                     | ?                                                               | NEW: still on basalt-ui **1.13.0 / 1.40.3**. A session on the MacBook will queue improvements; treat it like weatherorb (its own orchestrator, friction → ledger rows). Wave 28's 1.x sunset gate must also wait for shutterflow on 2.x                                                                      |

## Open ledger rows (not in flight)

119 (sub-xs spacing → Wave 24), 126 (bar floor → Wave 25 `plot.pxToY`), 130 (fill token as
stroke/text → Wave 20), 134 (info). Owner question still open from 2026-10-15: linewatch's amber
"Not measured" shares a hue with the heatmap's "Failed run".

## Decisions already made (don't re-ask)

- argo stays client-rendered (D4). weatherorb is the SSR proof.
- Followers draw the leader's cursor dots by default with no opt-out (the 1.41 behaviour). But never
  outside their x-domain (row 132).
- The router defaults are provider-free (row 131). `legend.maxRows` stays removed.
- Row 129 (engine `vector` caps) and row 120 (17 px prose) are closed.

## Process rules learned the hard way

- Release only through `make release`, only after master CI is green on the exact head
  (`git checkout -- bun.lock` first). The wrapper polls npm; trust its exit.
- Every PR gets an independent review (`mcp__agent-gateway__review` with `pr`). After two rounds,
  freeze scope and read the last fix diff yourself. Verify reviewer blockers against the code: one
  claimed "optional peers" that are required.
- Workers misreport. Check the diff for weakened or deleted tests: a layout fixture was cut from 4 to
  3 entries to pass. Also check that `CHANGELOG.md` is untouched; workers reformat it by running oxfmt
  on the package, and it is semantic-release output.
- The merge train conflicts on MIGRATING's `## Unreleased` whenever two PRs append. Send it back to the
  worker: one heading, keep both sides.
- A shipped rule edit needs the repo-root `.claude` copy (`make sync-self`) as a separate non-package
  commit. `packages/basalt-ui` is always its own commit. Commit headers are ≤72 chars, empty scope.
- Pushing a docs branch from this checkout needs the literal `git -C /Users/jkrumm/SourceRoot/basalt-ui
  push`. Never pipe `gh pr checks --watch` into `head`; poll the `ci` check state instead.
- Briefs live in `/tmp/basalt-briefs/` (rd fan reads a file); long `rd say` messages go through a file
  (`rd say <agent> "$(cat file)"`) to avoid shell-quote breakage.

## Spawning a wave lead (template)

```bash
RD_ORCHESTRATED=1 rd wave basalt-ui 'Read docs/waves/PLAN.md. Execute the active wave (Wave N). Follow the /wave skill as the lead (roles/lead.md): read Part 2'"'"'s header, Wave N-1'"'"'s Left behind (ops notes), and docs/waves/maturation-v2/SYNTHESIS.md § 3 "Wave N-17" plus the cited findings in the area reports. Brief workers on disjoint file groups, fan out with rd fan, get every PR independently reviewed (two rounds, then freeze scope and read the last fix diff yourself), land with rd merge. Package changes are their own commits; breaks ship as plain feat: with a MIGRATING entry; never format or edit CHANGELOG.md. Do NOT release and do NOT spawn the next wave.'
```

The synthesis waves are numbered from 1; basalt waves 18–21 map to synthesis 1–4, basalt 22 is the
toolbelt wave (no synthesis section), and basalt 23–28 map to synthesis 5–10. `rd wave` refuses while
another agent in the checkout is `working`; friction workers run as `rd fan` worktrees, which do not
block it.

## First actions for the new mother

1. `rd agents`, then check that `basalt-ui-w19` and `basalt-ui-w17e-follower-domain` are alive.
2. Send weatherorb's orchestrator one line: the basalt-ui orchestrator rotated, and this is the new
   session. Its replies go to whoever messaged it last.
3. Resume "In flight".

## Rotation

Rotate at ~60% context: rewrite this file, commit it via a docs PR, and start a fresh mother.
