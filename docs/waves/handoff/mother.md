# Mother handoff — basalt-ui 2.x: design track (Part 3) and the fleet loop

Rewritten 2026-10-16 by the orchestrator in herdr pane wK:p5T. This file is the whole memory: read it,
then `docs/waves/PLAN.md` Part 3 (header and the active wave), `docs/waves/design-parity/SPEC.md` § 11, and
`docs/waves/argo-friction.md` from row 119.

## Mission (owner, restated 2026-10-17)

The owner judged basalt-built UIs "slopped out" next to Keel Workspace (a look-only reference). basalt must
produce dashboards at the highest quality by default, and every app's coding agent must be taught that flow through
`init`/`sync`: UX research first (a concept doc), then the encoding (the chart-or-not router and the catalogue), then
the build, then rendered critique (`basalt-ui shot` rounds scored by an isolated `basalt-design-reviewer`).

**Three phases, in order:**

1. **Converge (this mother).** basalt Waves 35 (argo's craft friction) and 36 (the UX-first procedure, shipped),
   argo Waves 22–23 (`~/SourceRoot/argo/docs/waves/PLAN.md` Part 2; 23 is the all-pages convergence pass the
   orchestrator adds after basalt Wave 35 ships), and the expression trial on a fresh `init` app. Iterate until the
   **exit gate** holds:
   - every argo page passes a fresh, isolated reviewer on all three axes at 1440 and 390, in both schemes;
   - a side-by-side read of every Keel capture against argo and the playground finds no category where Keel is ahead;
   - the fresh-agent trial (data only, no component names) writes a concept, picks the catalogue's encodings and
     passes the reviewer;
   - the owner signs off on the boards.
2. **Rotate, then the fleet.** Rewrite this file and start a fresh mother. It runs the proven loop app by app: rb,
   linewatch, basalt-ui-obsidian, rollhook, then the 1.x → 2.x migrations of email-gateway (1.36) and image-gateway (1.41). Each app's friction becomes a ledger row, an upstream fix and a release.
3. **weatherorb's UX/UI rewrite** is the final validation, handed to weatherorb's own orchestrator when phase 2 has
   settled. Its UI waves are held until then (its renumbered Waves 51+).
   The brief's concept doc must cover (owner via weatherorb-f4, 2026-10-17): every point-forecast rendering
   (the CartesianChart and Mantine surfaces) as a named quality target; #103 the probe bubble unreadable in dark;
   #114 status strokes drawn as soft fills; #111 the chart hover scrubbing the map past the layer's horizon (clamp
   to the horizon). The map engine (WebGL particles and fields, its Waves 63–64) stays weatherorb's and is out of
   the brief.

Queued behind all of it: Part 2's maturation Waves 20–28.

## State (2026-10-24, phase 1 at the owner's sign-off)

- npm latest **2.29.0** (Waves 48–52 plus the CI fix #553). 2.28.0 (Waves 42–47) shipped 2026-10-23.
- **The phase-1 exit target is met and confirmed** (owner-revised 2026-10-22, after the argo pause): no basalt-owned P1
  in the fresh-agent expression trial, no P1 in the full playground audit. Trial v6 scored 58 (v3 32 → v4 40 → v5 52 →
  v6 58): P1 0, P2 4 (basalt 2), P3 13 (basalt 7). Wave 52's audit opened all 67 contact sheets and all 40 Keel
  captures: S1 93, S2 93, S3 88, S4 93, S5 89, S6 87, S7 87, S8 94, `shot detect` 100. Records:
  `docs/waves/design-parity/w52/`.
- Consumers: linewatch, rollhook and obsidian are live on 2.28.0. rb has a local, unpushed branch
  `chore/bump-basalt-ui-2.28.0` in `rb/.claude/worktrees/` for the owner (agents never push rb). argo is on 2.27.2 and
  **paused by the owner** (2026-10-22): a major argo overhaul is coming, so argo gets no waves or PRs from here.
  weatherorb is the owner's own, coordinated from weatherorb. shutterflow is out (1.x).
- **PAUSED 2026-10-24 for the owner's weekly limit (82 %, resets 2026-10-28 17:00).** No agent is running. Wave 55 is
  authored and `active` in PLAN but not spawned; phase 2 starts after the reset with a fresh mother from this file.

## In flight (next actions, in order)

1. **Owner sign-off on phase 1.** Until then, spawn nothing. Then the owner decides whether to pause before phase 2.
2. **Owner decisions queued:**
   - Light-scheme input borders measure about 1.04:1 against the card, below WCAG's 3:1 for component outlines. The
     change touches every consumer's inputs. Recommendation: raise to 3:1.
   - SPEC D37: an errored/empty chart body keeps the loaded height. Default until ruled: SPEC wins.
   - rb: the owner pushes the 2.28.0 branch.
   - rollhook: an optional Make Release so its dashboard image picks up 2.28.0.
3. **Waves 53 and 54: done** (stopped at Wave 54: owner pause for the weekly limit). Landed: W53 #555 (a pending
   `ChartCard` with `placeholderHeight="content"` loads a figure body as its skeleton; `date()` rule line), #556 (the
   S3 `↑ N loaded above` cue, every feed sentence wraps, the S6 danger ring in light); W54 #559 (a lone
   `BarList`/`EventList`/`Meter` body takes `'content'` itself: rows 219, 220), #558 (S5 "Today" recency, playground).
   Master is **unreleased, fix-only since 2.29.0** (a patch). Trial v7's ~85 was **provisional** (5 sheets and 4 page
   shots only); a full-coverage re-score (111 of 111 shots) ran in W54 before the pause and reads ~75, the drop all
   app copy (`design-parity/w53/expression-trial-v7.md`). Carried into Wave 55 (`active`, not spawned): rows 221, 222,
   214, 215, 217, 218, the basalt W52/W53 P3 list and the remaining playground P3s.
