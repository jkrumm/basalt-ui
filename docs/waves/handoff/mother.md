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

## State (2026-10-17)

- npm latest **2.19.0**. argo is live on 2.19.0, with 10 of 13 pages redesigned (argo Waves 18–21); argo Wave 22 is
  running (lead `argo-w22`). basalt Wave 35 is running (lead `basalt-ui-w35`). rb is on 2.13.1; obsidian,
  linewatch and rollhook are on 2.11.1; weatherorb is on 2.14.0 with its UI held.
- Boards for the owner: `~/Downloads/{basalt,argo}-design-review/` on the MacBook (rsync over `ssh iumac`).
- agent-gateway was disconnected on 2026-10-17. Independent reviews run as fresh subagents with no shared context.
- Owner decisions this cycle: Keel is a reference, not the target; the Wave 30 spec was approved; status text is
  derived per surface; light/outline buttons are ink; no git-history purge of the Keel captures; only argo was
  upgraded in parallel (the rest wait for phase 2); the dotfiles `frontend-routing.md` rule routes basalt vs
  `/dataviz` vs plain React.

## In flight (next actions, in order)

**PARKED 2026-10-19 for the owner's weekly Claude limit (~86 %).** No agent is running; every wave is closed and pushed, no
worktrees are left. Resume after the reset with a fresh mother from this file.

1. Released 2026-10-18/19: 2.22.0 → 2.27.1. 2.24.0 took ~25 min to reach the registry; `release.sh` now polls 60 min and
   exits 3 ("still propagating, do not release again") instead of failing (#e7eb5573). Both grace ledgers are empty
   (`series-palette`, `raw-spacing`, `inline-spacing`, `card-inset` promoted to error, each after argo measured 0).
2. basalt Waves 38 (friction III), 39 (friction IV, r2: S2 99 / S3 98 / S4 98 / components 99) and 40 (friction V, the
   fitness readout) are done. Wave 41 "Data tables, responsive" is marked `active` but NOT spawned.
3. argo Waves 38–42 done (argo is on 2.27.1). Latest verdicts: 13 of 14 pages pass (Home 97, WalkingPad 100, Reading 90,
   Hermes 98, Calendar 97, Body comp 96, Usage 95, astro 94/94, m365 94/93, Warden 92, Agents 92, Strength 90 provisional).
   **Garmin fails on basalt rows only** (55 in argo w42; it was 71 in w41: reviewer variance plus the carried rows).
   argo's PLAN has no active wave; the mother authors the next re-score wave before `rd wave` (the gate refuses otherwise).
4. **First on resume: a short basalt wave "argo friction VI"** before Data tables (insert + renumber as before), from argo
   `docs/design/UPSTREAM.md` § "Wave 42 bump":
   - P1: the info popover covers the card's headline facts (Garmin ACWR, Recovery, Activity score). This is the
     long-standing "info bubble over headlines" row; 2.24 only stopped the flip into the card above.
   - P1: Reading's slotted `Bars` chip still touches its focus ring and is clipped. #457 claimed this; check why the fix
     does not show in a `basalt-ui shot` of argo (a state/hover crop question, or the fix missing the slot case).
   - The activity-strip focus readout over its footer; ACWR drawing its date axis twice.
     Then release, an argo Garmin + Reading re-score (Sonnet is enough for argo re-score waves), then Data tables.
5. Decided 2026-10-18: warden + agent-gateway get an authored `question` field, recorded as a backlog item in each repo's
   `docs/BACKLOG.md` for a later structure-and-maturity pass by the owner; argo adds nothing until it ships.
6. Owner decision queued: SPEC D37 (an errored/empty chart body keeps the loaded height per the SSR contract; the rubric
   scores it as a void). Default until ruled: SPEC wins, the rubric is told about D37.
7. Release cadence: release only when a consumer is waiting on the change. A patch that only makes argo re-shoot for
   nothing waits for the next wave.
8. Budget practice: basalt waves (component design) on Opus; argo bump/re-score waves on Sonnet. A narrow "friction" wave
   (one fan-out, one round) costs a few % of the week; a full basalt wave ~10–15 h.
9. Exit gate (phase 1) unchanged: every argo page passes at 1440/390 in both schemes, no Keel category ahead, the
   fresh-agent expression trial (Wave 46 after renumbering) passes, the owner signs off. Then the owner decides whether to
   pause before phase 2 (fresh mother, fleet rollout).

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
