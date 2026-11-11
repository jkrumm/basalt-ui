# Spike: thin skill activation outside trial conditions (S7)

S7 reads REFUTED on the frozen rule, from one cell: the `implementer` without the Agent tool activated the skill but did not run a reviewer. The cell's brief produced no reviewable page, so the refutation is mechanical and weak; cells (a), (b) and (d) need an owner session and are pending.

Harness: `bun tools/spikes/thin-skill-s7/run.ts` (one JSON object on stdout, exit 0 = the harness ran, not that the hypothesis held). Concept: `docs/v3/concepts/skills-agent-layer.md` section 8, S7, frozen. The harness runs no model and never calls `claude -p`.

## Question

Do the draft `basalt-design` skill and the reviewer fire outside trial conditions: (a) a session at the workspace root of argo's layout, (b) a session started in `apps/<app>`, (c) an `implementer` without the Agent tool, with the shadcn skill installed as a second skill? (d) Does a fresh session asked to design a page, with no `src` file read, find the question-to-form table in the launch-loaded block? Refuted if (a)-(c) skip the skill or the reviewer, or (d) misses the table.

## Method

`run.ts stage` builds the fixture in the OS temp dir: `.claude/{skills,rules}` and `AGENTS.md` at the workspace root (git repo), one app `apps/dashboard` with only a `package.json`, no consumer source, the draft skill copied read-only from `tools/spikes/thin-skill/skill/`, and a synthetic `shadcn` skill as the second skill. The `AGENTS.md` block names both skills, states "reviewer not run" as the no-Agent-tool path, and carries a five-row question-to-form table whose rows hold one sentinel token each. `fixture/BRIEF.md` is the one brief: design the Engineering overview page and write `docs/design/overview.md`, no source files.

Definitions: _skill activated_ is a `Skill` call for `basalt-design` (or a read of its `SKILL.md`). _Reviewer activated_ is a reviewer subagent run or an explicit hand-off; a stated "reviewer not run" with no hand-off is recorded `no`, because nothing was reviewed. `run.ts scan <cell> <transcript.jsonl>` counts both plus the table sentinels in a transcript; `run.ts record` writes the ledger `results/cells.json`.

Cell (c) was run by the lead as an `implementer` (tools: no Agent) in the staged workspace.

## Measurements

| Cell | Setup                               | Skill activated | Reviewer activated | Table found |
| ---- | ----------------------------------- | --------------- | ------------------ | ----------- |
| a    | session at workspace root           | not run         | not run            | n/a         |
| b    | session started in `apps/dashboard` | not run         | not run            | n/a         |
| c    | `implementer`, no Agent tool        | yes             | no                 | n/a         |
| d    | fresh session, no `src` read        | not run         | not run            | not run     |

Cell (c): called Read, Read, Skill (`basalt-design`), Read, Write; did not call `shadcn`; wrote `docs/design/overview.md` with four of the five sentinel forms (the brief has no parts-to-whole figure); stated "reviewer not run" as the block instructs, with no shot folder to hand over.

**Exact owner repro for the pending cells** (run `bun tools/spikes/thin-skill-s7/run.ts stage` first; it prints the workspace path `<ws>`):

- (a) `cd <ws> && claude`, paste `fixture/BRIEF.md` as the first message, then `/exit`.
- (b) `cd <ws>/apps/dashboard && claude`, paste `fixture/BRIEF.md` as the first message, then `/exit`.
- (d) `cd <ws> && claude` as a fresh session, read no file under `apps/`, send the text of `fixture/BRIEF.md`, then `/exit`.

Then `run.ts scan <cell> <transcript.jsonl>` and `run.ts record <cell> <yes|no> <yes|no> [table] [note]`.

**Limits.**

- A subagent resolves skills from the spawning session, not from the fixture's `.claude/skills`; (c) proves that an implementer with the Skill tool calls `basalt-design`, not that the fixture's root placement is found. That placement is exactly what (a) and (b) test.
- The brief writes a design doc, so no screen or shot existed and the reviewer had nothing to review.
- One run per cell; the implementer's tool list is its own report.

## Verdict

S7: REFUTED

By the frozen rule a run cell among (a)-(c) skipped the reviewer. Read it as weak: the skill fired, the no-Agent path was stated and not silent, and the brief gave the reviewer nothing to review. (a), (b) and (d) are `needs owner run`.

## Then

- Re-run (c) with a brief that produces a screen (and so a `shot` folder) before acting on the refutation; the remedy if it holds is routing review to the factory lane.
- The owner runs (a), (b) and (d) from the repro above and supplies the transcript summaries; no claim that rows 135 and 224 are fixed until then.
- The draft skill has no reviewer step; if S7 is re-run the skill under test should include the shipped one.

## Affects

- `docs/v3/concepts/skills-agent-layer.md` section 8 row S7 gets this verdict; the concept's owner edits it.
- Sk-6 to sk-10 stay unclaimed on 135 and 224 until S7 passes.
- Nothing outside `tools/spikes/thin-skill-s7/` and this doc.
