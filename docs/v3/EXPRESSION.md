# Expression track

An agent with basalt-ui should build a visualization that fits its case on the first try. Today that takes several rounds with the owner. This track measures the gap against a fixed benchmark and closes it by changing what ships: the skills, the rules, the kit and the reviewer. It never closes it by polishing one build.

It is a cycle area under `docs/v3/CYCLES.md`, keyed `v3-cycle-expression-<n>`. This page holds what differs from the other areas.

## What the benchmark showed

The benchmark is TuffUI (`github.com/yurigdesigner/tuffui`, MIT, read at `d9c5cc3` on 2026-11-12). Its 25 visualization components are 13,303 lines, about 530 each. The code they share is about 120 lines: a frame, five motion constants and `cn`. It has no chart library, no skill and no agent rules. Digest: `docs/v3/evidence/ext-tuffui-devices.md`.

So the quality is not tooling. It is one encoding decision per case, made twelve recurring ways. basalt-ui ships the opposite bet:

| TuffUI does                                          | basalt-ui today                                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Picks a form from the case (a stopwatch for a lap)   | `basalt-charts` says pick a shipped kind, else compose `CartesianChart`                                                                     |
| Hand-computes geometry in each file                  | No public scale, polar, arc or packing helper; `CartesianChart.custom` hands out rows, not scales                                           |
| Draws marks in SVG and HTML grid                     | `primitive-bypass` is specified to deny hand SVG charts (`ARCHITECTURE.md` § 8)                                                             |
| Binds a hero number and a readout to the active mark | Tooltip exists only inside the cartesian engine                                                                                             |
| Ships each visualization as a copied file            | `./charts` has a 14-symbol ceiling and a refusal list for new kinds                                                                         |
| Scores nothing                                       | The reviewer's Expression items match a build against catalogue rows, so a form the catalogue lacks has no basis to pass or fail (2.x text) |

TuffUI is weak where basalt-ui is strong. Its scales are linear only and one chart crashes on negative samples. Hex colours bypass its tokens. It has no loading or error state, no SSR output for 14 measured charts and no tests. The target is therefore not TuffUI's code. It is TuffUI's case fit on basalt's contract.

## Hypothesis the cycles test

Three changes close most of the gap. Cycle 1 measures before any of them is built, and its findings confirm, reshape or kill each one.

1. **A method in the skill.** Question first, then form, then marks. The twelve devices become the skill's vocabulary and the reviewer's checklist. Worked exemplars replace the list of kinds as the main teaching text.
2. **A geometry seam in the kit.** Scales, polar and arc math, quantizing, label packing, measured width, and one focus-and-readout primitive for hand-drawn marks. That is rung 4 of the bending ladder (headless core plus an app composite). `primitive-bypass` then denies data-mapped SVG outside the seam instead of all of it.
3. **Exemplars as source, not kinds.** A bespoke visualization stays app code or a recipe. The Rule of Three and the symbol ceilings stand. Nothing here asks for a `LapTimer` export.

## Thresholds

Fixed before anything is measured, as in `docs/v3/spikes/`. The demand side comes from the fleet (`v3-spike-viz-census`, verdict in `docs/v3/spikes/viz-census.md`), the supply side from cycle 1.

| Hypothesis   | Confirmed when                                                                                                                                              | Killed when                                                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1, method    | `skill` findings, with the `planned` ones a skill row owns, are half or more of the points lost in round 0, and repair rounds lift the median by 15 or more | Repair rounds lift the median by under 5: the builder knew what to do and could not                                                |
| 2, seam      | Census V1 is CONFIRMED, or three of six builds hand-write an `<svg>`, or the median glue is 80 lines or more                                                | Census V1 is REFUTED and no build that scored 80 hand-wrote geometry                                                               |
| 3, exemplars | Census V2 names no form without a shipped symbol                                                                                                            | Census V2 names a form with no shipped symbol: that form is a kind candidate under the Rule of Three, and the rest stays exemplars |

A result between the two columns leaves the hypothesis open for the next cycle. The cycle file says which side each number fell on.

Row 3 was reworded on 2026-11-13, after cycle 1 and by owner decision: it used to read "Census V2 is `none`" against "Census V2 names a form", which counted forms that already ship (`BarList`, `Meter`, `Lines`). Cycle 1 keeps its verdict under the old wording; the new wording applies from cycle 2.

## Doctrine

Changes 2 and 3 touch `ARCHITECTURE.md` § 7.3 and § 8 and the frozen `charts/contract.ts`. A cycle never edits those. It files a row with `checkpoint: spec`, and the owner rules on the Spec.

## The loop

One cycle is a trial, not a build. Six steps.

