# Design-parity spec — expression through data (Part 3)

Ground truth for Waves 31–41 of `docs/waves/PLAN.md` Part 3. Written in Wave 30 from the two-way
[AUDIT.md](AUDIT.md), the measured [BENCHMARK.md](BENCHMARK.md), the fleet survey (§ 10) and the research in
§ 9. **The bar is basalt's own rubric (§ 8).** The reference is evidence for where that bar sits, never the
target: nothing here is built to look like it, and its code, styles, markup, assets and copy never enter
basalt. A reference value is adopted only where it beats basalt's current value on the rubric, and every
adoption and refusal is recorded in § 12.

**Precedence.** This file sits outside the `docs/*.md` spec-prose budget on purpose. Until Wave 39 folds the
settled law into `docs/DESIGN-CORE.md`, this file wins over DESIGN-CORE and `docs/V2-SPEC.md` **only** where
§ 11 names the change; everywhere else those two bind.

**Status of each decision.** Values marked _target_ are what the first round renders; a pattern wave may
move a target after a scored round, and records the move and its reason in its **Left behind** and in § 12.
Values marked _hold_ do not move without an owner decision.

**Paths.** `src/…` is `packages/basalt-ui/src/…`; `scripts/…` is `packages/basalt-ui/scripts/…`.

## 1. The two causes and the method

basalt-built screens fall back to a card with a big number, a line chart and a plain table. Two causes:

- **Flexibility gap:** basalt cannot express the better encoding. The audit finds few: a meter (bounded
  ratio, target, segments), a ranked bar list, a joined stat strip, table cell kinds, an event list and a
  board.
- **Guidance gap:** basalt can express it and nothing leads an agent there. This is the larger gap. A
  `StatCard` with no `sparkline` is the default; nothing asks "what shape is this data?" before a card is
  chosen.

Every pattern family is built by the same procedure, which Wave 31 ships as the `basalt-design` skill
procedure and dogfoods here:

1. **Scenario first** (§ 2): realistic data, the user's question and the decision the view supports, written
   before anything renders.
2. **Pick the encoding from the catalogue** (§ 3) by the data's shape, not by the component nearest to hand.
3. **At least three rounds** of render (`basalt-ui shot`) → board → score (§ 8, a fresh scorer) → revise.
   Every board stays local in `.design-parity/w<n>/`; the scored verdict and notes are committed under
   `docs/waves/design-parity/w<n>/`.
4. **Done** when the rubric passes on every item, not when the rounds run out. A pattern that has not passed
   after five rounds goes to the owner with its boards and the failing items.

## 2. Scenarios

Each is one fixture under a single dynamic playground route, `apps/playground/src/routes/scenarios.$name.tsx`
(one route file: the playground route budget is 14 of 15). The data is fixture data shaped like the fleet app
it stands for; no real user data. Each fixture is built by the wave that first scores on it.

| #   | Scenario           | Stands for                             | The user's question                                  | The decision it supports          | Patterns exercised                                                                                                                            | Built in |
| --- | ------------------ | -------------------------------------- | ---------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1  | Ops monitor        | linewatch                              | Is the line healthy now, and when did it last break? | Call the ISP or not               | metric card (trend), meter against a ceiling, status over time, distribution, table (outages), event list (transitions)                       | 32       |
| S2  | Training log       | argo strength-tracker, walking-pad     | Am I on track for this month's goal?                 | Train today or rest               | metric card (trend), meter to target, ranked list (records), entity card with a stat strip (exercise), table (sessions), form (log a workout) | 34       |
| S3  | Agent work         | argo warden, agents                    | What needs me, and what is stuck?                    | Approve, reassign or leave it     | decision card, board, event list (item timeline), status chip                                                                                 | 35       |
| S4  | Spend and usage    | argo usage-tracking                    | Am I within budget, and what is driving it?          | Cut a project or raise the budget | metric card (daily spend trend), meter with forecast, part of a whole, ranked list, distribution                                              | 31       |
| S5  | Learning record    | rb knot detail, journal                | Where am I with this topic?                          | Review it now or later            | record header, stat strip, event list grouped by day, aside, page summary                                                                     | 37       |
| S6  | Settings and entry | shutterflow account, argo workout form | Change one thing without breaking another            | Save or cancel                    | forms, sections, every state                                                                                                                  | 39       |

A fixture grows as its patterns land: each pattern wave extends the fixtures it scores on, and a round scores
only the patterns that exist by then. Every scenario renders the empty, loading and error states of each
pattern it uses (toggled from the page),
at desktop 1440 and mobile 390, in both schemes.

## 3. Data-to-expression catalogue

The core of the spec. Read it by the **shape of the data**, then take the encoding. "Default" is what a
basalt agent reaches for today.

