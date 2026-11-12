# Spike: viz census (V1 seam, V2 kinds, V3 helpers, V4 devices)

The fleet draws 101 visualization modules across 8 of the 12 consumers. v3 expresses 90 of them with a shipped kind, a primitive or `CartesianChart` engine marks; the other 11 (10.9%) need `CartesianChart.custom` or have no v3 answer, and they sit in 4 repos. V1 is CONFIRMED by the repo clause, not by the share. By the rule, V2 names three forms: `bar list`, `meter` and `time-series lines`. All three already have a shipped v3 symbol (`BarList`, `Meter`, `Lines`), so none is a new kind. Five hand-written helpers recur: `scale`, `ticks`, `packing`, `measure-width` and `label-fit`. Four devices are rare where they apply: the case's own metaphor, a hero readout, direct labels and dim-the-rest focus.

Harness: `bun tools/spikes/viz-census/run.ts` (one JSON object on stdout, exit 0 means the harness ran). Two outputs are attached as `tools/spikes/viz-census/runs/run-1.json` and `run-2.json`; they are byte-identical (`cmp`). Thresholds: `docs/v3/EXPRESSION.md` § Thresholds, as the spike brief spells them out.

## Question

- **V1, seam.** What share of the fleet's visualization modules can v3 express only through `CartesianChart.custom`, or not at all? CONFIRMED at 20% or more, or with such a module in 3 or more repos. REFUTED under 10% and in under 3 repos. OPEN between.
- **V2, kinds.** Does a form have 3 or more copies in 2 or more repos whose `v3` is not `kind`? Each such form is a kind candidate under the Rule of Three. `none` means hypothesis 3 (exemplars, not kinds) holds.
- **V3, helpers.** Which hand-written geometry helpers have 3 or more copies in 2 or more repos? They are the seam's first cut.
- **V4, devices.** Which of the twelve devices of `docs/v3/evidence/ext-tuffui-devices.md` are present in under 25% of the modules where they apply? They are the skill's priorities.

## Method

Static scan by TypeScript AST (`typescript` 6.0.3, pinned in the harness `package.json`). Nothing is built, started or written in a consumer; the repos are read in place, read-only. Same scope as `docs/v3/spikes/census.md`: 12 consumers under `~/SourceRoot` (argo, rb, linewatch, shutterflow, weatherorb, finances, email-gateway, image-gateway, rollhook, basalt-ui-obsidian, jkrumm.com, `software-factory/apps/console`) plus the Epos teamchat `ui` as a 13th, reported as counts only and never added to a verdict. Same file rules (source extensions, no `.d.ts`, `*.gen.ts` or test paths, the same skipped directories, no symlinks, nothing over 1 MB). A module is one source file. Ids are the first 8 hex of `sha1(repo:path)`; no path appears in the output unless `CENSUS_NAMES=1` is set locally. rb, shutterflow, weatherorb and finances are private and appear as counts and ids only.

**Signatures (fixed in `signatures.json` before the first run, unchanged since).** A module is a candidate when any of these fires:

1. `library`: a JSX element whose root identifier is imported from a chart library (`basalt-ui/charts`, `@tanstack/charts`, `@visx/*`, `recharts`, `@mantine/charts`, chart.js, echarts, nivo, victory, uplot and others). Frames that draw no mark do not fire (`ChartCard`, `@visx/responsive`, `@visx/tooltip`).
2. `kit`: a JSX element named `BarList`, `Meter`, `Ring`, `Progress` or `MiniBars` from `basalt-ui` or any subpath, or `RingProgress`, `Progress` or `SemiCircleProgress` from `@mantine/core`.
3. `svg`: an intrinsic `<svg>` whose subtree holds a `.map`/`.flatMap`/`Array.from` callback, or a descendant with a geometry attribute (`d`, `points`, `x`, `cx`, `width`, `transform` and so on) bound to a non-literal; or a `createElementNS` call.
4. `canvas`: an intrinsic `<canvas>` or a `getContext` call.
5. `cells`: a JSX element whose `style` has a size, fill or position key (`width`, `height`, `flex*`, `background*`, `opacity`, `grid*`, `left`/`top`/`insetInlineStart`, `transform`, a `--custom-property`), or a `w`/`h`/`bg`/`flex`/`span` prop, bound to a non-literal, and either inside a `.map` callback or written as a percent template.