1. **Pin.** Record the master sha and draw six cases from `docs/v3/expression/cases.md`: four with a reference, two native. A case runs in one cycle only.
2. **Trial.** One fresh builder subagent per case, on the default worker tier, the tier a consumer's agent runs on. It gets the case text and nothing else from this track. It may read `packages/basalt-ui/agent/**`, `packages/basalt-ui/llms.txt` and the types of the published subpaths. It may not read `docs/v3/expression/**`, `docs/v3/evidence/ext-tuffui-devices.md`, `.claude/shots/**` or any TuffUI source. It builds one playground scenario and returns. This is round 0.
3. **Shoot.** `apps/playground/scripts/shots.ts`, both viewports, both schemes.
4. **Score.** One fresh reviewer subagent per case reads the shots, the scenario source, `docs/v3/expression/rubric.md` and, for a referenced case, the reference shot named in `docs/v3/expression/references.md`. It returns the rubric scores and a verdict: `build`, `tie` or `reference`, by which answers the case's question faster.
5. **Repair rounds.** The builder gets the reviewer's findings and tries again, at most twice. Each repaired build is shot and scored as in steps 3 and 4, by a reviewer that has not seen the case. The findings carry rubric knowledge to the builder, so only round 0 counts as a first try; rounds 1 and 2 measure how far feedback gets.
6. **Diagnose and file.** Every point lost in round 0 is a finding with one class. Fix rows follow `CYCLES.md` step 6.

The builder's scenario files stay in the playground as they came out of the last round. Nobody hand-finishes them: an exemplar that an agent did not build teaches the wrong lesson about what the kit can do.

## Numbers every cycle reports

| Number               | Meaning                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| First-try score      | Rubric score of round 0, per case, with the median and the minimum                                |
| Rounds-to-pass       | The first round (0, 1 or 2) at which a case scores 80; 3 if no round does. Per case, and the mean |
| Verdicts             | Count of `build`, `tie` and `reference` over the referenced cases                                 |
| Glue lines           | Lines of geometry, measuring and focus code the scenario had to own                               |
| Escape hatches       | As in `CYCLES.md` step 3, plus every hand-written `<svg>`                                         |
| Devices used unasked | Of the rubric's devices, how many round 0 reached without a hint                                  |

Each cycle file repeats the result rows of every earlier cycle under its own, so the trend reads in one place.

## Finding classes

The class says which artifact changes. It replaces the class list of `CYCLES.md` step 5 for this area.

| Class       | The builder                                                             | Fix lands in                                                        |
| ----------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `skill`     | Did not know to do it; the kit could                                    | `packages/basalt-ui/agent/skills/**` or `agent/rules/**`            |
| `primitive` | Knew, and wrote glue because the kit could not                          | The kit, behind a Spec when it adds an export                       |
| `doctrine`  | Was stopped or steered wrong by a lint rule, a guard or a rule's text   | A `checkpoint: spec` row against `ARCHITECTURE.md`                  |
| `rubric`    | Built a defect the reviewer missed, or was marked down for a non-defect | `docs/v3/expression/rubric.md`, then the shipped reviewer           |
| `case`      | Was misled by the case text                                             | `docs/v3/expression/cases.md`                                       |
| `planned`   | Hit a gap an open plan row already owns                                 | No new row; the finding is appended to that row's brief as a `note` |
| `factory`   | Not the builder: the lead lost time to the factory itself               | `factory signal file --repo software-factory`, never a row here     |

A `skill` or `primitive` fix names at least two cases it serves, from this cycle or the bank. A fix that serves one case is a recipe at most.

## Convergence

The area converges on a cycle whose six cases had all never run, when:

- the median first-try score is 80 or more and no case is under 60;
- at least three of the four referenced cases end `build` or `tie` in round 0;
- its round-0 findings hold no P1 and at most three P2, by the severity rule in `docs/v3/expression/rubric.md`.

Until then each cycle adds `v3-cycle-expression-<n+1>` after its fix rows. Each cycle also adds two cases to the bank. A new case comes from a TuffUI component published after the last cycle, or from a page of argo, linewatch, weatherorb or the factory console that no case covers yet.

## Guards against a hollow win

- **No peeking.** Before round 0 the builder sees no reference, no rubric and no digest. What it knows about expression arrives through the shipped skill, as it would for a consumer.
- **No memorising.** Case ids are neutral (`c01`), case text names the question and the data, never a form. A case runs once.
- **No copying.** Nobody pastes TuffUI source into the package, the skill or a scenario. The digest records devices, not code.
- **No softening.** A rubric change needs a `rubric` finding with a shot that shows the reviewer was wrong.
- **No grade inflation by the author.** The agent that built a case never scores it, and the lead scores nothing.

## Gate

3.0 is the last chance to change the charts contract: consumers are held until it is published, and no major may follow it. So the structural part of this track gates 3.0, and the rest does not.

- `v3-freeze-g4` waits for cycle 1, and through it so do the teardown and `v3-ga-prep`.
- A fix row of class `primitive` or `doctrine` joins the `after` of `v3-freeze-g4`. So does the next cycle, as long as the current one has such a P1 open.
- Once a cycle reports no open `primitive` or `doctrine` P1, later cycles leave the freeze alone. Skill, rubric and case findings ship in minors, and convergence may come after GA.
