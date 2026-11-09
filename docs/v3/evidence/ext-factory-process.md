# ext-factory-process: how the software factory structures and executes work, and how v3 rides on it

Date 2026-11-09. F = observed fact (cited), J = my judgement. Paths: `SF/` = `~/SourceRoot/software-factory/`, `B/` = `~/SourceRoot/basalt-ui/`.
`rd issues` worked from this session; every `factory` read needs a token this session lacks (401), so live capacity numbers below come from docs and `rd issues`, not `factory capacity get`.

## 0. Headline

1. **The wave machinery basalt-ui still documents is gone.** `rd help` has no `wave`, `fan` or `merge` (run today: "unknown subcommand 'fan'"); the lanes are `rd issue` and `@implementer` only (`dotfiles/docs/agent-platform.md` lanes table; `SF/docs/decisions.md:102` RS1: "A plan is Issues linked with `--after`; no lead starts or waits for another lead. 'Wave' retires as a runtime word"). `B/docs/waves/handoff/mother.md` (spawn template at :153, `rd fan` rules at :146) and `B/docs/waves/PLAN.md:18` ("Mode: fleet, orchestrated ... mother ... `rd fan`") describe a dead process (F). v3 must be planned as factory Issues, not waves.
2. **The unit is one Issue = one lead = one worktree = one PR that ships alone**, built by Sonnet high (role table `SF/config/roles.json:3`); the lead cannot be raised per Issue (the brief says facts "pick no repo, role, command or policy", `SF/apps/server/src/domains/leads/brief.ts:129`). Opus exists only in the owner's/orchestrator's interactive session. So every v3 design decision must be made _before_ the Issue is filed and written into facts or into a spec file on master (J, follows from F).
3. **basalt-ui is not a factory project yet** (no `project.yaml`, no `docs/plan.yaml`: `ls` both missing). A repo without one runs as `defaultProject`: 1 lead, no deploy, ship by push (`SF/apps/server/src/domains/planning/project.ts:179-181`), and `via: push` collides with the PR-required ruleset and the `protect-branches` hook (`dotfiles/config/pr-required-repos.json`). First step of v3 is a `project.yaml` with `ship: [{paths: ['**'], via: pr}]` (J).
4. **The real concurrency limit is not the factory, it is basalt-ui's hot files and its ~17 min CI**: since 2026-10-13, `MIGRATING.md` appears in 386 package commits, `check-budgets.ts` 137, `llms.txt` 131, layout fixtures 119/83, `package.json` 56 (my `git log --name-only` count over `packages/basalt-ui`, excl. docs). Parallel leads would conflict on exactly these. Remove them as contention points before fan-out (section 5).
5. **The closest precedent for v3 is the factory Console v0 to v1** (Base UI + shadcn + Tailwind 4 on Basalt tokens): v0 met every functional acceptance line and the owner still judged it "far away from great UI, every screen built without care" (`SF/docs/rewrite/state.md:130`); the redo shape (kit, frame, N screens in parallel, review) is the template for v3 (section 7).

## 1. How the factory structures work (facts)

