# Wave 37 — the calibrated scoring setup

Every Wave 37 round (r0 calibration, every later round, and the expression trial v1) is scored with this setup,
unchanged. It is argo's live re-score setup (argo Waves 23–28) applied to the playground.

## Render

Build the package and the playground from `master`, then from the main checkout:

```bash
bun packages/basalt-ui/bin/basalt-ui.mjs shot /scenarios/s2-training /scenarios/s3-agents /scenarios/s4-spend /components \
  --dist apps/playground/dist --out .design-parity/w37/r<n>
bun packages/basalt-ui/bin/basalt-ui.mjs shot detect --out .design-parity/w37/r<n>
```

Boards stay in the gitignored `.design-parity/w37/` and are copied to the MacBook
(`rsync -a --relative .design-parity/w37 iumac:Downloads/basalt-design-review/`). Images never enter git.

## Score

Three fresh `basalt-design-reviewer` subagents, one per scenario (S2, S3, S4; the components page rides with S4), no
shared context, never the agent that wrote the code. Each gets:

- the round's out dir (`board.html`, `metrics.json`, `detect.json`, `png/`) filtered to its route prefix;
- the previous round's out dir for the same route, and the previous round's verdict (`rounds.md`);
- the Keel captures in `.design-parity/keel/` (look-only reference) for a side-by-side.

The argo bar, stated as rules the playground was not held to in Wave 36:

1. **Every named defect is a defect.** There is no "pass with notes": a P2 or P3 item names a defect and the component
   carries it. A component passes only with zero items. (Wave 36 passed components with P2/P3 notes; argo fails them.)
2. **Classify each defect** against the previous round: **fixed** (named before, gone), **carried** (named before,
   still there), **new** (not visible in the previous shots), **unscored** (visible in the previous shots, named only
   now).
3. **Communication and Expression are read as argo reads them:** a figure stated twice on one surface, a void left by a
   dropped visual, a visual with no axis or count, a name and its value far apart in a wide row, a chart encoding that
   does not answer the caption's question (a smoothed line for a handful of discrete monthly values against a goal),
   a 390 wrap of a unit or status word — each is a defect.
4. **Against Keel**, per scenario: `holds up` / `close` / `does not yet`, with the one category that decides it.
   Keel is a reference, not the target: a pattern Keel lacks is not a defect.
5. **Attribution:** each defect is `basalt` (a package export or default would fix it) or `playground` (the fixture's
   composition or copy).

Output per scenario: a table `| # | component | crop | defect | rubric item | severity | class | owner |`, the
component verdicts, a Keel line, and the counts (fixed / carried / new / unscored).
