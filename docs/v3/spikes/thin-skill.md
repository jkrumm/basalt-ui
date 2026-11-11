# Spike: thin-skill A/B on the StatCard exemplar (S1)

The kill rule fires, by one: on the hook-off pair the thin skill removed 2 P1-plus-carried findings across the three briefs, against a bar of 3. Five of the six P1s the no-skill cells shipped were token or lint violations, which a rule and a hook catch without a skill; the layout defects (table columns cut at 390) survived the skill. Mean `.d.ts` look-ups are 5.67 against the fail line of 6, so the composite-prop-table clause does not trigger.

Harness: `bun tools/spikes/thin-skill/run.ts` (one JSON object on stdout, exit 0 whatever the counts; it reads the ledger in `results/cells.json` and runs no model). Concept: `docs/v3/concepts/skills-agent-layer.md` decision 13 and section 8 row S1, both frozen: the bar is P1 and carried counts. This spike records, it applies nothing.

## Question

Does a thin `basalt-design` skill (one `SKILL.md` plus `anti-defaults.md`, draft in `tools/spikes/thin-skill/skill/`) make an agent ship fewer P1 and carried findings than the same agent with no skill, on the StatCard exemplar and its neighbours? If with-skill removes fewer than 3 P1-plus-carried findings against no-skill, the references are dropped into the generated docs and the rules and issues sk-6 to sk-10 shrink accordingly. The run also records `.d.ts` look-ups per run against the fail line of 6 (concept decision 7).

## Method

**Scratch app.** `run.ts stage` builds a shared package in the OS temp dir: `basalt-ui` as a consumer would see it, with `dist/**/*.d.ts` and `dist/**/*.js` emitted by `tsc` from `src/{core,ui,cards}`, the three CSS sheets, and the seven generated docs that exist today (`stat-card`, `card`, `badge`, `button`, `input`, `field`, `table`). Exports are `./cards`, `./ui/*`, `./tailwind.css`, `./tokens.css`. `run.ts prepare <cell>` copies `template/` (React 19.3.0, Tailwind 4.3.5, `bun run build`, `bun run typecheck`) and writes `TASK.md`. Synthetic data only; the data is in the brief, so "wrong or missing data" is decidable.

**Briefs** (`briefs/`): dashboard (four StatCards, one with a trend, plus a deploys table), list-detail (three StatCards, a PR table with a selected row, a detail panel), settings (one StatCard, two field groups with an error state, actions, a danger zone). Each brief names exact figures.

**Cells.** 3 briefs x skill on/off x hook on/off = 12 runs. One fresh `implementer`-role subagent per run, spawned by the lead, working only in its scratch dir.

- _Skill on:_ `TASK.md` tells the agent to read the skill files placed in the scratch dir's `.claude/skills/basalt-design/` and follow them. Activation is therefore forced; whether an agent finds and loads the skill unprompted is S7, not this spike.
- _Skill off:_ nothing about a skill; the Skill tool is forbidden in both arms.
- _Hook on:_ `hook-stub/post-tool-use.ts` runs `oxlint` on one file with `hook-stub/oxlintrc.json` (jsx-a11y, react, typescript and four token rules in `hook-stub/plugin.js`: raw colour, arbitrary value, palette class, inline style) and exits 2 with the findings. A spawned subagent cannot carry its own `settings.json`, so the hook cells instruct the agent to run that exact command after every edit of a source file. Every hook cell's transcript shows the agent running it (3 to 13 transcript lines name the stub per cell). This tests lint feedback after each edit, not hook delivery; delivery is sk-4 and S2 (`hook-sync`).