| Data shape                                                                   | Best encoding                                                                                                                                                     | Why it beats the default                                                                                         | basalt today                                                              | Gap                                                                                           | Home                                                                             |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Single value with a trend                                                    | Figure, text delta, axis-less sparkline with an end dot along the card's bottom edge                                                                              | The history says whether the number is normal; the end dot ties the line to the figure                           | `StatCard` + `sparkline` slot + `Sparkline` (`emphasizeLast` opt-in)      | guidance (the slot is optional and the default leaves it empty), chrome (stroke, end dot off) | `StatCard`; recipe                                                               |
| Progress to a target (one bounded ratio)                                     | Linear meter: filled track, target tick, value and target as end captions                                                                                         | Length on a shared track is read more precisely than an angle or two numbers; the target is visible, not stated  | Mantine `Progress` hand-rolled in argo and rb                             | flexibility                                                                                   | **`Meter`** (new)                                                                |
| Progress with a committed/forecast split                                     | Meter with two segments, the forecast lighter, a tick at their boundary and a caption naming it, plus a target tick                                               | One strip carries three numbers; the caption and tick keep it readable without colour                            | none                                                                      | flexibility                                                                                   | `Meter` `segments`                                                               |
| A single headline ratio where the shape is the message (a score, a hit rate) | Ring meter, value centred, at most one per card row                                                                                                               | Reads before the number; earns its space only as the card's hero                                                 | Mantine `RingProgress` hand-rolled (argo timer, weatherorb score)         | flexibility                                                                                   | `Meter` `shape="ring"`                                                           |
| Part of a whole, 2–6 parts                                                   | One segmented bar with the parts in order and captions under the segments                                                                                         | Replaces a row of N count tiles or a donut plus a total card; compares the parts and shows the total in one line | `Donut`; rows of `StatCard`s                                              | guidance (donut and tiles chosen by default), flexibility (no bar)                            | `Meter` `segments`; `Donut` only when the parts are the page's subject           |
| Ranked list, top N                                                           | Rows of label, inline bar on a shared scale, right-aligned value                                                                                                  | The bar ranks by length before anything is read; a table with a share column has to be read                      | Tables with a `%` column; hand-rolled bar lists (shutterflow, weatherorb) | flexibility                                                                                   | **`BarList`** (new)                                                              |
| Distribution                                                                 | Small histogram (`Bars`, axis-less in a card)                                                                                                                     | Shows skew and outliers that a mean hides                                                                        | `Bars`; rb hand-rolls a swatch-and-count list                             | guidance                                                                                      | recipe (`Bars` in a card)                                                        |
| Status over time                                                             | Band strip (`BandStrip`); a calendar heat grid for daily data over months                                                                                         | Every period visible at once; gaps and runs are the reading                                                      | `BandStrip`; `Heatmap` has no month labels                                | flexibility (calendar layout)                                                                 | `BandStrip`; calendar deferred (§ 4)                                             |
| Bounded score inside a row (0–10, health)                                    | Tick meter, ten segments, beside the number                                                                                                                       | A gauge that fits in a line of text or a table cell                                                              | none                                                                      | flexibility                                                                                   | **not available**: no consumer yet (§ 4, D10)                                    |
| A set of KPIs about one record                                               | Joined stat strip: one surface, cells divided by 1 px gaps, each cell its own encoding                                                                            | Reads as one instrument; N separate cards read as N unrelated tiles                                              | `StatGroup` (separate cards)                                              | flexibility (no joined mode), guidance                                                        | `StatGroup` `variant="strip"`                                                    |
| Event sequence                                                               | Event list: day groups, actor and sentence on line one, mono time pinned right, an optional chip row, an optional rail                                            | Time at the edge keeps the sentence column clean; day groups give the rhythm                                     | Mantine `Timeline` (a stepper idiom); hand-rolled in argo, rb, linewatch  | flexibility                                                                                   | **`EventList`** (new)                                                            |
| Work items by status                                                         | Board: columns with count and totals, compact cards, keyboard navigation                                                                                          | Load per stage is visible; stacked per-stage tables hide it                                                      | argo draws its stages as stacked tables                                   | flexibility                                                                                   | **`Board`** (new, no drag in v1)                                                 |
| An entity with facts                                                         | Record header (avatar tile, title, badges, one mono facts line, actions) + joined stat strip + event list + aside                                                 | The page answers "what is this and how is it doing" above the fold                                               | `PageBar`, `PageAside`; rb and argo hand-roll the rest                    | guidance                                                                                      | recipe                                                                           |
| A request that needs a decision                                              | Decision card: question as the headline, facts line, an inset evidence panel (one chart or excerpt), one primary, one secondary, one quiet action, keyboard hints | The evidence sits beside the ask; the user decides without opening the record                                    | argo `QueueCard`, rb `ReviewQueueCard`                                    | guidance (+ an inset-panel surface)                                                           | recipe; promoted to a component only if argo and rb converge on one anatomy (D4) |
| Record facts in a table row                                                  | Cell kinds: entity (avatar + name, no wrap), status chip, mono right-aligned figure (table face: Wave 37), relative time, inline meter                            | Every column scannable by shape, not only by reading                                                             | text cells                                                                | flexibility                                                                                   | `BasaltDataTable` column `meta.kind`                                             |
| A list of references in a side panel                                         | List rows: leading glyph, title, one meta line, trailing affordance                                                                                               | Even rhythm; the meta line carries the facts                                                                     | obsidian and argo hand-roll rows                                          | guidance                                                                                      | recipe + tokens; a component only if obsidian adopts it                          |
| A page's state in one sentence                                               | Headline plus a summary sentence that carries live numbers                                                                                                        | Says what the page says; replaces decorative subtitles                                                           | `PageBar` (chrome only)                                                   | guidance                                                                                      | recipe; the sentence must contain at least one live number or it is cut          |

## 4. Homes

A new export names its first fleet consumer on 2.x (adopt-or-delete; shutterflow is on 1.40.3 and counts only
after its migration). Every budget in `scripts/check-budgets.ts` is gated at its landed value (the file is the
source of the numbers). Each PR raises a ceiling by exactly its own count, says so in the PR,
and names every new symbol's consumer in `scripts/consumers.json`. The charter's "fewer public symbols than
1.41" holds with room: 1.41 had 395 value symbols, 2.x has 117, and this track adds at most 6 (plus types).

| Pattern                                                                           | Home                                                                                                   | First consumers (2.x)                                                                                               | Wave                                    |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Spacing grid, inset, radius, type roles, dense tier                               | tokens and derive constants (no export)                                                                | every consumer                                                                                                      | 32                                      |
| Metric card anatomy (caption row, qualifier, text delta) and chart-in-card chrome | `StatCard`, `DeltaBadge`, `Sparkline` defaults (no new export)                                         | argo, linewatch, rb                                                                                                 | 33                                      |
| `Meter` (bar, segments, target, ring)                                             | `basalt-ui` root (`src/dashboard`), HTML/CSS plus one SVG ring, tokens only; **not a chart kind** (D2) | argo (reading, warden budget, cache hit), rb (course, ingest), linewatch (link against ceiling), weatherorb (score) | 34                                      |
| `BarList`                                                                         | `basalt-ui` root (`src/dashboard`), **not a chart kind** (D2)                                          | argo (top projects), weatherorb (factor bars)                                                                       | 34                                      |
| Joined stat strip                                                                 | `StatGroup` `variant="strip"`                                                                          | argo body-composition, linewatch stat strip                                                                         | 35                                      |
| Card recipes: distribution, entity card, decision card, page summary              | `basalt-design`                                                                                        | argo, rb                                                                                                            | 35                                      |
| Table cell kinds, responsive behaviour, dense toolbar                             | `BasaltDataTable`                                                                                      | argo (9 tables), linewatch (2 Mantine tables)                                                                       | 36                                      |
| `EventList`                                                                       | `basalt-ui` root; virtualisation through one shared lazy seam (D11)                                    | argo (warden item timeline, narratives), rb (journal, session history), linewatch (transitions)                     | 37                                      |
| `Board`                                                                           | `basalt-ui` root (D12)                                                                                 | argo warden                                                                                                         | 38                                      |
| Record page, list rows                                                            | recipes in `basalt-design`                                                                             | rb, argo, obsidian                                                                                                  | 38                                      |
| Calendar heat grid (`Heatmap` `layout="calendar"`)                                | deferred                                                                                               | shutterflow, once on 2.x                                                                                            | shutterflow's migration                 |
| Tick meter                                                                        | none                                                                                                   | none                                                                                                                | not built (D10)                         |
| Schedule / agenda list                                                            | none                                                                                                   | none (argo uses `@mantine/schedule`)                                                                                | not built (D10)                         |
| Deal and pipeline cards                                                           | none (domain); a `Board` card is a slot                                                                | none                                                                                                                | not built (D10)                         |
| Drag and drop on `Board`                                                          | none in v1                                                                                             | none (warden items move by agent action, not by hand)                                                               | not built (D3); library chosen in § 9.2 |