| Concept              | Fact                                                                                                                                                                                                                                                                                      | Cite                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Issue                | filed with repo, title, `facts` (JSON object), optional `--after` (repeatable, each must exist and be open), `--key` (stable, replay returns stored Issue and ignores `--after`), `--source`                                                                                              | `rd issue --help` (= `factory issue schema`)                                                                        |
| Facts convention     | `why`, `what`, `change`, `acceptance`; "nothing enforces the four keys"; any other key is passed to the lead as `name: value`; the lead "cannot see the filer session"                                                                                                                    | `rd issue --help`                                                                                                   |
| Facts limits         | `--text` up to 20000 chars (not on `rd`); a plan file is capped at 64 KiB; brief clips notes at 24 KB                                                                                                                                                                                     | `rd issue --help`; `SF/docs/plan.md:28`; `brief.ts:~100`                                                            |
| Lead brief           | fixed standing orders (byte-identical for prompt cache) then the Issue as filed; lead owns "root cause to verified production"; reads/writes via subagents (Explore to search, @implementer to write); reviews once per ship range; stops "by impact, not effort"                         | `brief.ts:7-27`                                                                                                     |
| Ship                 | lead names merged commits, git must find them on the default branch; lead states one `met:`/`not met:` line per acceptance line; unstated acceptance and unreviewed ships are counted as friction, never refused                                                                          | `SF/docs/architecture.md:181-187`                                                                                   |
| State                | `settling`, `queued`, `working`, `waiting`, `watching`, `closed`; queue reasons `chain`, `line`, `finalizing`, `unknown_project`, `drain`, `load`, `memory`, `claim`, `window`, `cap`                                                                                                     | `SF/docs/language.md:23,32`                                                                                         |
| Plan file            | `docs/plan.yaml` on the default branch: rows with `key`, `title`, `facts`, `kind`, `repo`, `after` (keys, or `project:key`), `not_before`; a row is filed once its `after` rows are closed; a row whose Issue was dropped still releases dependents; `issue: N` adopts a hand-filed Issue | `SF/docs/plan.md:60-80`                                                                                             |
| Plan splitting rules | one row = one change that ships alone; independent rows carry no `after` ("never to put independent rows in a line"); acceptance is a check; a taste verdict row goes `after` the last row that makes the thing whole                                                                     | `SF/docs/plan.md:82-93`                                                                                             |
| Size budgets         | an Issue working longer than its size budget (s 2 h, m 6 h, l 1 day) is a health line                                                                                                                                                                                                     | `SF/docs/strategy/2026-11-reset/design-v3.md:132`                                                                   |
| Review               | `agw review route` per range: none / light (Sonnet medium) / deep (Sonnet high plus verifiers); tiers come from the repo's `REVIEW.md` globs; at most 2 rounds                                                                                                                            | `SF/docs/decisions.md:105`; `SF/REVIEW.md:2-14`                                                                     |
| Landing              | project `ship:` rule `via: push                                                                                                                                                                                                                                                           | pr`; lead rebases on current master, re-runs `make check`, runs `make merge-guard`, merges; "never merge around it" | `SF/AGENTS.md:129`; `brief.ts:17` |

`make merge-guard` exists only in software-factory (`SF/Makefile:96`; `grep merge-guard ~/SourceRoot/*/Makefile` finds nothing else) while the standing orders tell every lead to run it. basalt-ui's Makefile has no such target (`B/Makefile` read in full). A basalt-ui lead would hit "no rule" at the landing step (J: needs its own `merge-guard`, section 5).

## 2. How `--after` chains schedule

F:

- `--after` writes dependency rows at create; admission admits only Issues with no open dependency; among admitted, order is fix first, then `prio`, then Issue number (`SF/docs/waves/reset.md` Wave 2; `SF/apps/server/src/domains/planning/queue.ts:72`). Live proof: B `--after` A admitted 6 s after A stopped.
- A closed Issue of any outcome releases dependents (`plan.md:70-71`): a `dropped` or `cancelled` prerequisite does NOT block its dependents. The Console chain relied on it (`443` cancelled, row done).
- `--after` on a CLOSED id is refused (exit 2, "Issue 58 is closed already", `reset.md` Wave 2): the DAG must be filed in topological order, or expressed as plan rows (which wait unfiled until prerequisites close).
- Plan rows are late-bound: the row is filed only when `after` rows close, from the plan as it is on the default branch at that moment (`plan.md:60-72`, `factory project sync --fetch true` reads the remote now, `plan.md:100`). Row facts are therefore editable (by docs PR) until the row is filed.
- Same-repo claim deadlock: a working/watching Issue holds its repo's claim; if it is `after` an Issue of the same repo that is queued for lack of a claim, neither moves. The steward defers the holder (`SF/docs/architecture.md:145-154`). Only open planning edges are seen. Plan rows avoid it by construction (a row files after its prerequisite closed).
- A loop (`queue`) may add `after` edges itself ("the edges checked and added through planning", `architecture.md:271`). J: expect occasional factory-added edges in a big same-repo DAG; read `factory queue order` after filing.
- A wait that needs a person gives the claim back (`language.md:33`); a lead deferring `--after` gives its claim back and returns as "owed", served before new leads (`architecture.md:134,150-152`).
- Cross-project edges work: plan `after: [other-project:key]` (`plan.md:34-35`). Waiting consumers (argo, shutterflow rewrites) can chain `after` the v3 GA row (J).

