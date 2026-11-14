# Design review rubric

Tool-neutral. Whoever scores a `basalt-ui shot` out dir (an isolated reviewer, or a session handed the dir) scores by this file and nothing else. Judge only what the shots show: do not read the app's source to excuse a defect.

## Honesty

The review is valid only when the scorer did not write the UI. A builder that scores its own shots inline opens its output with `DEGRADED: inline review by the builder`. A DEGRADED run never closes a round and never lowers the finding counts: every verdict is `fail` and the score is 0.

## Input

A shot out dir (the `out` named by `.basalt/last-shot.json`, else the `out` in `.basalt/shots/last.json`, else `.basalt/shots`), and optionally the previous round's `last.json` (diff mode).

- `board.html` — every crop, labelled by component, scheme, viewport and state.
- `metrics.json` — per anchor: `padding`, `gap`, `radius` (px, or `"full"` for a fully rounded box), `nested`, `fontSizes`, `emptyRatio`, `small` (controls under the 24 px hit floor), `overlaps` (text boxes covering each other), `sheet`; `pages[]` (`overflowX`: px the document is wider than the viewport); `scale` (the theme's resolved spacing, radius and font-size steps) and `scaleError`; `viewports`; `shots[]` with each file's `status`.
- `png/*.png` — the crops. Each anchor has a contact sheet (`sheet`: its crop for every state × scheme × viewport, each labelled, with the status text where a crop does not exist) and each route a full-page shot (`_page`).
- `detect.json`, only if the out dir has one (`basalt-ui shot detect`): the deterministic findings for the `[measured]` items and `basalt/*` lint. Cite each at its own severity as `metrics.json <anchor>`, do not re-derive them, and map the rule to its item: `craft-N/*` → Craft N, `lint/*` → its item, Craft 4 by default.
- A layout-suite result, only if the out dir has one.

A shot with status `not-declared`, `absent` (a state not reachable at that viewport, or an anchor that declares itself missing in that state with `data-shot-absent`) or `skipped` (mobile hover and tooltip: touch has no hover, by design) is not a defect. The exception is a shot with `ignored: true`: the state crop is byte-identical to the ready crop, so the page ignored `?shot-state=<state>` and the state was never rendered; `shot detect` reports it as `craft-7/states-ignored` (P1). A hidden `rest` anchor is an `error` shot, a defect, never `absent`. A missing hover, focus or tooltip crop for an anchor that has such a target is Craft 7.

## Fail closed

- `metrics.json` missing or unreadable → the whole run is `fail`: "metrics.json unreadable". Do not score by eye instead.
- Zero anchors → the whole run is `fail`: "no anchors".
- A shot with status `error` → its component is `fail`, naming the file.
- Read every anchor's `sheet` and every `_page` shot, whatever else you open; open single crops only for detail. A component whose sheet was not read, or whose `sheet` is absent, is `unverified`.
- `scaleError` set, or `scale` absent or empty: Craft 1 is `unverified` for every component.
- A `[measured]` item whose field is missing for a component cannot be checked: it is `unverified`, and `unverified` counts as a failure. Name the missing field.

## Viewports

The declared viewports are the manifest's (`.basalt/manifest.json` `viewports`); when it declares none, `metrics.json` `viewports`. A clause marked `[mobile]` is keyed on the 390 viewport. When `mobile` is not declared (a desktop-only app) every `[mobile]` clause is `n/a`: not scored, not failed, not `unverified`, and no 390 crop is expected. Score every anchor in both schemes and in every declared viewport.

## Scoring

Score per component, then add one line per page for the page items (Communication 5). One failed item fails the component; only all-pass is a pass. Cite items as `Craft 3`, `Expression 2`.

### Craft

1. **[measured]** Every inset, gap and radius is a step in `metrics.json` `scale`; nested surfaces step by at least 3 px of radius. No `scale` → `unverified`. Never invent steps.
2. **[measured]** No more than three font sizes inside one component: `fontSizes` with more than 3 distinct values fails.
3. No empty region of 40 % or more of the component's height — **[measured]**: `emptyRatio` ≥ 0.4 fails. **[mobile]** No dense-list row wraps at 390, judged from the 390 crop. **D37, not scored:** an errored or empty chart body that keeps its loaded height with its anatomy top-aligned is the SSR-first contract, not a void defect (list it as `D37, not scored`); any other void still fails, and so does a loading skeleton much shorter than the loaded body. D37 covers chart bodies only; a list that keeps a void is scored.
4. One ring per surface, no bare hairline borders on cards, no accent on chrome: look at every crop for an accent hue on a tab underline, a selected row, a secondary button, a primary button, a card ring or a solid-filled badge. The accent sites are the primary data series, active-nav icons and active child labels, links, focus rings and the leader bar in meters; the primary action is ink-inverted and chrome (borders, inactive states, backgrounds, general icons) stays neutral. Selection state (active nav row, selected tab) never takes the accent. A status is a dot plus a word, or the value's own ink; a coloured edge stripe or rail down a card, row or callout for status fails here, and a card's `tone` dot-and-word verdict passes.
5. Nothing is told apart only by colour, judged from the crops in both schemes. Contrast ratios are not measured here: axe owns them.
6. Nothing overflows, clips or truncates a value at 1440. **[measured]** `overlaps`, `small` and a page `overflowX` above 0 fail (`craft-6/overlap`, `craft-6/hit-floor`, `craft-6/document-overflow`). **[mobile]** The same at 390.
7. Hover, focus and tooltip states are present in the shots; focus is the 2 px outline. **[measured]** An `ignored` state shot fails (`craft-7/states-ignored`).

### Expression

1. Name the data's shape and the encoding used; both must match a row of the question-to-form table in the AGENTS block.
2. Every visual answers the question its caption names; a decorative visual fails.
3. A hue appears only for a trend, a status or a category; a single metric is neutral. A delta is the tinted delta badge with its polarity and its period: a delta in untinted ink, or a delta whose tint contradicts its polarity (a rise that is bad drawn good), fails here. A status drawn as a coloured leading-edge stripe fails too: it is decoration, where the dot and the word carry the verdict in shape and text.
4. A number with a target shows the target; a number with a history shows it; a whole with parts shows the parts.
5. No axis repeats a label; ticks fit the span.

### Communication

1. No banned filler (below).
2. Every number carries its unit inline; a rate or total carries its period.
3. A number whose definition, period or source is not stated on the surface has a tooltip or a one-line explanation; a count of visible items has none.
4. Titles are precise nouns with their scope ("Ride distance, 7 days"), not categories ("Metrics").
5. **[page]** A page is not three rows of KPI cards, and not a single table when its data has one of the shapes in the question-to-form table.
6. Empty and error states say why and what to do, per `node_modules/basalt-ui/docs/empty-state.md`: an error is one "Could not load <thing>" title, the cause, one Retry, with the error dot and no empty-state glyph; a loading state is a skeleton in the loaded shape; one wording per repeated gap across cards.

### Banned filler

Fail any of these on sight, in any language the app ships:

- Narration of the UI: "Here you can see…", "This chart shows…", "Below is…", "The following…".
- Welcome and marketing tone: "Welcome to…", "at a glance", "powerful", "seamless", "insights", "unlock".
- A subtitle that restates the title, or a decorative subtitle with no number or fact in it.
- Generic titles: "Overview", "Metrics", "Data", "Stats", "Details" on their own.
- A bare "Total", "Count" or "Value" with no noun.
- "No data", "Nothing here", "N/A" (use the em dash for a missing value, and say why when a whole surface is empty).
- "Loading…" text where a skeleton belongs; "Click here"; exclamation marks; emoji in chrome.
- Units spelled out at length in a dense surface ("kilometres") where the unit symbol reads.

## Severity

P0 and P1 fail the component; P2 and P3 are noted on their line and do not.

- **P0** broken or unreadable: an `error` shot, a fail-closed run.
- **P1** a rubric item fails (including `unverified`).
- **P2** degraded but legible: a banned phrase in a secondary label.
- **P3** polish: a measured value a rounding off a step, a one-word wording slip.

The score is 100 − (25 per P0 + 10 per P1 + 3 per P2 + 1 per P3), floored at 0: the number `basalt-ui shot detect` computes. It is a reading, never a gate and never a target; the verdict is the counts.

## Diff mode

Input adds the previous round's `last.json`. A finding's key is its anchor plus its item (`<anchor>|<axis> <n>`). Compare the keys of this round with the previous:

- `new` — in this round only.
- `carried` — in both rounds.
- `fixed` — in the previous round only; listed once, with its previous severity, and never counted.

The counts and the score cover the `new` and `carried` findings. The verdict is the four severity counts plus `regression: yes` when a P1 is `new` or `carried`, else `regression: no`. Without a previous `last.json` (round 1, or a different out dir lineage) every finding is `new`. A score that fell between rounds on unchanged components is a scorer drift, not a regression: the carried and new findings are the evidence, the number is not.

## Output

Strict. Nothing before the table (but the `DEGRADED` line when it applies), no praise, no summary, no code rewrites. Name the defect, not the fix. Order every list **content** → **layout** → **style** (what the surface says, where it sits, how it looks):

- **content**: Communication 1–4 and 6, Expression 1, 2 and 4, Craft 5 (colour-only distinction).
- **layout**: Craft 1, 3, 6 and 7, Communication 5, Expression 5.
- **style**: Craft 2 and 4, Expression 3.

1. A table, one row per component: `| component | verdict | failed items |` — `pass` or `fail`; failed items like `Craft 3, Communication 1`, or `—`; an `n/a` clause is listed as `n/a` after the verdict. Add one `page` line per route for the page items. Under it, one line per component: `Read: <sheet file>, <page shot files>, <any single crops opened>`.
2. Then, for EVERY failure, one line, content first: `[<new|carried|fixed>] <P0-P3> <axis> <n> — <png file> (<scheme>, <viewport>, <state>) — <defect in one sentence>`. The bracketed status appears only in diff mode. A `[measured]` item cites `metrics.json <anchor>` instead of a PNG; an `unverified` item names the missing input.
3. In diff mode: `Counts: P0 <a>, P1 <b>, P2 <c>, P3 <d> — regression: <yes|no>`.
4. Last line: `Score: <0-100>`. A DEGRADED run scores 0.

A failure you cannot cite from a crop or from `metrics.json` is not a failure.

## Handing the result on

Write the same result as `last.json` in the shot out dir, whether or not a subagent could be spawned: the session that builds may have no way to spawn this reviewer, so the file in the out dir is how the round is known to have been reviewed (the Stop re-check names a round whose out dir has no `last.json`). Shape:

```
{ "version": 1, "round": <n from .basalt/last-shot.json, null when that file is absent>, "degraded": <bool>,
  "failedClosed": <null | "metrics.json unreadable" | "no anchors">,
  "components": [{ "name", "route", "verdict": "pass|fail", "failed": ["Craft 3"], "na": ["Craft 3 [mobile]"] }],
  "findings": [{ "anchor", "severity", "axis", "item", "status": "new|carried|fixed", "cite", "defect" }],
  "counts": { "P0", "P1", "P2", "P3" }, "regression": <bool>, "score": <0-100> }
```

An inline pass by a builder writes the same file with `"degraded": true`; it cannot close the round.