**Review (`review.json`).** Every candidate was read in source and either rejected with a generic reason or confirmed and classified by its most demanding visualization (a module that holds a sparkline and a meter is classified by the sparkline). The read was split over four readers working from one rubric; the lead normalised the result. `run.ts` reports a review problem for any candidate without an entry, any entry without a candidate, and any value outside the closed lists; there are none.

- `form`: free text in the first pass, then normalised to the closed list of 25 in `review.json` `forms`.
- `substrate`: `kind`, `cartesian-compose`, `hand-svg`, `hand-html`, `canvas`, `library`. Mixed modules take the most hand-written one (canvas > hand-svg > hand-html > cartesian-compose > library > kind). basalt-ui 2.x kit marks (`BarList`, `Meter`) count as `kind`.
- `v3`: the first that fits of `primitive` (`Meter` with zones, `Ring`, `Progress`, `BarList`, a `StatCard`/`StatCell` slot), `kind` (`Lines` with `stack`, `Bars`, `Sparkline`, `MiniBars`, `Heatmap`, `BandStrip`), `CartesianChart` (engine marks and seams, a two-pane recipe), `CartesianChart.custom`, `none`. Donut, DualPanel, MirroredBars and StackedArea are not v3 kinds; their 2.x uses take the migration row's target. One normalisation by the lead: v3 `Lines` and `Bars` are `CartesianChart` with fixed marks (`concepts/charts-cards-kanban.md` section 3, "Lines, Bars fix marks"), so a 2.x kind use that only adds `zones`, `refLines`, `getMarker` or a selection stays `kind`. That moved 19 modules from `CartesianChart` to `kind`, and one strip of `StatCell`s whose most demanding mark is a `Sparkline` from `primitive` to `kind`. V1 counts neither rung, so V1 is unchanged. V2 counts `CartesianChart` as "not kind", so the normalisation changes V2: before it the rule also named `stacked bars over time` (Measurements, V2).
- `helpers`: hand-written geometry in the module itself, from `scale`, `ticks`, `polar-arc`, `packing`, `measure-width`, `label-fit`, `hit-focus`, `tooltip`. A single `value / max` share is not a scale; a `tooltip` config passed to a basalt-ui chart is not a tooltip helper.
- `devices`: per device, `applicable` (the data or interaction makes it relevant) and `present` (the module or the kit component it uses shows it). basalt-ui 2.x cartesian kinds count keyboard focus with a readout as present by default.
- `lines`: non-blank lines of the module, computed by the harness.

**V2 rule as applied.** The verdict uses the brief's rule unchanged: a form with 3 or more copies in 2 or more repos whose `v3` is not `kind`. Two narrower readings were drafted after the first look at the data. Because of that they are only annotations under `v2.annotations` and never set the verdict. `exemptPrimitive` also leaves out copies a shipped primitive draws. `exemptCovered` also drops a form when one of its copies is drawn by a kind or a primitive.