Observed timings (F, `rd issues --state closed`, 2026-11-09): mechanical Issues 15-35 min elapsed (545: 15, 531: 16, 547: 24, 544: 25, 538: 29); UI/system Issues 80-140 min (534 frame 96, 529 kit 112, 528 137, 532 102); a taste-review Issue left waiting on the owner burned 963 min and was cancelled (443). `workingMs` is 20-60 % of elapsed (queue and waits dominate).

## 3. Concurrency a single repo tolerates

F:

- `project.yaml leads: N` (1..8, default 1; `project.ts:166`) plus one for a fix; `pace` allows one; `FACTORY_LEADS_PER_ACCOUNT` default 2 (`app/planning-settings.ts:64`); three Max accounts exist (`iu`, `me`, `me2`, `agent-platform` and `model-routing.md` section 1). Host admission also gates on 1-minute load and memory; "memory is the limit on parallel leads" (`decisions.md:158` NL6).
- software-factory runs `leads: 3` today (`SF/project.yaml`); 3 Console screens ran while 3 queued with reason "claims are full" (`rd issues`, Issues 537/539/540 working, 541/542 queued). weatherorb ran leads 1, then 2, then 3: 2 meant more deploys (broke rounds), 3 was fine after deploys became round-safe (`state.md:124`).
- Load discipline: a host-wide test-slot semaphore around `make test` (`SF/AGENTS.md` Validate; `decisions.md:59` FL7), wait past 45 min exits 75. Load reached 385 on 12 cores from parallel checks (`strategy/2026-11-reset/learnings.md:8-13`).
- Parallel leads in one repo broke master CI at 3 concurrent merges: "master CI red on most runs since 13:26 with three leads merging in parallel (a KPI fixture test, loops scenarios at 5 s under load)" (`state.md:104`). Fixes were Issues 430/434/435 (deflake) and 471 `merge-guard` (`state.md:118`).
- Two leads took migration number 0993 (`state.md:116`); numbers are now range-allocated per package for parallel work (`SF/docs/rewrite/briefs/parallel.md` "Migrations in your number range only").
- Resumed-lead livelock on a repo with one free claim (fixed, Issue 527, `state.md:129`).
- basalt-ui facts: repo allows ONLY rebase merge (`gh api`: merge_commit false, squash false, rebase true), so granular commits survive and `isolated-basalt-ui` (lefthook) must pass per commit (`B/lefthook.yml:15-23`); ruleset has no required status checks (memory); CI takes 16-19 min (`gh run list`: 08:36 to 08:53, 21:31 to 21:47, 19:16 to 19:35); `make check` builds first, then pre, layout, coverage, doc drift, pack-test (`B/Makefile:15-24`); in the v2 rewrite basalt shipped 82/249/158/151/249 commits per day (git, 10-13..10-17) with at most 3-4 parallel workers (`mother.md:74,147`: "Six parallel workers starve each other's test suites; cap at 3-4").
- `merge-guard` semantics ("master's last CI run is red or still running" refuses, `SF/scripts/merge-guard.ts:6-8`) would serialize basalt merges on a 17 min CI: at most about 3 merges per hour (J, arithmetic from the two facts). Decide: require green-not-red rather than green-not-running, or accept serial landing.

J recommendation: `leads: 3` for the fan-out phase (matches both the factory's own repo and basalt's own "3-4" rule), raise to 4 only when `factory read host` shows memory headroom and the hot files are gone; `queue set pace` on the project when the weekly window nears the owner's 90 % line.

## 4. Models and efforts

| Seat                                                | Model and effort                                                                                                                                                            | Source                                                                   |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Issue lead                                          | Sonnet, high (never per Issue)                                                                                                                                              | `SF/config/roles.json:3`; AGENTS.md:41 ("changed only on measured data") |
| @implementer in a lead                              | Sonnet; role table says high, agent file says `effort: medium` (discrepancy: the table governs only terminals the factory spawns, in-session subagents take the agent file) | `roles.json:4`; `dotfiles/agents/implementer.md:4`; `SF/AGENTS.md:41-46` |
| Reviewer                                            | Sonnet medium (light) or Sonnet high + Haiku-high verifiers (deep)                                                                                                          | `roles.json:6`; `decisions.md:105`                                       |
| Explore, verifier, review-verifier, general-purpose | Haiku, high                                                                                                                                                                 | `dotfiles/agents/*.md` frontmatter                                       |
| Orchestrator / owner session                        | Opus (`c` medium, `ch` high), Max lane                                                                                                                                      | `model-routing.md:117-121`                                               |
| Opus worker                                         | allowed only with `[opus: <reason>]` in the subagent description, novel hard logic; Fable worker and any `fork` from Fable or Opus denied                                   | `model-routing.md:131-133`                                               |
| Billing                                             | development on Max subscriptions only; the factory never spills past a window or cap, waits for the first opening                                                           | `SF/docs/architecture.md:135`                                            |