**Rounds.** At most 3. After each build the lead shoots the app at 1800x1200 and 390x844 (full page, Chrome through `playwright-core`) into `shots/<cell>/r<n>/`, builds a review packet, and spawns a blind `reviewer`-role subagent. The packet is `rubric.md`, `brief.md`, the two shots, `diff.patch` (against the empty template) and `lint.txt` (the stub's output on the changed files). Packet ids are a seeded shuffle (`seed` 587) of cell and round, so the reviewer sees `p12`, never a cell name; the reviewer reads nothing outside its directory. From round 2, `previous.json` lists the open findings of the previous round. The lead sends the reviewer's findings back to the same implementer. A round with no P1 and no carried finding ends the cell; a cell with a carried finding after round 3 stops there.

**Counts** (`rubric.md`). P1 is one of seven classes: clipped, overflow, overlap, nameless control, token violation, lint violation, wrong or missing data. A defect counts once; a line that breaks a lint and a token rule is one `token` finding (this sentence was added to the rubric after the first two round-1 reviews, the dashboard pair, and changes neither of their findings). Carried is a P1 of round n-1 still open at round n. Per cell: **P1** is new P1 findings summed over rounds, **carried** is carried findings summed over rounds, and the bar is their sum. `.d.ts` look-ups are transcript tool calls whose command or path names a file ending `.d.ts` (`run.ts lookups`, over the whole transcript including fix rounds; a glob such as `dist/ui/*.d.ts` counts).

**Kill rule, as filed.** On the hook-off pair only: kill = sum over the three briefs of (no-skill minus with-skill P1-plus-carried) < 3. A missing hook-off cell gives `pending`, never imputed. Hook-on cells never drive it.

## Measurements

Raw: `tools/spikes/thin-skill/results/cells.json` (ledger), `results/reviews/<cell>.r<n>.json` (the reviewers' replies), `shots/`. All 12 cells ran.

| Brief       | Skill | Hook | Round-1 P1 | P1  | Carried | P1+carried | Rounds | `.d.ts` look-ups |
| ----------- | ----- | ---- | ---------- | --- | ------- | ---------- | ------ | ---------------- |
| dashboard   | off   | off  | 2          | 2   | 0       | 2          | 2      | 6                |
| dashboard   | on    | off  | 2          | 2   | 0       | 2          | 2      | 6                |
| list-detail | off   | off  | 2          | 3   | 0       | 3          | 3      | 6                |
| list-detail | on    | off  | 1          | 1   | 1       | 2          | 3      | 6                |
| settings    | off   | off  | 1          | 1   | 0       | 1          | 2      | 4                |
| settings    | on    | off  | 0          | 0   | 0       | 0          | 1      | 6                |
| dashboard   | off   | on   | 0          | 0   | 0       | 0          | 1      | 8                |
| dashboard   | on    | on   | 1          | 1   | 0       | 1          | 2      | 4                |
| list-detail | off   | on   | 1          | 1   | 2       | 3          | 3      | 8                |
| list-detail | on    | on   | 1          | 2   | 0       | 2          | 3      | 6                |
| settings    | off   | on   | 0          | 0   | 0       | 0          | 1      | 4                |
| settings    | on    | on   | 0          | 0   | 0       | 0          | 1      | 4                |

**Kill arithmetic (hook-off pair).** No-skill 2 + 3 + 1 = 6; with-skill 2 + 2 + 0 = 4. Removed by the skill: dashboard 0, list-detail 1, settings 1, total 2, against 3. For information, the hook-on pair: no-skill 0 + 3 + 0 = 3, with-skill 1 + 2 + 0 = 3, removed 0.

**Look-ups.** Mean over the 12 runs: 5.67 against 6. No-skill mean 6.00, with-skill 5.33; hook-off 5.67, hook-on 5.67; per run the range is 4 to 8. The with-skill cells were told to open `node_modules/basalt-ui/docs/<name>.md` before writing props: 2 of 6 did (4 doc reads in total); no-skill cells read none. The seven generated docs are mostly empty frontmatter and slot lists (`use when: ''`), except `stat-card.md`, so the agents took props from the `.d.ts`.

**What the P1s were** (hook-off pair, all rounds):

| Class                                       | No-skill | With-skill |
| ------------------------------------------- | -------- | ---------- |
| token (arbitrary value or inline style)     | 4        | 0          |
| lint (`prefer-tag-over-role`)               | 1        | 1          |
| clipped (a value or a table column cut off) | 1        | 3          |
| other                                       | 0        | 0          |

The no-skill cells wrote `max-w-[480px]`, `grid-cols-[...]`, `data-[selected=true]:` and an inline `style` height; the skill says no arbitrary values and none of its cells did. The with-skill cells lost P1s to layout: the Review-time figure truncated to `5....` at 1800 (fixed in one round), and the PR table cut at the card edge (still open at round 2, fixed at round 3). Among the hook-on cells the only open finding after round 3 is again a 390 px table (`list-detail`, no skill, carried twice and still open when the three rounds ran out).

**Limits.**

- One run per cell and one reviewer per round: no variance estimate. The margin on the kill is 1 P1.
- Reviewer noise is real. A scrolling table with cut columns at 390 was called clipped in three first builds and left alone in the fourth, which stacked its columns. The `lint` class is defined by the stub's own rule set, not by the repo's final rules.
- The stubs' rules (jsx-a11y, the four token rules) are the same ones the hook-on cells saw, so the token and lint classes are partly a property of that rule set.
- Fonts are not loaded in the shots (the generated sheet's `url()` is not resolved by the Tailwind CLI); the system face renders. All cells are equal in this.
- The spawned subagents also read the session's project and global instructions, which this spike does not control.
- Round 1 is the cleanest read of the first-build effect; rounds 2 and 3 measure how well an agent absorbs a reviewer's list, which depends on the list's wording.

## Verdict

Kill: yes

Owner: pending

- **Kill.** The rule as filed fires: 2 removed, 3 needed. It rests on 12 single runs, so read it as "the thin skill's measurable effect is at most about two findings across three briefs, and all of it in a class a rule catches", not as "skills never help". The hook-off round-1 counts agree in direction: no-skill 5, with-skill 3.
- **Owner.** The owner's taste check of the brief-1 shots (`shots/dashboard.*/r*/`) is recorded here as pending; Kill does not wait on it.
- **Look-ups.** 5.67 is below the fail line, so the clause "inline composite prop tables or source-owned composites" is not triggered by this run. It is close: two of the twelve runs read 8, and the generated docs were nearly empty.

## Then

- **Drop the references into docs and rules** (concept decision 13): the token and lint rows of `anti-defaults.md` become rule messages and the hook's findings (the hook-on cells reached 0 token findings; the stub is the draft of that rule set); `states.md`-style copy rules go into the generated docs. A skill that remains is method only, and it links.
- **Make docs the thing agents open.** Two of six skill-on agents followed the link to a doc. Props reach the agent by the `.d.ts` or the diagnostics, so the generated docs must carry what the `.d.ts` cannot say (when to use, never when, the slot a figure goes in), and `use when` must not be empty.
- **The layout class is not touched by a skill, a hook or this run's lint.** The table is the repeated defect: all four `list-detail` cells had it cut at some round (three of them at 390 in round 1 or 2, the with-skill hook-off build at both viewports). That is the candidate for a typed frame or table behaviour, not for prose. The concept's "grow typed frames if no-skill leaves 3+ P1" trigger is met as written (5 at round 1 in the hook-off arm), but all 5 are token or lint; the only layout finding in that arm is the round-2 table clip. The frame case therefore rests on the table defect seen across all four `list-detail` cells, and should be re-run with the frames before it is built.
- **Re-run before relying on the margin.** Three runs per cell, or a second reviewer per packet, would tell whether 2 against 3 is a real gap. The harness takes both without change: `prepare`, `shot`, `packet`, `record` per round.

## Affects

- `docs/v3/concepts/skills-agent-layer.md`: section 8 row S1 gets this verdict, and decision 13's kill is applied; the owner of the concept edits it.
- Issues sk-6 to sk-10: sk-7 (the `basalt-design` references) shrinks to what survives into docs and rules; sk-9 (reviewer) and sk-4 (hook) keep the rubric and the stub as their starting point.
- S7 (`thin-skill-s7`): reads the draft skill read-only, as filed; activation outside trial conditions is untested here.
- Nothing else: no `package.json` or lockfile outside `tools/spikes/thin-skill/package.json`.