## 5. Scales

Every change goes through the derive config and the constants in `src/tokens/` (never a hand-edited hex).
Density, radius and font knobs keep their contracts: level 0 is the new verbatim baseline.

| Scale                     | Now                                                                                                                                            | Decision                                                                                                                                                                                          | Status | Why                                                                                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Spacing grid              | Generic scale 11/13/18/20/26 (`src/tokens/palette.ts:342-346`), off any grid; `inline-spacing` guard steps the same (`src/guard/index.ts:827`) | Even-pixel steps 2/4/6/8/10/12/14/16/20/24/32; the Mantine scale becomes xs 8, sm 12, md 16, lg 20, xl 24; the guard's default steps follow                                                       | target | Off-grid steps are why no basalt rung equals a measured inset. Wave 32 diffs every `SPACE_SCALE` call site at level 0 and keeps the grid only if the boards pass.                                      |
| Card inset                | 11 vertical, 13 horizontal (`src/tokens/palette.ts:779,782`); horizontal steps to xs (11) below `sm`                                           | 12 vertical (`sm`), 16 horizontal (`md`); horizontal steps to 12 (`sm`) in a compact container                                                                                                    | target | Measured reference 12/16. This **changes** DESIGN-CORE's "card interior padding is `xs`/`sm`, not the Mantine-default `md`" (§ 11).                                                                    |
| Gap between sibling cards | 12                                                                                                                                             | 12; 1 px inside a joined strip                                                                                                                                                                    | hold   | Already on the grid.                                                                                                                                                                                   |
| Page gutter               | 16 desktop, 8 compact (`src/tokens/palette.ts:661,670`)                                                                                        | 24 at the expanded size class only; 16 medium, 8 compact unchanged                                                                                                                                | target | 16 was chosen deliberately down from 20 ("pushed away from the seam"); the trial is at expanded only, where the reference's 24 measures, and Wave 32 reverts it if the seam reads detached again (D7). |
| Radius                    | card 7, control 6, floating card + 1 = 8 (`src/tokens/palette.ts:197-202`)                                                                     | card 10, control 6, floating card + 1 = 11, inset panel = control (6); the radius knob still shifts all                                                                                           | target | A 1 px card-to-control step makes nested surfaces look accidental; 10 keeps basalt tighter than the reference's 12.                                                                                    |
| Row text                  | `md` 15 for nav rows, menu items, timeline (`src/tokens/core.ts:133`)                                                                          | Dense rows (table cells, nav, list and event rows, menu items) take `sm`, retuned 13.5 → 13 with a 20 px line; `md` 15 stays body for prose and form labels; inputs keep 16 under coarse pointers | target | 15 px rows are what wraps dense rows on compact.                                                                                                                                                       |
| Meta                      | `xs` 12.5                                                                                                                                      | 12 with a 16 px line                                                                                                                                                                              | target | Grid-aligned line boxes.                                                                                                                                                                               |
| Caption                   | `micro` 11 mono uppercase                                                                                                                      | 11 mono uppercase, +0.06em, faint                                                                                                                                                                 | hold   | The reference's 10.5 is below basalt's floor for UI copy; `nano` 10 stays for drawn labels only.                                                                                                       |
| Hero figure               | `kpi` 24, proportional sans 500, lining, −0.02em (D33; `src/dashboard/widget-header.module.css`)                                               | 22, proportional sans 500, lining, −0.02em                                                                                                                                                        | target | 24/600 plus a filled pill is what makes cards shout. Sans per D33.                                                                                                                                     |
| Page headline             | none: basalt has no page-headline role; the nearest is the article-density prose `h1` 26 (`src/tokens/core.ts:138`)                            | the page-summary recipe (§ 6.9) uses `h1` 26 with −0.02em                                                                                                                                         | target | A content headline is a recipe, not a new token.                                                                                                                                                       |
| Controls                  | `ctl` 32; 44 under coarse pointers                                                                                                             | 32 default (hold); a **dense** 28 tier for table toolbars and filter rows at fine pointers only                                                                                                   | target | 32 wraps the toolbar; the pointer tier still lifts every control to 44 on touch (D6). Internal token, no export.                                                                                       |
| Nav row                   | about 32                                                                                                                                       | 32                                                                                                                                                                                                | hold   | Carries badges; the reference's 28 is not worth breaking the pointer floor.                                                                                                                            |
| Aside                     | 300 (`src/tokens/palette.ts:644`)                                                                                                              | 300–360 by container; Wave 38 decides on S5                                                                                                                                                       | target | The reference's 380 is measured on a 1440 viewport only.                                                                                                                                               |

Wave 32 re-baselines, in the same PR: `src/tokens/density.test.ts`, `src/theme/spacing.test.ts`,
`src/theme/radius.test.ts`, `src/theme/density-relations.test.ts`, the guard's `DEFAULT_SPACING_STEPS`, every shipped
rule that states a value, and a MIGRATING entry with the old → new table and the knob that restores the old
feel (`density`, `radius`).

## 6. Anatomy, per family

### 6.1 Metric card (`StatCard`)

| Part                             | Spec                                                                                                                                              | Existing prop                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Caption row                      | label in mono uppercase `micro`, faint; an optional info glyph                                                                                    | `title` (restyled), `info`          |
| Qualifier                        | right-aligned on the caption row: period, target or source, `micro` muted                                                                         | **new** `qualifier`                 |
| Icon                             | optional, off in the recipe                                                                                                                       | `icon` (kept)                       |
| Value row                        | figure (§ 5 hero), unit inline in `sm` muted on the same baseline, delta after the unit                                                           | `value`, `unit`                     |
| Delta                            | glyph and signed figure in the trend colour as **text**, no fill (DESIGN-CORE: "up/down deltas are text colour only, never a fill"); period muted | `delta`, `deltaPeriod`              |
| Visual                           | one encoding from § 3 along the bottom edge or beside the value                                                                                   | `sparkline`, `sparklinePlacement`   |
| Footer                           | one muted `sm` line under the visual: a source or "as of", never a restatement of the caption                                                     | `subtitle` (moves under the visual) |
| Verdict, breakdown, query branch | verdict: a status dot plus a word on the caption row (owner, 2026-10-17); breakdown and query branch unchanged                                    | `tone`, `breakdown`, `query`        |