Old basalt practice (Opus lead, Sonnet workers, `RD_WAVE_MODEL=sonnet`; `mother.md:74`) no longer exists. Measured: factory cost 1.17 USD per Issue, cycle median 28.8 min, first-pass verification 92.5 % (target 90 %), 0.107 refusals per Issue (`state.md:114`, day-one self-audit). Quota right now: `iu` 64 % weekly (resets 2026-11-11), `me2` 7 % (`rd issues` quota field). The old basalt wave cost 3-8 % of a week (`mother.md:74`); a v3 estimate in section 9.

## 5. Failure modes seen (and what v3 does about each)

Factory side (F):

| Failure                                                                                                  | Evidence                                                   | v3 mitigation (J)                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parallel leads merge onto a moved or red master                                                          | `state.md:104`                                             | basalt `merge-guard`: branch contains origin/master, no unresolved generated-file drift, master not red                                                                                                         |
| Two leads claim the same counter (migration 0993)                                                        | `state.md:116`                                             | no shared counters: delete MIGRATING per-PR appends and the budget ledger edits as contention points                                                                                                            |
| Reviewer drops files on its first pass over a large range; refusal then second pass covers               | `learnings.md:37`                                          | cap Issue size so ranges stay small; expect one refusal                                                                                                                                                         |
| Parallel reviews collide on the base-commit thread                                                       | `learnings.md:60` (fixed by `--thread rw-<n>` for workers) | unverified for v4 leads all cut from one master sha; pilot Issue must confirm, else brief a unique thread name                                                                                                  |
| Review coverage is by sha, a rebase makes commits "uncovered"                                            | `reset.md` Wave 2 learnings (`rd merge` rebases)           | GitHub rebase-merge always rewrites shas; the ship gate maps by patch (`evidence.ts` `landedAt` comment) but `covered` is unverified here; it is friction, never a refusal (NL23). Pilot must record the status |
| Load storm: 385 load from parallel checks                                                                | `learnings.md:8-13`                                        | leads 3, test slots, no screenshot or layout suite outside the slot                                                                                                                                             |
| Lead ends its turn with work running / idle lead                                                         | `state.md:130`, steward idle wake 431                      | built in; brief says "never end a turn on a foreground tool"                                                                                                                                                    |
| Proving a change becomes the stall (scratch Issues hold claims)                                          | `learnings.md:286`                                         | no scratch Issues; one pilot Issue is a real one                                                                                                                                                                |
| A docs commit on master during a watch makes a healthy hold red                                          | `learnings.md:Wave 5`                                      | project.yaml `hold: 0m`; orchestrator pushes no master commit mid-Issue except via PR                                                                                                                           |
| Taste: v0 passed every acceptance line and read "generated"; built at 1280x800, owner works at 1800x1200 | `state.md:130`, `SF/apps/console/DESIGN.md:4-15`           | kit-first, one exemplar through an owner verdict before any fan-out (section 7); viewports in acceptance                                                                                                        |
| A whole-product "review" Issue waits on the owner for 16 h, then is cancelled                            | Issue 443                                                  | owner verdict rows are `kind: chore`, placed after the thing is whole, and are few                                                                                                                              |
| Orchestrator's own wrong diagnosis (read a truncated tail)                                               | `state.md:124`                                             | read the lead's evidence and diff, not the summary                                                                                                                                                              |
| Manifest field ships after the code reading it, so project.yaml fails to parse                           | `state.md:119` (463 cancelled)                             | land project.yaml with no new fields first                                                                                                                                                                      |

