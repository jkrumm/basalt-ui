# Spike: same-bar agent trial, npm default versus `eject --all` (F3)

G1 holds: agents on npm-default primitives shipped 1 P1-plus-carried finding across the two briefs, agents on `eject --all` shipped 2, and the npm-default agents made 0 ejects. The refute line (arm 1 three or more above arm 2, or more than 3 ejects in one app) is nowhere near. G2 (rb, obsidian) is not run, so the verdict is partial. One side finding matters more than the numbers: on this checkout `basalt-ui eject` refuses 14 of the 35 shipped primitives, `card` and `badge` among them.

Harness: `bun tools/spikes/f3-eject/run.ts` (one JSON object on stdout, exit 0 whatever the counts; it reads the ledger in `results/cells.json` and runs no model). Concept: `docs/v3/ARCHITECTURE.md` section 11 F3 and section 4.1, both frozen; a flip of DPO 4 is the owner's. This spike records, it applies nothing.

## Question

Do agents working against npm-default primitives do clearly worse than agents working against a managed copy of every primitive (`eject --all` at init)? F3 flips DPO 4 (`init` runs `eject --all`) if arm 1 ships 3 or more P1-plus-carried findings above arm 2 summed over both briefs, or needs more than 3 ejects per app. The run also counts the `eject` invocations the arm-1 agents make.

## Method

**Scratch app.** `run.ts stage` builds a package in the OS temp dir that looks like an installed basalt-ui: `dist/**` (js and d.ts, tsc over `src/{core,ui,cards,tokens,common}`), the 35 seeds and guards under `src/ui`, the three CSS sheets, 43 generated docs, `basalt-ui/vite` (the real v3 `basalt()` bundled from `src/vite`) and a `basalt-ui` bin that runs the real `eject` from `src/cli/eject` and logs every call. `prepare <cell>` copies `template/` (Vite 8.3.5, Tailwind 4.3.5, React 19.3.0, `bun run build` is `vite build`, `bun run typecheck` is `tsc --noEmit`), commits it, and for arm 2 runs `eject --all` before the agent starts.

**Briefs** (`briefs/`): `statcards` (a console-style delivery band of four figures, two cards under it, one of them a dash with a reason) and `table` (a dense 16-row ledger with toned states, aligned figures, a selected row, a footer line; usable at 390 without sideways page scroll). Synthetic data only; the console is used for structure, none of its text or data is copied.

**Cells.** 2 briefs x 2 arms = 4 runs. One fresh `implementer`-role subagent per run, in its scratch dir. Both arms get the same `TASK.md` apart from one project note: arm 1 is told `basalt-ui eject <name> --reason "<why>"` exists and to prefer the primitive's props; arm 2 is told every primitive is already its own file. Both arms run the stand-in lint hook after every edit (it skips `src/components/ui/`, which is library source). Agents may read the generated docs and the package source; no skill.

**Rounds.** At most 3. After each build the lead shoots 1800x1200 and 390x844 (full page, Chrome through `playwright-core`) into `shots/<cell>/r<n>/`, builds a packet (`rubric.md` copied from `tools/spikes/thin-skill/rubric.md`, the brief, the shots, `diff.patch` against the template, `lint.txt`) and spawns a blind `reviewer`-role subagent. Packet ids are a seeded shuffle (seed 841), so the reviewer sees `p01`, never a cell. Ejected files the agent never touched stay out of `diff.patch` and `lint.txt`. A round with no P1 and no carried finding ends the cell.