Three sizes only: `micro` (caption, qualifier, delta period), `sm` (unit, delta, footer), hero. `ChartCard`
keeps its head-font title: it titles a chart, not a figure (D8). A card with no visual is allowed
only when the number has no history, target or parts; the reviewer fails a card whose lower 40 % is empty.

### 6.2 Chart in a card

- Axis-less, grid-less sparklines; one reference line with a short mono label where a target exists.
- The `StatCard` sparkline slot is 26 px today (`src/dashboard/stat-card.module.css:140`), target 22; 24 in a
  strip cell. `Sparkline` owns the stroke (1.5) and the end dot.
- `Sparkline` defaults flip: `emphasizeLast` → `true`, `emphasisColor` → `VX.line` (the line's own neutral, so
  a single metric stays neutral, DESIGN-CORE principle 2). A consumer passes a status or trend colour
  explicitly. MIGRATING records the flip and the opt-out.
- Soft single-hue area on trend lines; none on meters.
- Not a sparkline concern but landed in the same wave: the **date-axis tick formatter** of `CartesianChart`
  (and so `Lines`, `Bars`, `StackedArea`) is span-aware and never repeats a label; an hourly 48 h axis shows
  hours with the day marked at the boundary, never `17.10, 17.10, 18.10` (ledger row 137, with weatherorb's
  zoned ticks).

### 6.3 `Meter`

- One track (neutral fill), one or more segments in order, an optional target tick, optional end captions in
  `micro` mono.
- **Colour:** a single bar is neutral (`VX.line`); a consumer passes a status colour only for a verdict
  (over budget, below target). Committed/forecast: the same neutral at two strengths, **plus** a tick at the
  boundary and a caption naming the forecast, so it is never colour-only. Categorical parts use the
  consumer's series colours. Flat fills, no hatching.
- Shapes: `bar` (default; height 6, radius `fine`), `ring` (one per card, value centred).
- `role="meter"` with `aria-valuenow`/`min`/`max` and a required text label; segments are listed in an
  `aria-describedby` text.
- **Forms (Wave 34, D29):** `bar` takes exactly one of a `value`, `segments`, or a `value` with `zones`; `ring`
  takes a `value` only. Categorical segments caption each part under the track (swatch, name, value).
- **Zones (Wave 34, D30):** a zoned bar draws its zones as bands with the reading as a marker; the zone names sit
  on the band (the holding one in ink and a weight step) and wrap to a list in zone order when they would
  collide; the reading is anchored at the marker.
- **In a `StatCard` (D31):** a Meter in the visual (`sparkline`) slot sizes to its content and keeps the card
  inset; no new prop.

### 6.4 `BarList`