basalt side, wave era (F, `mother.md:106-151`): workers misreport (a layout fixture was cut from 4 to 3 to pass; CHANGELOG reformatted by oxfmt); the merge train conflicts on MIGRATING `## Unreleased` whenever two PRs append; shipped-rule edits need a separate `make sync-self` non-package commit; draft PRs unmergeable; ICU `Sept` vs `Sep` kept master CI red ~15 commits because the train gated on the mini, not Linux CI; fresh worktrees need `bun install` and a package build for the `check-theme` hook; backticks in `rd say` executed by the sender's shell. J: all of these become either lead-brief facts (the separate-commit rule, no CHANGELOG edits, `make sync-self`) or `make check` gates (no `Intl`-computed expectations).

## 6. Issue granularity: what worked, what failed

Worked (F):

- Console kit (529) = one component set + route + screenshots, 112 min, 18 turns, three review rounds scored 32 then 60 then 75 against references (`state.md:133`).
- Console frame (534) = sidebar, header strip, palette, one server read, 96 min.
- Each screen = its own row `after` the frame, with `why` quoting the owner, `change` pointing at a DESIGN.md section by name, and `acceptance` naming Playwright checks plus screenshots at 1800x1200 dark and light, 1280x800, 390x844 "compared against DESIGN.md and the reference images" (`SF/docs/plan.yaml:296-378`).
- The reset ran each row as "one worker in a worktree, briefed with its row plus the design section it implements" (`reset.md:9-10`): 6-25 min per row with `make check` and deep review.
- Mechanical, single-concern Issues finish in 15-35 min with 1 attempt (545, 531, 547).

Failed or was waste (F): a "review the full Console" row (443); a plan row filed at once that the old stability gate would have held (Issue 297, `learnings.md` window 1); a lead given a diagnosis rather than a problem (design: "the brief carries the problem and never a diagnosis", `decisions.md` carried list); the pre-factory wave mode where one lead fanned out 6 workers.

J, sizing for v3: 15 files or fewer, one directory slice, 1500 changed lines or fewer, one PR, one concern (port, rule, skill snippet, or test harness), acceptance with a machine check. Anything above `m` (6 h) splits. A UI Issue is `m` by construction (80-140 min with 3 shot rounds); mechanical is `s`.

## 7. Keeping cross-Issue contracts stable

Mechanisms the factory itself uses (F):

- **Ports and honest stubs.** Parallel workers "do not wait for it and do not import it": a domain declares the interface it needs in its own folder, tests use a fake, `main.ts` gets a `stub<Port>` naming the package that brings the real one; the orchestrator wires at integration (`SF/docs/rewrite/briefs/parallel.md` "When you need another domain"). Integration was "a second pass by the worker" (`learnings.md` packages 2, 3, 5).
- **Owned folders and additive shared edits.** Each worker has named folders; shared files get one additive line; "not at all" list for kernel files; cross-package changes go in the report's open points and the orchestrator makes them (`parallel.md` "Where you may write").
- **Ranges for counters** (migrations 0200-0699 split per package).
- **Generated artifacts checked by `make check`** (CLI from OpenAPI, Issue diagram): the stale file fails the gate, never a human.
- **Report per worker** with ports declared, events recorded, open points (`parallel.md` Finish 4).
- **Rule files that fail the build**: `scripts/boundaries.ts`, `retired-words.ts`, `public-scan.ts`, `policy.test.ts` ("a new route gets its row first and the test fails without one", `SF/AGENTS.md:55-57`).
- **Facts name paths, not copied signatures**, because the plan is filed late and the lead reads the real tree (`plan.md:84-87` "cannot see this plan").

J, for v3:

1. **Contract = files on master, not prose.** A `V3-SPEC` section per area plus a types-only contract module (`contract.ts` per area, no implementation). Downstream Issues are filed `after` the Issue that merged it. Add a `check-contract-frozen` gate to `make check`: the contract files' hash is pinned in one JSON; a PR changing a contract file must change the pin, and only a row titled "Contract amendment" may. Cheap, and it turns "keep the contract" into a failing build.
2. **Unhot the hot files first** (the single biggest enabler of parallelism): MIGRATING becomes one file per area under a directory concatenated at release (or only one release-time section), `llms.txt` and `export-surface.json` regenerated by `make check` / lefthook (a worker never hand-edits), `check-budgets.ts` ceilings become a per-area ledger or generated. Evidence: counts in headline 4.
3. **Area folders owned by exactly one Issue at a time** (the `parallel.md` rule), declared in facts as `owns:` and `must_not_touch:`; shared files additive.
4. **A worker that needs a contract change files a signal** (`factory signal file --from agent:basalt-ui --title ... --text ...`, a brief verb at `brief.ts:~55`) and takes the reversible default; the orchestrator files the amendment row. Do not let leads edit the contract.
5. **Exemplar-first.** One component (the owner's StatCard) is built end to end through the full pattern (component, lint rule, skill snippet, playground route, shot, test), with an owner verdict artifact, _before_ the fan-out. Every later Issue cites that exemplar by path: "do as `src/dashboard/stat-card/*`". This is the Console's kit/DESIGN.md pattern (`DESIGN.md:67-90`).
6. **Dogfood-by-Issue rule:** every area Issue states in acceptance that the rule, the skill snippet and the test for its area exist (rules guarantee, skills teach, per `BRIEF.md`).

## 8. How a "mother"/orchestrator steers now

F:

- The mother role is retired (RS1, RS4, RS11); the orchestrator is a _temporary_ role of the owner's session (`decisions.md:169` NL14) with its own principal: token `FACTORY_ORCHESTRATOR_TOKEN`, caller and actor `orchestrator`, the owner's rights except six person routes (worth-asking, verdict, annotations, Errand done, promote, dismiss of a held signal); its steering is the friction group `orchestrator_steer`, so it is measured (`SF/AGENTS.md:51-53`; `api/policy.ts:14-30`).
- Its notes bind the lead like the owner's: "a `noted` whose actor is `owner`" is typed as the owner's word, and `domains/leads/note.ts:14-16` treats `orchestrator` the same (code comment: "the orchestrator is the owner's delegate").
- Verbs (from `factory --help`): `issue new/note [--wake]/prio/cancel/reopen/answer`, `planning after`, `queue get|set run|pace|drain|order`, `capacity get|admit|refresh`, `project sync|show`, `follow --issue N --until-closed`, `issue quality N`. Reads: `factory read overview|needs|flow|host`.
- How the factory's own orchestrator ran day one (`SF/docs/rewrite/state.md:100-139`): a 30-min log of Issue states; it raised or lowered `leads` per repo from evidence (agent-workflows to 2, weatherorb to 2, then back to 1, then 3), set `prio` (9 for core bugs), filed the next row when the chain moved, read each lead's evidence, filed correction Issues for its own wrong diagnoses, and wrote the owner a Report artifact. The owner reviews through artifacts and Decisions, never by watching panes.
- Hard limit: "Never call a port inside a transaction" etc. are the factory's own; for steering, the Stop rule sends a lead back once if it stops with nothing reported (`brief.ts:~30`), the steward wakes idle leads after 20 min (`architecture.md:138-144`).

J, v3 orchestrator loop (one Opus session, rotated at ~60 % context, state kept in the plan file and `docs/v3/STATE.md`, not in memory):

1. Every 20-30 min: `rd issues`, `factory queue order`, `factory capacity get`.
2. Per closed Issue: read the PR diff (a worker's report is a claim), check no test was weakened or deleted, `CHANGELOG.md` untouched, contract pins unchanged, `make check` green on master.
3. Act only through: `issue prio`, `issue note --wake` (steer), a new row (amendment, friction), `queue set pace|drain`, `leads` change by docs PR.
4. Release stays the owner's decision, only `make release` (`B/AGENTS.md` Release Process).
5. Target: `orchestrator_steer` friction trending to zero by writing better facts, not by more notes.

## 9. Recommendation: the wave and Issue template for a 700-file rewrite

Scale (F): `packages/basalt-ui/src` is 729 files in 345 source files plus 430 tests across the package; 70 source files import Mantine, 44 % of lines (31.5k of 72.0k) are already Mantine-free (`self-process-lessons.md` headline 1). v3 is ~40k lines of UI layer rewritten over a carried spine, and the spine is _retarget and verify_ work. Directory file counts (`git ls-files`): charts 90, dashboard 85, content 62, theme 58, shell 55, controls 55, agent 55, cli 50, provider 32, common 32, tokens 26, table 23, commands 19, guard 12, router 11, format 10, theme-lab 8, forms 7, state 6.

### Phase 0: orchestrator, inline, Opus, before any Issue (owner decisions)

Files, all via ordinary docs PRs (REVIEW.md `none` for docs):

- `project.yaml` for basalt-ui: `ship: [{paths:['**'], via: pr}]`, `leads: 1` first (then 3 after the pilot), `deploy: {mode: none}`, hold `0m`, `hygiene` default. Keep it field-minimal (`state.md:119`).
- `REVIEW.md` for basalt-ui: `none: [docs/**, .claude/plans/**, bun.lock, CHANGELOG.md]`, `sensitive: [scripts/release.sh, .github/**, .releaserc.json, packages/basalt-ui/src/guard/**]` so deep review is spent where a mistake ships.
- `make merge-guard` (copy of `SF/scripts/merge-guard.ts` logic, minus migrations, plus "generated files in sync").
- `AGENTS.md` lead facts: PR-only, rebase-merge only, the separate-commit rule as two commits in one PR, `make sync-self` as its own non-package commit, never edit `CHANGELOG.md`, `make check` vs `bun run pre`.
- `docs/v3/V3-SPEC.md` skeleton and the doctrine/gate change deliberately (BRIEF known conflict).
- `docs/plan.yaml` with the DAG below.

### Phase 1: contract, serial (3-4 Issues, `leads: 1`)

| Key         | Title                                                                                                                                                          | after                 | Size |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ---- |
| v3-pilot    | One real small Issue through the lane (e.g. the 2.29.1 fix release prep or a docs fix) to prove PR, rebase-merge, review coverage status, `merge-guard`        | none                  | s    |
| v3-doctrine | Release doctrine, `release.sh` version_gate per line, `.releaserc`, `publish.yml --tag`, MAINTAINING                                                           | v3-pilot              | m    |
| v3-unhot    | Remove hot files: per-area MIGRATING, generated llms/export-surface, per-area budget ledger, `check-contract-frozen`                                           | v3-pilot              | m    |
| v3-skeleton | Tailwind 4 + shadcn base + registry layout, token bridge, build + pack-test green on the new layout                                                            | v3-unhot, v3-doctrine | l    |
| v3-exemplar | StatCard end to end (component, rule, skill snippet, playground route, shot at 1800x1200 + 390, tests); submits a Spec/Report artifact for the owner's verdict | v3-skeleton           | m    |

`v3-doctrine` and `v3-unhot` are independent: run together at `leads: 2`. The exemplar is the owner's taste checkpoint (`console-first-look` pattern, `SF/docs/plan.yaml:105-114`).

### Phase 2: fan-out by area (about 30-40 Issues, `leads: 3`)

One row per area slice, all `after: [v3-exemplar-verdict]` and nothing else unless a real code dependency exists. Slices (J, from the directory table): shell+nav (2), controls+forms (4), table (3: engine, views, responsive transform), dashboard cards and kinds (4), charts toolkit kept (3: retarget, cursor/tooltip, tokens), content/MDX/agent chat (4), state/provider/router (3), cli+init+sync+doctor (3), guard rules (4: one per rule family, each with fixtures), shipped skills and rules (3), theme/tokens/theme-lab (3), commands/format/common (2), playground pages (3), a final "consumer-readiness" row. Independent by construction because each owns its folder and the contract files are frozen.

### Phase 3: convergence and release (3-5 Issues, serial)

`v3-integration` (all areas wired, one failing-first e2e per area), `v3-review` (owner verdict, `kind: chore`, `after` all area rows, one only), `v3-migrating` (the single 2.x to 3.0 section), `v3-release-dryrun` (never the release itself: `make release` is the owner's call), then consumer rows `argo-v3`, `shutterflow-v3` as cross-project `after: [basalt-ui:v3-release]`.

Estimate (J, assumptions stated): about 50 Issues, 25 mechanical at 35 min and 25 UI at 100 min of lead time, 3 concurrent leads gives roughly 20-25 h of lead wall time; landing serialized on a 17 min CI adds up to about 15 h if merge-guard demands "not running" (so relax it); so 2-4 days elapsed, quota-bound rather than machine-bound. Cost at the factory's 1.17 USD per Issue average is not the constraint; the weekly Max window is (`iu` at 64 %). Use `queue set pace` and the owner's 90 % line.

### The Issue template (`rd issue basalt-ui <title> --facts @file --after <id> --key <key>`, or a plan row)

```json
{
  "why": "One sentence: the user-visible or doctrine reason; cite the V3-SPEC section by name.",
  "what": "Exact paths owned by this Issue: packages/basalt-ui/src/<area>/**, its tests, its playground route. Nothing else.",
  "owns": ["packages/basalt-ui/src/shell/**", "packages/basalt-ui/tests/shell/**"],
  "must_not_touch": [
    "packages/basalt-ui/src/**/contract.ts",
    "CHANGELOG.md",
    "packages/basalt-ui/MIGRATING.md (use the per-area file)",
    "other areas' folders"
  ],
  "contract": "Read docs/v3/V3-SPEC.md section X and packages/basalt-ui/src/<area>/contract.ts; both are frozen. Need a change? factory signal file, take the reversible default.",
  "exemplar": "Follow packages/basalt-ui/src/dashboard/stat-card/* for anatomy, rule, skill snippet, test and shot layout.",
  "change": "What to build, one concern. Name the lint rule, the skill snippet and the test that ship with it.",
  "commits": "Package changes and non-package changes are separate commits in one PR (lefthook isolated-basalt-ui); make sync-self as its own non-package commit; conventional, empty scope, no AI attribution.",
  "proof": "Playwright or layout check names; basalt-ui shot at 1800x1200 and 390x844, dark and light, compared against .claude/plans/v3/inspo/<file>; at most 3 rounds.",
  "acceptance": "One verifiable statement per line: make check passes; <rule> fails on fixture <path> and passes on <path>; the playground route renders at both viewports; contract pin unchanged.",
  "out_of_scope": "What the lead must not 'improve'."
}
```

Notes: facts stay under about 4 KB; no copied signatures (the plan files late, the lead reads the tree); one `acceptance` line per check because the ship states each; set `kind` (`feature`, `chore` for owner-verdict rows, `bug`); give priority with `issue prio` (the exemplar and unhot rows at 9).

### @implementer versus factory Issues

| Work                                                                       | Lane                                                                                   | Why                                                                                                              |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Phase 0 files, V3-SPEC, contract modules, doctrine text                    | orchestrator inline (Opus), `@implementer` only for mechanical edits in that live tree | editorial and novel; a Sonnet-high lead cannot be raised per Issue; the owner iterates on taste in the live tree |
| Everything in phases 1-3 that ships on its own                             | factory Issue / plan row                                                               | the lead builds, reviews, ships and verifies; no mother needed (`agent-platform.md` lanes)                       |
| Inside each Issue                                                          | the lead's own Explore + `@implementer`                                                | built into the standing orders (`brief.ts:11`); do not brief it from outside                                     |
| One indivisible sweep (a codemod across many files after a decision lands) | ONE Issue whose lead may use implementer subagents on disjoint folders                 | splitting it into N Issues would create N conflicting PRs on the same imports                                    |
| Parallelism across areas                                                   | never `@implementer` fan-out in one tree                                               | shared live tree, no isolation; "parallelize only on disjoint file groups" (CLAUDE.md)                           |
| Orchestrator review of a landed PR                                         | `/review` + reading the diff                                                           | owner contract "read the diff you produced"                                                                      |

## 10. Open decisions for the owner (real ones only)

1. Release topology R1 vs R2 (`self-process-lessons.md` section 7): factory ships through the default branch and cannot target a long-lived `v3` branch (cited there from `design.md`); R1 (master = v3, `v2` branch for fixes) is the only shape that lets factory Issues run unmodified. The plan above assumes R1.
2. `merge-guard` strictness for basalt-ui (green-not-red vs also not-running): trade-off is merge throughput against a red master; my tendency: not-red only, plus the unhot work, because the 17 min CI is the throttle.
3. Whether to spend one Issue on a factory change making `merge-guard` a per-project target rather than a standing-order line that only software-factory satisfies (filed as a signal on software-factory rather than worked around).

## 11. Not verified

- `factory project sync` accepting a PR-only basalt-ui `project.yaml` was not run (no token here); read from `project.ts` and `queue.ts` only.
- Whether the lead's `/review` uses a unique thread when several leads start from one master sha (`learnings.md:60` predates agw review v4).
- Whether `agw review covered` reads covered after a GitHub rebase-merge (the pilot Issue records it).
- Live host headroom for 3 basalt leads (`factory capacity get` and `read host` need a token).
- `agw routes` (route table) printed but was not needed; model ids deliberately not restated (`CLAUDE.md`: ids live in `agw routes`).