4. **Phase 2:** a fresh mother; bump linewatch, rollhook, obsidian (and rb via the owner) to 2.29.0; email-gateway's
   1.x → 2.0 migration; image-gateway (the owner is unsure it still needs a UI: deleting the UI beats migrating it);
   Part 2 maturation Waves 20–28. argo bumps during its own overhaul.
5. Release cadence: release only when a consumer is waiting on the change, and only with master CI green on the
   exact head.
6. Budget practice (owner-agreed): an Opus lead; Sonnet workers, reviewers and the trial agent (`RD_WAVE_MODEL=sonnet`
   for `rd fan`; the lead inherits the spawn's model otherwise); at most 3 shot rounds; at most 3–4 parallel workers.
   A basalt wave costs about 3–8 % of the week this way. Pause at about 90 % of the weekly limit.
7. Decided 2026-10-18: warden + agent-gateway get an authored `question` field, recorded only as backlog in each repo's
   `docs/BACKLOG.md`; implementing it needs an owner decision.

## Consumers and how to reach them

| App                | Deploy                                                | Verify                                                          | Notes                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| argo               | CI on push to master                                  | `curl -fsS https://argo.jkrumm.com/api/health` shows the commit | broadest validator                                                                                                                                                                                                                                                                                                                                                                                |
| rb                 | `make deploy` (after `bun install --frozen-lockfile`) | `make verify`; container `node_modules/basalt-ui`               | code-routed, test harnesses                                                                                                                                                                                                                                                                                                                                                                       |
| basalt-ui-obsidian | `bun install` THEN `make deploy`                      | build id changes                                                | content/nav validator                                                                                                                                                                                                                                                                                                                                                                             |
| linewatch          | `make up` from master (no CD)                         | `make check`, health                                            | charts/page-frame validator                                                                                                                                                                                                                                                                                                                                                                       |
| rollhook           | marketing auto-deploys                                | —                                                               | tokens-only (`--tailwind` later)                                                                                                                                                                                                                                                                                                                                                                  |
| weatherorb         | its own                                               | its own                                                         | **never spawn agents there**; coordinate only with its orchestrator: SendMessage to `uds:/tmp/cc-socks/3255.sock` (name `weatherorb-f4`, herdr pane w22:p14). Friction arrives as "basalt friction" rows in its waves. On 2.14.0 live (its W47: rows 132/133 verified, `basaltRouterOptions` adopted). Its UI waves are held while basalt runs Part 3; its toolbelt wave waits for basalt Wave 22 |
| **shutterflow**    | —                                                     | —                                                               | **Out of this track (owner, 2026-10-17).** A larger UX re-establishment that the owner coordinates himself from the MacBook. It stays on basalt 1.x until then; never spawn agents or brief it from here. Part 2's Wave 28 1.x sunset still waits for it.                                                                                                                                         |

## Decisions already made (don't re-ask)

- argo stays client-rendered (D4). weatherorb is the SSR proof.
- Followers draw the leader's cursor dots by default with no opt-out (the 1.41 behaviour). But never
  outside their x-domain (row 132).
- The router defaults are provider-free (row 131). `legend.maxRows` stays removed.
- Row 129 (engine `vector` caps) and row 120 (17 px prose) are closed.

- Part 3 (owner, 2026-10-16): Keel Workspace is a look-only REFERENCE, not the target; basalt's own
  three-axis rubric (craft, expression, communication) is the bar; scoring is two-way; a missing pattern is
  built only with a fleet consumer. The owner approved the Wave 30 spec as proposed (SPEC § 11 law changes).
- Keel screenshots stay in the public repo's git history (owner: no purge); from #314 images live only in
  the gitignored `.design-parity/`, guarded by `scripts/evidence/keel-licence.test.ts`.

## Process rules learned the hard way

- Release only through `make release`, only after master CI is green on the exact head
  (`git checkout -- bun.lock` first). The wrapper polls npm; trust its exit.
- Every PR gets an independent review (`/review`, i.e. `agw review --pr N`). After two rounds,
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

- `wave-gate.py` checks the predecessor by FILE POSITION, so Part 3 sits between Wave 19 and Wave 20.
- `wave-watch.sh <agent> … <n>` fires DONE when the lead flips the status in its tree, before it pushes;
  confirm with `--agents <lead>` (idle/done) before reviewing.
- A worktree under `/tmp` breaks `git worktree remove` (the `/private/tmp` alias); use
  `.claude/worktrees/<name>` and `git worktree prune`. A fresh worktree needs `bun install` for commitlint
  and a package build for the `check-theme` hook.
- Show the owner boards by `rsync -a --relative .design-parity/<w> iumac:Downloads/basalt-design-review/`.

- A lead may end its turn while its fan workers still run, and then nothing wakes it. Say so in every spawn
  prompt: "wait for workers in the foreground (wave-watch.sh, bounded); never end your turn with workers running".
- A wave lead also writes boards into worker worktrees that `rd fan --clean` deletes, so the brief must name the MAIN
  checkout's `.design-parity/w<n>/`. argo writes to `apps/dashboard/.design-shots/`.
- `make release` needs a clean main checkout and green CI on the exact head. With a lead working in that checkout,
  release between its merges.
- Screenshot live argo yourself with a Playwright script that reads the token from `secrets-run read
  op://common/api/SECRET` through an env var, and never pass the token through a tool argument.

- **The merge train gates on the mini's `make check`, never on Linux CI.** master CI was red for about 15 commits
  (Waves 51–52): ICU on Linux spells September `Sept` where macOS spells it `Sep`, and the CI job stops at its first
  red step, hiding the layout failures behind it. A wave's close-out must confirm `gh run list --branch master
  --workflow CI --limit 1` is green; a test never computes its expected date through the runtime's own `Intl`.
- `rd fan` workers open DRAFT PRs, and `rd merge` cannot merge a draft (it runs `make check` first, then fails):
  `gh pr ready` before the train. Six parallel workers starve each other's test suites; cap at 3–4.
- Never put backticks in an `rd say` message: the sender's shell executes them.
- A worker that runs `make check` in the background and ends its turn may never resume: brief foreground waits.
- Close the tabs your fleet opens in other repos (`rd fan --clean <repo>`, `herdr pane close <pane>`); never close a
  tab you did not open.

## Spawning a wave lead (template)

Part 3 (design track):

```bash
RD_ORCHESTRATED=1 RD_WAVE_MODEL=opus rd wave basalt-ui 'Read docs/waves/PLAN.md. Execute the active wave (Wave N). Follow the /wave skill as the lead (roles/lead.md): read Part 3'"'"'s header, Wave N-1'"'"'s Left behind, and docs/waves/design-parity/SPEC.md (the sections the wave cites). The licence boundary is binding and images never enter git (.design-parity/ only). Run the rounds with basalt-ui shot and the basalt-design-reviewer subagent; keep every round'"'"'s board. Brief workers on disjoint file groups, fan out with rd fan, get every PR independently reviewed (two rounds, then freeze scope and read the last fix diff yourself), land with rd merge. Package changes are their own commits; shipped rule edits need the make sync-self copy as a separate commit; breaks ship as plain feat: with a MIGRATING entry; never format or edit CHANGELOG.md. Do NOT release and do NOT spawn the next wave.'
```

Part 2 (when Part 3 has closed) uses the same template but reads Part 2's header and
`docs/waves/maturation-v2/SYNTHESIS.md` § 3. Basalt waves 18–21 map to synthesis 1–4, 22 is the toolbelt,
and 23–28 map to synthesis 5–10. `rd wave` refuses while another agent in the checkout is `working`;
`rd fan` worktrees do not block it.

## First actions for the new mother

1. `rd agents`: is the active wave's lead alive, and are its fan workers done?
2. Send weatherorb's orchestrator (`uds:/tmp/cc-socks/3255.sock`, `weatherorb-f4`) one line saying the basalt-ui
   orchestrator rotated and this session is its new counterpart.
3. Resume "In flight".

## Rotation

Rotate at ~60% context: rewrite this file, commit it via a docs PR, and start a fresh mother.