- Rows: label (truncates, full text in a `title`), bar on one shared scale behind the label, right-aligned
  proportional-sans value, optional secondary value muted. Bars neutral; the leader row may take the accent (DESIGN-CORE: "the
  leader bar in meters").
- 5–10 rows; past 10 it is a table with an inline `meter` cell.
- A list with an accessible name; each row's value is text, never only a bar length.
- The bar lives in the label column; value and secondary sit outside the track, so a full-scale bar ends
  before its value (Wave 34, D32). A fixed `max` makes it a contributor list on a bounded scale (argo's
  recovery contributors), sorted high to low.

### 6.5 Joined stat strip (`StatGroup variant="strip"`)

- One surface, cells divided by 1 px gaps over a faint fill, each cell: caption row, then a figure or an
  encoding. An optional full-width footer row (a next step) below.
- Compact container: two columns; never four squeezed cells.

### 6.6 Tables (`BasaltDataTable`)

- Header: keep micro mono uppercase; drop the filled band so the header shares the body fill, divided by the
  hairline; the sorted column is brighter with its arrow.
- Rows: 40 (hold). Cell text `sm` (§ 5).
- **Cell kinds** via `meta.kind`: `entity` (avatar or glyph + name, never wraps), `status` (status chip,
  § 6.10), `number` and `money` (mono, right-aligned, unit in the header), `relative-time` (mono muted, full date
  in a tooltip), `meter` (§ 6.3 inline), `text`.
- **Responsive** (§ 9.1): fold by `meta.priority` (exists) → at compact the first column pins (opaque
  background) and the rest scroll horizontally in a keyboard-reachable container → `renderCard` only for
  non-comparable rows. A folded column stays reachable and `aria-colcount`/`aria-colindex` stay correct.
- **Toolbar:** one row at the dense 28 tier; filter chips show a muted label and a bright value; secondary
  controls right-aligned; wraps only below the compact container.

### 6.7 `EventList`

- Day group labels (`micro` mono). A row: leading avatar or glyph, actor (500) and sentence on line one, mono
  time pinned right, optional muted body, optional chip row. Optional rail.
- Two densities: `feed` (two lines, about 52) and `timeline` (rail, body, chips).
- Virtualised above about 200 rows (§ 9.3); below that it renders plainly.

### 6.8 `Board`

- Columns: header with a status glyph, title, count and right-aligned totals; cards stack with a 6 gap; each
  column scrolls alone. Card: caption line (actor, type), title, a linked record, a status line, an optional
  meter or preview slot.
- Keyboard: arrow keys move between cards and columns (roving focus), Enter opens. Compact: one column at a
  time with a `SegmentedControl` switcher, never a four-wide horizontal scroll.

### 6.9 Recipes

- **Record page:** record header (avatar tile, title, up to two badges, one mono facts line, actions right) →
  joined stat strip → main column (a pending decision card, then the event list) → `PageAside`.
- **Decision card:** question as the headline (`md` 500), facts line (`xs` muted), inset evidence panel (the existing
  inset `surface.field`, `src/tokens/core.ts:272`, radius = control; a new token only if a round fails it), action row (one primary, one secondary, one quiet) with key hints.
- **Entity card:** header (avatar, name, status), a 2×2 joined strip, one status line.
- **Page summary:** headline plus one sentence with at least one live number; no sentence without a number.
- **List row:** leading glyph, title, one meta line, trailing affordance; inset 6 × 8, radius control.

### 6.10 Status chip

Mantine `Badge` defaults to the `light` variant (status tint) instead of `filled`; 20 high, radius `tight`; an
optional leading glyph that encodes the state by shape as well as colour. `filled` stays available for a count
on an accent surface.

### 6.11 Empty, loading, error

- **Empty** (`EmptyState`): inside the surface it replaces (a ring-edged tile in a section), title at `md` 500,
  not larger than its neighbours; one or two muted lines that say why it is empty and what to do; one action.
- **Loading:** a skeleton with the pattern's shape (column-shaped table rows exist; `StatCard` gets one, so
  argo's five hand-rolled hero skeletons go away). No spinner inside a card.
- **Error:** the `QueryState` branch at the pattern's tier, one sentence and a retry.

### 6.12 Chrome leaks to close

The subtle `Button` label takes neutral ink, not the accent. So do `light` and `outline` Buttons (and
`ActionIcon`s) with no `color`: only the filled primary and an explicit `color=` carry the accent (D27).
The active `Tabs` underline takes ink, not the accent: today it deliberately keeps `--tabs-color`
(`src/theme/index.ts:1117-1120`), which contradicts DESIGN-CORE § Accent discipline ("never spend it on …
selected tab"). The active nav **icon** keeps the accent: DESIGN-CORE lists "active-nav icons" as an
accent site and forbids only the row fill. Both closed leaks are global theme changes: in-wave they are
re-shot on the playground; each consumer's before/after is taken when it upgrades (Waves 40–41).

Wave 35 closes four more: Button inline padding maps to `--vx-space-stack-*` steps (no 14 px / 7 px; `ctl`
keeps 10); a hovered `Tab` is the ink-5 % step in both schemes (dark was identical to rest); the selected nav
row is an ink 10 % fill, never the accent (the accent stays on the icon); the error placeholder (`ErrorState` and `ChartCard`) is a status dot,
the title, the message and a retry on the neutral surface, not a tinted `Alert`.

### 6.13 Forms

- `FormRow`: label left at the expanded container, above below it (exists); description `xs` muted under the
  label; error under the field in the bad status colour with its icon, one sentence.
- Field height 32 (hold); inputs keep 16 px text under coarse pointers (iOS).
- Section rhythm: 24 between sections, 12 between rows, the section title at `sm` 500, not a card per field.
- Actions: one primary, right-aligned, sticky at the bottom of a long form on compact.

Wave 39 rounds on S6 decide the numbers; the reference has no form to measure.

## 7. States and responsive behaviour

Each pattern wave builds and shoots its own pattern's empty, loading and error states; Wave 39 aligns
them on the shared `EmptyState` anatomy and re-scores all of them. Every pattern is shot (§ 1) in: rest, hover (fine pointer), keyboard focus, the tooltip open where it has one,
empty, loading and error; desktop 1440 and mobile 390; light and dark. Responsive behaviour reads the container
class, never the viewport (DESIGN-CORE § three axes), except shell chrome.

| Pattern        | Compact container                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Metric card    | Figure shrinks by container query (exists); the visual stays; the qualifier drops under the caption if it would truncate                                                  |
| Stat strip     | Two columns                                                                                                                                                               |
| Meter, BarList | Full width; captions stay                                                                                                                                                 |
| Table          | Fold, then pin-and-scroll; `renderCard` only where opted in                                                                                                               |
| EventList      | Time moves under the actor line at the narrowest step; chips wrap                                                                                                         |
| Board          | One column at a time with a column switcher                                                                                                                               |
| Record page    | `PageAside` keeps its own law: beside the main column when expanded, in flow where the page placed it below `sm`, or in the `FilterSheet` when `PageBar` has a second row |

## 8. The rubric

Scored **per component**, then per page. A fresh agent that did not write the code scores the board and must
cite the crop (file, scheme, viewport, state) and the defect for every failed item. One failed item fails the
component. Only a pass merges. Items marked **[measured]** are not judged by eye: the scorer reads the metrics
file `basalt-ui shot` writes beside the board (computed insets, gaps, radii, font sizes and contrast per
anchor) and the layout suite's result.

### 8.1 Craft

1. **[measured]** Every inset, gap and radius is a § 5 step; nested surfaces step by at least 3 px of radius.
2. **[measured]** No more than three font sizes inside one component.
3. No component has an empty region of 40 % or more of its height; no dense-list row wraps at 390.
4. One ring per surface, no bare hairline borders on cards, no accent on chrome (§ 6.12).
5. **[measured]** Text and meaningful marks meet contrast in both schemes; nothing is told apart only by
   colour.
6. Nothing overflows, clips or truncates a value at 1440 or 390.
7. Hover, focus and tooltip states are present in the shots; focus is the 2 px outline.

### 8.2 Expression

1. The scorer names the data's shape from § 3 and the encoding used; they match the catalogue row.
2. Every visual answers the question its caption names; a decorative visual fails.
3. A hue appears only for a trend, a status or a category; a single metric is neutral.
4. A number with a target shows the target; a number with a history shows it; a whole with parts shows the
   parts.
5. No axis repeats a label; ticks fit the span.

### 8.3 Communication

1. No banned filler (§ 8.4).
2. Every number carries its unit inline; a rate or total carries its period.
3. A number whose definition, period or source is not stated on the surface has a tooltip or a one-line
   explanation; a count of visible items has none.
4. Titles are precise nouns with their scope ("Ride distance, 7 days"), not categories ("Metrics").
5. A page is not three rows of KPI cards, and not a single table when its data has one of the § 3 shapes.
6. Empty and error states say why and what to do.

### 8.4 Banned filler

The reviewer fails any of these on sight, in any language the app ships:

- Narration of the UI: "Here you can see…", "This chart shows…", "Below is…", "The following…".
- Welcome and marketing tone: "Welcome to…", "at a glance", "powerful", "seamless", "insights", "unlock".
- A subtitle that restates the title, or a decorative subtitle with no number or fact in it.
- Generic titles: "Overview", "Metrics", "Data", "Stats", "Details" on their own.
- A bare "Total", "Count" or "Value" with no noun.
- "No data", "Nothing here", "N/A" (use the em dash for a missing value, and say why when a whole surface is
  empty).
- "Loading…" text where a skeleton belongs; "Click here"; exclamation marks; emoji in chrome.
- Units spelled out at length in a dense surface ("kilometres") where the unit symbol reads.

### 8.5 Calibrating the scorer

Before a pattern wave relies on the shipped reviewer, Wave 31 seeds known-bad boards (a delta on a fill, an
empty lower half, a repeated axis label, an accent tab underline, a banned subtitle) that it must fail with the
right citation, and a known-good board it must pass. A reviewer that misses a seeded defect is fixed before it
gates anything.

## 9. Research (2026-10-16, `/research`)

### 9.1 Responsive tables

TanStack Table ships column visibility and column pinning state and renders nothing; width-driven folding and
sticky pinning are the consumer's CSS. Primer recommends column-width options, removing less important columns
and horizontal scroll; mantine-react-table favours horizontal scroll; none of the surveyed systems recommends
card collapse. WCAG 1.4.10 exempts data tables from reflow if the scroll container is keyboard-reachable; a
column folded out of view must stay reachable (failure F102) with `aria-colcount`/`aria-colindex` correct.
**Decision:** keep basalt's `meta.priority` fold, add pin-and-scroll at compact as the default end state, keep
`renderCard` opt-in for non-comparable rows. Sticky pinned cells need opaque backgrounds and a `minSize`
(TanStack issue 5392). basalt is on `@tanstack/react-table` 9.2.8 with the pinning state wired
(`src/table/data-table-state.ts:133`); the research could read only the v8 docs, so Wave 36 checks each API
against the installed v9 source.

### 9.2 Drag and drop (for when `Board` needs it)

Classic `@dnd-kit/core` is frozen since 2024-12 and labelled legacy. `@dnd-kit/react` 0.5.1 (2026-10-15) is
pre-1.0, has accessibility on by default and a TanStack Virtual example, but has an open React 19 StrictMode
issue (2116) and no React Compiler statement. `@atlaskit/pragmatic-drag-and-drop` 4.0.0 (2026-09-24) is
framework-agnostic with no React peer, small, has a TanStack Virtual example, and its React packages opt into
React Compiler gating; keyboard and announcements are the integrator's job. `@hello-pangea/dnd` has had no
release since 2025-02. **Decision:** none in v1 (D3). When a consumer drags, pragmatic-drag-and-drop, with
basalt owning the keyboard model and the live-region announcements; re-check `@dnd-kit/react` if it reaches 1.0
first.

### 9.3 Virtualised event lists

`@tanstack/react-virtual` 3.14.21 (2026-10-16): dynamic heights via `measureElement` + `data-index`; sticky
day headers via `rangeExtractor` merging the active header index into `defaultRangeExtractor`; prepending
"earlier" items with `anchorTo: 'end'`, `followOnAppend` and a stable `getItemKey`. The React Compiler skips
components that call `useVirtualizer` and can memoise stale reads downstream: isolate the virtualiser in a
`"use no memo"` component and pass no instance across a compiled boundary (`useVirtualizerState` is merged
upstream but not confirmed released). `useFlushSync: false` silences React 19's warning.

### 9.4 Claude Code discovery (for the shipped reviewer and skills)

Skills in a nested `.claude/skills/` load lazily, the first time the session touches a file under that
directory; subagents in `.claude/agents/` are found only by walking **up** from the working directory, so a
nested `apps/<app>/.claude/agents/` is invisible to a repo-root session. Path-scoped rules load when a matching
file is read. **Decision:** `sync` installs the reviewer subagent and the skills at the repo root sessions start
in (the monorepo root), names them in the managed AGENTS block (row 135), and renders each rule's `paths:` from
`basalt.roots` (row 136). The subagent's `description` states when to use it; the skill procedure invokes it by
name.

### 9.5 Rendering for `basalt-ui shot`

Playwright is not a basalt dependency (the package keeps zero runtime dependencies). `shot` resolves
`playwright` from the consumer's own dev dependencies at run time and, when it is missing, exits with the one
install command; `doctor` reports it as optional. Wave 31 `/research`es the current Playwright version and its
browser-install step before pinning anything in the skill.

## 10. Fleet needs

From a read-only survey of the six apps (2026-10-16). Filed as ledger rows 143–162 in
`docs/waves/argo-friction.md`.

| App                | basalt-ui | Needs most                                                                                                                    | Hand-rolled today                                                                                                                                                                 |
| ------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| argo               | 2.13.1    | progress to target, part of whole, ranked list, joined stat strip, board, event list, table compact treatment, card skeletons | Mantine `Progress` and `RingProgress`, two six-card stat rows, three entity cards, the night strip, the item-timeline modal, five hero skeletons; warden stages as stacked tables |
| rb                 | 2.13.1    | progress to target, part of whole, distribution, record page, event list grouped by day, empty states                         | `StatTile`/`PerfTile` duplicating `StatCard`, four `Progress`, the confidence distribution, three empty states                                                                    |
| linewatch          | 2.11.1    | meter against a ceiling, joined stat strip, table to cards                                                                    | status-bar metric cells, the stat strip, two Mantine tables with a CSS table-to-card switch                                                                                       |
| basalt-ui-obsidian | 2.11.1    | list rows                                                                                                                     | every side-panel row, inline SVG icons                                                                                                                                            |
| weatherorb         | 2.14.0    | ring score, ranked bars, status over time                                                                                     | factor bars, score hero, day chips, a comparison grid                                                                                                                             |
| shutterflow        | 1.40.3    | meter, ring, part of whole, ranked list, calendar heat grid                                                                   | `CalendarHeat` (`Heatmap` drops month labels), a bar list, five Mantine tables                                                                                                    |

Kanban (argo only), decision cards (argo, rb) and agendas (none) are the rare patterns.

## 11. Reconciliation with DESIGN-CORE and V2-SPEC

| The law says                                                                                 | This spec                                                                                                                          | Decision                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DESIGN-CORE: "Card interior padding is `xs`/`sm` (11px/13px), not the Mantine-default `md`." | 12/16 = `sm`/`md` on the new grid                                                                                                  | **Changed.** The law's intent (density, small steps) holds; the reference's measured 16 horizontal beats 13 on the rubric. Wave 32 rewrites the sentence when it changes the value.                                                                                                                                                                                    |
| DESIGN-CORE: "Tight radii … controls 6, cards read a separate 7px"                           | Cards 10, controls 6, floating card + 1                                                                                            | **Changed** numbers, same intent: still tighter than the reference's 12.                                                                                                                                                                                                                                                                                               |
| DESIGN-CORE: head font for "headings/brand/card titles"                                      | `StatCard`'s caption is mono uppercase `micro`; `ChartCard` keeps the head font                                                    | **Changed** for metric captions only (D8).                                                                                                                                                                                                                                                                                                                             |
| DESIGN-CORE: the type ladder lives in `src/tokens` (no literals)                             | `sm` 13.5 → 13, `xs` 12.5 → 12, `kpi` 24 → 22, hero weight 600 → 500                                                               | **Changed** values; the ladder stays the single source.                                                                                                                                                                                                                                                                                                                |
| DESIGN-CORE: mono for every numeral                                                          | Mono kept for every figure (superseded by D33 in Wave 35)                                                                          | Hold (D5), superseded by D33: figures are proportional sans; mono is for captions, times and code.                                                                                                                                                                                                                                                                     |
| DESIGN-CORE: deltas are text colour, never a fill                                            | Same                                                                                                                               | Code brought into line (`DeltaBadge`). No law change.                                                                                                                                                                                                                                                                                                                  |
| DESIGN-CORE: accent never on selection state                                                 | Same                                                                                                                               | Two leaks closed (§ 6.12). No law change.                                                                                                                                                                                                                                                                                                                              |
| DESIGN-CORE: a single-series sparkline is neutral                                            | Same, plus a default end dot in the line's own colour                                                                              | No law change; `Sparkline`'s defaults change (§ 6.2).                                                                                                                                                                                                                                                                                                                  |
| DESIGN-CORE: area fill on by default for plain metric lines                                  | Same; none on meters                                                                                                               | No change.                                                                                                                                                                                                                                                                                                                                                             |
| DESIGN-CORE: responsive is three axes                                                        | Same                                                                                                                               | Every rule in § 7 reads the container.                                                                                                                                                                                                                                                                                                                                 |
| V2-SPEC § 9.2–9.3: every chart kind goes through the rung's host; "No new kinds"             | `Meter` and `BarList` are not chart kinds: no engine, no scales, no axes, no tooltip; they live in `src/dashboard`, not `./charts` | **Not a change** to § 9 (D2). `Heatmap` keeps its kind contract; the calendar layout is deferred.                                                                                                                                                                                                                                                                      |
| —                                                                                            | The catalogue (§ 3) and the rubric (§ 8)                                                                                           | **New law.** Wave 39 folds both into DESIGN-CORE (the `docs/*.md` prose budget has 17 lines of headroom; the fold lands at net ≤ +17 by replacing DESIGN-CORE's density and radius bullets and linking the rubric's long lists from the shipped skill instead of restating them) and ships the catalogue as the decision table in `basalt-design` and `basalt-charts`. |

## 12. Decision log

| #   | Decision                                                                                                                                                                                                                                      | Alternative refused                                                            | Reason                                                                                                                                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | One `Meter` with `bar`, `ring` and `segments`                                                                                                                                                                                                 | Separate `Gauge`, `ProgressBar`, `SegmentBar`                                  | One export covers the fleet's hand-rolls; every symbol is gated.                                                                                                                                                                                                                                         |
| D2  | `Meter` and `BarList` are HTML/CSS data primitives in `src/dashboard`                                                                                                                                                                         | Chart kinds in `./charts`                                                      | They have no scale, axis or tooltip, so routing them through the engine host adds weight for nothing; as kinds they would breach V2-SPEC § 9.3's "No new kinds". They follow the chart colour law all the same.                                                                                          |
| D3  | No drag and drop in `Board` v1                                                                                                                                                                                                                | Ship DnD with the board                                                        | No consumer moves cards by hand; adopt-or-delete.                                                                                                                                                                                                                                                        |
| D4  | Decision card, entity card, record page, list rows are recipes                                                                                                                                                                                | Components                                                                     | Domain anatomy differs per app; promote only when two apps converge on one.                                                                                                                                                                                                                              |
| D5  | Hold mono figures (superseded by D33)                                                                                                                                                                                                         | Proportional sans figures                                                      | Identity and column alignment; the reference's figures are different, not better on the rubric.                                                                                                                                                                                                          |
| D6  | Dense 28 control tier on toolbars only, fine pointer only                                                                                                                                                                                     | 28 everywhere                                                                  | The pointer floor binds; the toolbar wrap is the only measured cost.                                                                                                                                                                                                                                     |
| D7  | Gutter 24 at expanded only, as a trial                                                                                                                                                                                                        | 24 everywhere, or hold 16                                                      | 16 was a deliberate earlier decision; the evidence for 24 exists only at 1440.                                                                                                                                                                                                                           |
| D8  | Metric caption mono uppercase with a qualifier slot; `ChartCard` keeps its head-font title                                                                                                                                                    | One title style for every card                                                 | A figure's label and a chart's title are different jobs; the head font stays a differentiator.                                                                                                                                                                                                           |
| D9  | Scenarios share one dynamic playground route                                                                                                                                                                                                  | One route per scenario                                                         | Route budget 14/15.                                                                                                                                                                                                                                                                                      |
| D10 | Not built: schedule list, deal and pipeline cards, tick meter, calendar heat grid (until shutterflow is on 2.x)                                                                                                                               | Build for parity                                                               | No 2.x consumer. Recorded so a later reference does not reopen them without one.                                                                                                                                                                                                                         |
| D11 | `EventList` virtualises through one shared lazy seam extracted from the chat's `LazyVirtualizedRows` (`src/agent/chat/thread-message.tsx:838`; option types in `src/agent/chat/virtualize.ts`)                                                | A second virtualiser, or a static `@tanstack/react-virtual` import in the root | `@tanstack/react-virtual` is an optional peer; the root entry must not require it, and the chat already has the lazy load and the plain fallback.                                                                                                                                                        |
| D12 | `Board` is a component with one consumer (argo)                                                                                                                                                                                               | A recipe until a second app needs it                                           | Its cost is the two-dimensional roving-focus keyboard model and its announcements, which no app should re-derive; adopt-or-delete needs one consumer, D4's two-app bar is for domain anatomy.                                                                                                            |
| D13 | `ViewTabs` lives in a `tabs` slot (`PageBar`, `Section`) or a `ChartCard`/`WidgetHeader` `actions` slot; every other `PageBar` slot, `Section.actions` and a `FilterSet` refuse it (Wave 31, row 138)                                         | `PageBar.tabs` only                                                            | A card that switches only its own view is a real pattern; forcing it into a section's tabs wraps one card in chrome.                                                                                                                                                                                     |
| D14 | The stale-board notice lives in `doctor` as an info line until Wave 21's `check` folds `doctor` in                                                                                                                                            | A new `check` command in Wave 31                                               | `check` is Wave 21's scope; a warning would change every consumer's verdict for an optional tool.                                                                                                                                                                                                        |
| D15 | No shipped rule line names the design procedure; the AGENTS block and the skill carry it                                                                                                                                                      | One untagged rule bullet                                                       | Every rule bullet names its enforcer, and nothing can enforce "run /basalt-design".                                                                                                                                                                                                                      |
| D16 | `shot` writes one contact sheet per anchor and the reviewer must read every sheet (unread = `unverified` = fail); `scale` includes basalt's own `--vx-*` steps                                                                                | Reading every crop; a hard-coded grid in the reviewer                          | Reading 156 crops was skipped in practice (16 read); a grid in a shipped reviewer goes stale when Wave 32 moves the scale.                                                                                                                                                                               |
| D17 | The `SegmentedControl` track takes the control radius and the indicator `fine`: `RADIUS.ctrl === RADIUS_STEP.fine + 2` (Wave 32)                                                                                                              | Keep `RADIUS.card === RADIUS_STEP.tight + 2`                                   | At card 10 the old law put a 10 px track around 6 px controls; the control tier is the track's real neighbour.                                                                                                                                                                                           |
| D18 | The compact card inset (16 → 12 horizontal) steps on the viewport below `sm`, not a container query (Wave 32)                                                                                                                                 | A container query per card                                                     | Inline-styled cards cannot read a container query, and the one existing below-`sm` block is the step's single home; § 7's container rule binds the component layouts, this is an inset token.                                                                                                            |
| D19 | The tightened `card-inset` rule and the new-scale `raw-spacing`/`inline-spacing` findings ship at `warn` for 2.16, `error` from 2.17 (Wave 32)                                                                                                | Ship at `error` with the scale                                                 | MAINTAINING § "Guards — shipping a stricter one": a consumer has no semver signal that enforcement tightened.                                                                                                                                                                                            |
| D20 | Keep the 24 px gutter at the expanded class (D7's trial passed three rounds)                                                                                                                                                                  | Revert to 16                                                                   | No round cites a detached seam; the page frames evenly against the sidebar at 1440.                                                                                                                                                                                                                      |
| D21 | A `Badge` with no `color` is the neutral (`gray`) `light` chip; `color=` opts into a status or the accent (Wave 33 round 1)                                                                                                                   | The `light` tint of the primary colour (§ 6.10 as first written)               | A colourless chip is not a status; the primary tint spent the accent on chrome (DESIGN-CORE § Accent discipline), and r1 failed it Craft 4.                                                                                                                                                              |
| D22 | A delta paints the status solid as text; `STATUS_STOP` is retuned so `good`/`warn`/`bad` clear 4.5:1 on the panel in both schemes at the default derive config (Wave 33)                                                                      | Mixing 12 % ink into the delta in CSS; separate status-text tokens             | The derive owns contrast (DESIGN-CORE); one token per status. Superseded for the levels in Wave 34 (owner): each solid is derived per surface (`src/tokens/status-text.ts`), moving in lightness only as far as 4.5:1 on every text surface needs, at every `lightLevel`/`darkLevel` (clamped to −5..5). |
| D23 | The info bubble opens in the top layer as a native `popover="manual"`, positioned in the viewport (Wave 33)                                                                                                                                   | A `react-dom` portal                                                           | `ChartCard` reaches `WidgetHeader`, and V2-SPEC § 9.8 pins `./charts` to the engine, d3-scale and react; the top layer escapes the card's `overflow` and containment without one.                                                                                                                        |
| D24 | The shipped reviewer scores a delta as trend-coloured text (a fill fails) and a `tone` rail as a status (Wave 33)                                                                                                                             | Its first wording: "a delta is neutral text"                                   | It contradicted § 6.1 and DESIGN-CORE, and failed every correct delta in r1 and r2. Superseded by D28 (the `tone` rail is gone).                                                                                                                                                                         |
| D25 | The qualifier drops under the caption by wrapping, left-aligned, never truncated; no container breakpoint (Wave 33)                                                                                                                           | A container-query step                                                         | Whether it fits depends on the caption and qualifier lengths, not on a width class.                                                                                                                                                                                                                      |
| D26 | A date tick label may recur only with a boundary label between (a day or a year): `18:00, 18.10, 06:00` is fine, `17.10, 17.10` is not; every kind (`DualPanel`, `MirroredBars`, `BandStrip` included) shares one resolver (Wave 33, row 137) | No label ever repeats (`17.10 06:00, 17.10 12:00`)                             | The day marker disambiguates; repeating the date on every hour tick is noise at every width.                                                                                                                                                                                                             |
| D27 | `Button` / `ActionIcon` `light` and `outline` with no `color` are ink (neutral tint / surface border, ink label); only `filled` and an explicit `color=` carry the accent (Wave 34)                                                           | Keep the accent on light/outline                                               | Wave 33 r1–r3 failed them Craft 4; DESIGN-CORE § Accent discipline.                                                                                                                                                                                                                                      |
| D28 | Status is a dot plus a word, or the value's own ink; no coloured edge (Wave 34)                                                                                                                                                               | The leading-edge verdict rail                                                  | Owner: reads as generic AI-dashboard decoration; a dot and a word carry the verdict in shape and text, not only colour.                                                                                                                                                                                  |
| D29 | `Meter`'s props are a discriminated union: `bar` with `value`, `segments`, or `value` + `zones`; `ring` with `value` only (Wave 34)                                                                                                           | One flat prop object with precedence rules                                     | Invalid mixes (zones with segments, a ring with a forecast) became silent visual bugs in review; the union makes them type errors before any consumer exists.                                                                                                                                            |
| D30 | A zoned `Meter` names its zones on the band and anchors the reading at the marker; colliding names wrap to a list (Wave 34, argo training load)                                                                                               | The holding zone named only in the caption                                     | r2 failed grey bands told apart by shade alone (Craft 5); r3 read the reading under the first zone's name as that zone's value (Expression 2).                                                                                                                                                           |
| D31 | A Meter in `StatCard`'s visual slot sizes to content and keeps the card inset, keyed on the Meter's root attribute (Wave 34)                                                                                                                  | A new `visual` prop on `StatCard`                                              | No new public surface; the slot already is the card's one visual (§ 6.1), and a sparkline keeps its 22 px bleed.                                                                                                                                                                                         |
| D32 | `BarList`'s bar spans the label column only; value and secondary are shared grid columns outside the track (Wave 34)                                                                                                                          | The bar behind the whole row                                                   | r1: the leader bar ran under its own value text (Craft 6).                                                                                                                                                                                                                                               |
| D33 | Hero values, row labels and body text are the proportional sans with lining figures; `tabular-nums` only in table columns and axis ticks; mono only for captions, times and code (Wave 35, supersedes D5)                                     | Hold mono figures (D5)                                                         | Landscape research #5; argo asked for it in five UPSTREAM rows. `--basalt-font-numeral` is the opt-out. `src/table/**` is unchanged: whether the cell face moves is Wave 37.                                                                                                                             |