**Scan limits.** The census counts what JSX and canvas calls show. Three things fall outside it and make V3 a floor, not a ceiling: a WebGL map layer that paints data fields through shaders (weatherorb) fires no signature; a visualization whose geometry lives in a sibling model file (argo's drain and night-strip formulas) has those helpers counted nowhere; and the console keeps pointer tracking, keyboard focus and its tooltip in one frame module that draws no marks, so `hit-focus` and `tooltip` miss its four charts.

**Epos** is scanned with the same signatures and reported as counts. It is not reviewed, so its numbers are signature hits.

## Measurements

Each number comes from `bun tools/spikes/viz-census/run.ts | jq '<path>'`.

**Scan and review**

| Number               | Value                                                                                                                                            | Extraction             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| Source files scanned | 2,348 in 12 repos                                                                                                                                | `jq .scan.repos`       |
| Candidates           | 140 (library 65, kit 38, cells 37, canvas 16, svg 8; a module can fire several)                                                                  | `jq .scan.bySignature` |
| Rejected             | 39: image or photo tooling 10, dev scripts, spikes and a vendored cache 8, transient operation progress 7, layout mechanics 6, other UI 8        | `jq .review.rejected`  |
| Confirmed (`total`)  | 101                                                                                                                                              | `jq .total`            |
| Review problems      | 0                                                                                                                                                | `jq .review.problems`  |
| By repo              | argo 62, linewatch 9, finances 8, console 6, shutterflow 6, weatherorb 5, rb 4, rollhook 1; email-gateway, image-gateway, obsidian, jkrumm.com 0 | `jq .byRepo`           |
| By substrate         | kind 67, hand-html 17, cartesian-compose 7, library 5, hand-svg 4, canvas 1                                                                      | `jq .bySubstrate`      |
| By v3                | kind 57, primitive 23, CartesianChart 10, CartesianChart.custom 4, none 7                                                                        | `jq .byV3`             |
| Lines                | 23,100 in total, median 161; median by v3: kind 152, primitive 165, CartesianChart 173, none 285, CartesianChart.custom 613                      | `jq .lines`            |

Every hand-drawn `<svg>` module (4) is in the console's own chart kit; v3 expresses three of them with a kind and one with `CartesianChart`. The 17 hand-HTML modules split 6 primitive, 3 kind, 3 CartesianChart and 5 none.

**V1**

| Number     | Value                                                                                                                                                        | Extraction      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| `v1.share` | 0.1089 (11 of 101)                                                                                                                                           | `jq .v1.share`  |
| `v1.repos` | 4 (argo 5, weatherorb 3, rb 2, console 1)                                                                                                                    | `jq .v1.byRepo` |
| By way     | `CartesianChart.custom` 4, `none` 7                                                                                                                          | `jq .v1.byWay`  |
| By form    | time-series lines 2, unit dots 2, scatter, multi-row time-series, interval lanes, matrix grid, small-multiple cells, colour ramp scale, geo map layer 1 each | `jq .v1.byForm` |

The share falls between the two thresholds (10% and 20%), so the repo clause decides. It holds without any one repo (3 remain) and fails without two of rb, console and weatherorb. rb's two modules are one shape (five-slot rating pips) in two files.

**V2** (`jq .v2.byForm`; "Not kind" is the rule's count, copies whose v3 is not `kind`; "Neither" also leaves out copies a primitive draws)

| Form                    | Copies | Repos | Not kind (rule) | Neither kind nor primitive | A copy drawn by a shipped symbol |
| ----------------------- | ------ | ----- | --------------- | -------------------------- | -------------------------------- |
| time-series lines       | 20     | 4     | 4 in 3          | 4 in 3                     | yes (`Lines`)                    |
| bar list                | 13     | 5     | 13 in 5         | 0                          | yes (`BarList`)                  |
| stacked bars over time  | 10     | 4     | 0               | 0                          | yes                              |
| bars over time          | 9      | 3     | 0               | 0                          | yes                              |
| sparkline               | 9      | 5     | 1 in 1          | 1 in 1                     | yes                              |
| meter                   | 7      | 3     | 7 in 3          | 0                          | yes (`Meter`)                    |
| histogram               | 4      | 2     | 1 in 1          | 1 in 1                     | yes                              |
| hour-by-day heat grid   | 3      | 2     | 0               | 0                          | yes                              |
| status timeline strip   | 3      | 2     | 0               | 0                          | yes                              |
| stacked areas over time | 3      | 2     | 0               | 0                          | yes                              |
| colour ramp scale       | 2      | 2     | 2 in 2          | 1 in 1                     | yes (one zoned `Meter`)          |
| time-axis strip         | 2      | 2     | 2 in 2          | 2 in 2                     | no                               |
| dual-pane chart         | 2      | 1     | 2 in 1          | 2 in 1                     | no                               |
| part-to-whole bar       | 2      | 1     | 2 in 1          | 0                          | yes                              |
| unit dots               | 2      | 1     | 2 in 1          | 2 in 1                     | no                               |
| 10 more forms           | 1 each | 1     |                 |                            |                                  |

`jq .v2.forms`, the verdict, is `bar list`, `meter`, `time-series lines`. What each one is:

- `bar list`, 13 copies in 5 repos, and `meter`, 7 in 3: every copy is drawn by a shipped v3 primitive (`BarList`, `Meter` with zones). They pass because the rule counts primitives as "not kind". Neither needs a new symbol.
- `time-series lines`, 4 copies in 3 repos (argo 2, linewatch 1, weatherorb 1) that the `Lines` kind cannot draw, each for a different reason: a projection with labelled jumps and placed labels, a percentile band with state rails, rotated direction glyphs, and a composition of engine marks. The form already has its kind; no two copies ask for the same addition.

`jq .v2.annotations` holds two narrower readings; neither sets the verdict. `exemptPrimitive` (copies a primitive draws also exempt) is `time-series lines`. `exemptCovered` (also dropping forms a shipped symbol already draws) is empty.

Before the `kind` normalisation (Method, `v3`), the rule named one more form, `stacked bars over time` (4 copies in 2 repos: 2.x `Bars` uses with `zones` or `refLines`), and `time-series lines` had 16 copies in 3 repos. The normalisation removed that form; it is listed here so the reader can weigh it.

**V3** (`jq .v3.byHelper`)

| Helper        | Copies | Repos | Hand-drawn modules only |
| ------------- | ------ | ----- | ----------------------- |
| scale         | 15     | 5     | 12 in 5                 |
| ticks         | 9      | 4     | 4 in 3                  |
| packing       | 7      | 2     | 2 in 2                  |
| measure-width | 4      | 4     | 4 in 4                  |
| label-fit     | 4      | 4     | 4 in 4                  |
| hit-focus     | 2      | 2     | 2 in 2                  |
| polar-arc     | 1      | 1     | 1 in 1                  |
| tooltip       | 1      | 1     | 1 in 1                  |

"Hand-drawn modules only" leaves out modules whose substrate is `kind` or `library` (`jq .v3.handDrawnOnly`: `scale`, `ticks`, `measure-width`, `label-fit`). `packing` passes on all modules only: 5 of its 7 copies are linewatch bucket folding and binning that feed a shipped kind (`BandStrip`, `Heatmap`).

**V4** (`jq .v4.byDevice`)

| Device                   | Present | Applicable | Share  |
| ------------------------ | ------- | ---------- | ------ |
| `d01-metaphor`           | 2       | 100        | 0.0200 |
| `d02-hero-readout`       | 1       | 16         | 0.0625 |
| `d10-dim-focus`          | 3       | 42         | 0.0714 |
| `d08-direct-labels`      | 13      | 56         | 0.2321 |
| `d07-pre-annotation`     | 28      | 62         | 0.4516 |
| `d05-quantized`          | 6       | 13         | 0.4615 |
| `d12-anatomy`            | 32      | 64         | 0.5000 |
| `d03-delta-baseline`     | 20      | 36         | 0.5556 |
| `d09-live-cues`          | 13      | 22         | 0.5909 |
| `d04-colour-budget`      | 68      | 101        | 0.6733 |
| `d06-threshold-geometry` | 34      | 49         | 0.6939 |
| `d11-keyboard`           | 54      | 66         | 0.8182 |

`d11-keyboard` is high because the 2.x cartesian kinds ship keyboard focus with a live readout. `d08-direct-labels` sits 1.8 points under the line; one more module with direct labels would lift it to 25%.

**Epos (counts only, unreviewed signature hits)** `jq .epos`: 590 source files, 27 candidates (cells 20, svg 11), no chart-library or kit hits.

## Verdict

V1 seam: CONFIRMED
V2 kinds: bar list, meter, time-series lines
V3 helpers: scale, ticks, packing, measure-width, label-fit
V4 devices: d01-metaphor, d02-hero-readout, d08-direct-labels, d10-dim-focus

`run.ts` prints the same four lines under `verdictLines`.

## Then

The cycle file reads these against `EXPRESSION.md` § Thresholds; this spike edits neither.

- **Hypothesis 2, seam:** its confirm column ("Census V1 is CONFIRMED") is met, by 11 modules in 4 repos at a share of 10.9%. The share alone would leave it open; read it as a seam the fleet reaches from several repos, not one most charts need.
- **Hypothesis 3, exemplars:** its kill column ("Census V2 names a form") is met by the rule. V2 names three forms.

  **kind candidate, Rule of Three:** `bar list`, `meter`, `time-series lines`.

  Read them with this caveat. `bar list` and `meter` count because the rule treats a primitive as "not kind". Every one of their copies is drawn by a shipped primitive (`BarList`, `Meter` with zones), so the candidate is already shipped. `time-series lines` has a kind, `Lines`. Its 4 extra copies in 3 repos each need a different thing from it: a projection with placed labels, a percentile band with state rails, rotated direction glyphs, and an engine-mark composition. That is seam demand (`CartesianChart.custom` with scales from the plot), not one recurring form. With primitives exempt, only `time-series lines` remains. With covered forms also dropped, nothing remains. The nearest form that no shipped symbol draws is `time-axis strip`, at 2 copies in 2 repos (a day strip with a now mark, a scrubber rail): a watch item. The owner rules on the reading. This spike reports the rule.

- **Seam's first cut (V3):** `scale`, `ticks`, `measure-width`, `label-fit`; `packing` only if binning that feeds a kind counts. The counts are a floor (Method, scan limits). `polar-arc`, `hit-focus` and `tooltip` do not recur in the fleet today, and the console's shared frame module is one more hand-written `hit-focus` and `tooltip` the count misses.
- **Skill priorities (V4):** the case's own metaphor (2 of 100), a hero readout bound to the active mark (1 of 16), dim-the-rest focus (3 of 42), direct labels (13 of 56). Device applicability is a reader's judgement; it is reproducible from `review.json`, not from the code.
- **Native cases:** n05 to n11 were appended to `docs/v3/expression/cases.md` from modules whose `v3` is `none` or `CartesianChart.custom`. The sources stay here, not in the bank, so that a builder given a case verbatim gets no path to the existing build:

| Case | Repo       | Source                                                                               | v3                    |
| ---- | ---------- | ------------------------------------------------------------------------------------ | --------------------- |
| n05  | argo       | `apps/dashboard/src/features/models/efficiency-scatter.tsx:654`                      | CartesianChart.custom |
| n06  | argo       | `apps/dashboard/src/features/usage-tracking/drain-chart.tsx:278`                     | CartesianChart.custom |
| n07  | argo       | `apps/dashboard/src/features/astro-window/components/night-strip.tsx:21`             | none                  |
| n08  | argo       | `apps/dashboard/src/features/strength-tracker/charts/alignment-matrix-chart.tsx:112` | none                  |
| n09  | console    | `software-factory/apps/console/src/components/chain/schedule.tsx:118`                | none                  |
| n10  | weatherorb | module `2bbe8560` (private)                                                          | CartesianChart.custom |
| n11  | rb         | modules `788352b0`, `06925d49` (private)                                             | none                  |

## Affects

- `docs/v3/EXPRESSION.md` § Thresholds: the cycle-1 file records V1 CONFIRMED (hypothesis 2, confirm column) and V2 naming three forms (hypothesis 3, kill column by the rule, with the caveat under Then that all three already have a shipped symbol).
- `docs/v3/ARCHITECTURE.md` § 7.3 and § 8, `charts/contract.ts`: a seam Spec (`checkpoint: spec`) takes its first cut from V3, and the `primitive-bypass` scope from it.
- `packages/basalt-ui/agent/skills/**` (`basalt-charts`, `basalt-design`): V4 names the four devices the method should teach first.
- Re-run after any change to the consumers or to `review.json`: `bun tools/spikes/viz-census/run.ts`. A new candidate shows as `unreviewed <id>` under `review.problems` until it is read and classified.