**Counts.** P1-plus-carried per rubric.md. `ejects` is the number of `basalt-ui eject` invocations the agent made (the bin's log; `--help` does not count), with the primitives named. Harness calls are not in the log.

**Verdict rule, as filed.** `refuted` when arm 1 has 3 or more P1-plus-carried above arm 2 (summed over both briefs) or arm 1 ejects exceed 3 per app. `partial` when G1 passes and G2 is pending. `pass` only once G2 is recorded.

This restates the ARCHITECTURE section 11 F3 falsifier ("score drops 3+ points, or >3 ejects per app in both pilots") in the filed terms: the rubric counts findings, not points, so the P1-plus-carried count stands in for the score, and the ejects test is applied to each app on its own, which is the stricter reading until the two pilots exist.

## Measurements

Raw: `tools/spikes/f3-eject/results/cells.json` (ledger), `results/reviews/<cell>.r<n>.json` (the reviewers' replies), `shots/`.

| Brief     | Arm             | P1  | Carried | P1+carried | Rounds | Ejects (agent) |
| --------- | --------------- | --- | ------- | ---------- | ------ | -------------- |
| statcards | 1 npm default   | 1   | 0       | 1          | 2      | 0              |
| statcards | 2 `eject --all` | 1   | 0       | 1          | 2      | 0              |
| table     | 1 npm default   | 0   | 0       | 0          | 1      | 0              |
| table     | 2 `eject --all` | 1   | 0       | 1          | 2      | 0              |

Arm 1 total 1, arm 2 total 2, gap -1 against a refute line of +3. Arm 1 ejects: 0 and 0, against a line of more than 3. Arm 2 ejects are 0 by the agent; the harness ejected 35 files into each arm-2 app before the run.

`G2 count: pending G2` (rb, obsidian: the ejects count per real app is recorded when the pilots run).

**What the three P1s were.** All in round 1, all fixed in round 2; the table arm-1 cell was clean in round 1:

| Cell             | Class    | Finding                                                                                               |
| ---------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| statcards, arm 1 | data     | the Issues merged trend was drawn without its Mon to Sun labels                                       |
| statcards, arm 2 | overflow | the band stayed a horizontal snap row at 390 and cut cells off (fixed by `StatGroup variant="strip"`) |
| table, arm 2     | data     | a hardcoded summary said 12 merged; the rows say 11                                                   |

**Ejects.** No arm-1 agent ejected. Every brief fit inside the primitives' own props (`Card`, `StatCard`, `StatGroup`, `StatCell`, `Table`, `Badge`, `Input`), so the eject count, the cheaper half of the F3 signal, is 0 and the "more than 3 per app" bar was never in play at G1.

**Side findings (the checkout, not the trial).**

- **`eject` refuses 14 of 35 seeds.** Their `../core/*` and `../tokens` imports have no published specifier (`CORE_SPECIFIERS` in `src/cli/merge/seed.ts` maps `../core/cn` only). The refused seeds: alert, badge, card, combobox, dialog, meter, num, progress, sheet, skeleton, slider, status, toast, virtual-list. `eject --all` writes nothing at all, and `eject card` or `eject badge` alone also refuses. The harness stages seeds that name those imports as `basalt-ui/core/*` and `basalt-ui/tokens` (both exported by the staged package) so the trial could run; the stand-in is identical for both arms.
- **Composites import relatively.** `src/cards/*.tsx` import `../ui/card` and `../ui/badge`, and `src/ui/*.tsx` import `./sibling`. The tsup build is unbundled, so the compiled composites keep those paths and the `basalt()` alias on `basalt-ui/ui/<name>` would not reach them. The harness rewrites 12 staged files to the published specifier; with that, an edit to the local `card.tsx` appears in the `StatCard` render (one `Card` definition in the bundle, the local one).

**Limits.**

- One run per cell and one reviewer per round: no variance estimate. The gap of -1 is inside that noise in both directions.
- The briefs fit the primitives, which is why nobody ejected. A brief that needs a primitive's internals (a custom row, a different shell) would test eject itself; neither of these does.
- The stand-in lint hook, the AGENTS-style project note in `TASK.md` and the seed rewrite are not the shipped ones.
- A reviewer called the arm-2 band an overflow at 390 because the agent chose `StatGroup variant="cards"`, which is a snap row below `@regular` by design (`variant` has no default); the brief said "stack on a phone". The call is the reviewer's and stands.
- The spawned subagents also read the session's project and global instructions, which the spike does not control.

## Verdict

F3: partial

Verdict: PENDING

- **G1 holds.** Arm 1 is not worse than arm 2 (1 against 2), and the agent made 0 ejects. Neither refute condition is near.
- **G2 is open.** The real-app count (rb, obsidian) is the part that can still fail the decision; it is recorded as `pending G2`.
- **Not PASS yet.** One run per cell cannot show "clearly worse" or "clearly not worse"; read it as "no sign that npm-default costs quality on two briefs that fit the primitives".

## Then

- **Keep section 4.1 as written** until G2 is recorded; no change to `init`.
- **Fix the seed imports before any eject count means anything.** Either publish `basalt-ui/core/*` and `basalt-ui/tokens` (and map them in `CORE_SPECIFIERS`) or rewrite the seeds' core imports at pack time. Until then no app can eject `card`, `badge` or `alert`, and `eject --all` cannot run at all.
- **Fix how composites reach primitives.** Either the build rewrites `../ui/<name>` to `basalt-ui/ui/<name>` in compiled composites, or section 4.1's "npm composites follow" does not hold.
- **Re-run the trial after both**, with a brief that forces an eject (a row layout the table cannot express), and with three runs per cell before reading a gap of 3.

## Affects

- `docs/v3/ARCHITECTURE.md` section 11 F3 gets this result and section 4.1 keeps its text; the owner of the concept edits it.
- Follow-up signals for the two checkout findings (eject seed imports; composite import specifiers), filed against basalt-ui.
- Nothing else: no `package.json` or lockfile outside `tools/spikes/f3-eject/package.json`.
