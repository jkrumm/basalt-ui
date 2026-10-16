# Design-parity spec — expression through data (Part 3)

Ground truth for Waves 31–37 of `docs/waves/PLAN.md` Part 3. Written in Wave 30 from the two-way
[AUDIT.md](AUDIT.md), the measured [BENCHMARK.md](BENCHMARK.md), the fleet survey (§ 10) and the research in
§ 9. **The bar is basalt's own rubric (§ 8).** The reference is evidence for where that bar sits, never the
target: nothing here is built to look like it, and its code, styles, markup, assets and copy never enter
basalt. A reference value is adopted only where it beats basalt's current value on the rubric, and every
adoption and refusal is recorded in § 12.

**Precedence.** This file sits outside the `docs/*.md` spec-prose budget on purpose. Until Wave 36 folds the
settled law into `docs/DESIGN-CORE.md`, this file wins over DESIGN-CORE **only** where § 11 names the
change; everywhere else DESIGN-CORE binds. `docs/V2-SPEC.md` § 9 still owns the chart engine.

**Status of each decision.** Values marked _target_ are what the first round renders; a pattern wave may
move a target after a scored round, and records the move and its reason in its **Left behind** and in § 12.
Values marked _hold_ do not move without an owner decision.

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
4. **Done** when the rubric passes on every item, not when the rounds run out.

## 2. Scenarios

Each is one playground page under a single dynamic route, `apps/playground/src/routes/scenarios.$name.tsx`
(one route file: the playground route budget is 14 of 15). The data is fixture data shaped like the fleet
app it stands for; no real user data.

| #   | Scenario           | Stands for                                 | The user's question                                  | The decision it supports          | Pattern families exercised                                                                                              |
| --- | ------------------ | ------------------------------------------ | ---------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| S1  | Ops monitor        | linewatch                                  | Is the line healthy now, and when did it last break? | Call the ISP or not               | metric card (trend), status over time, distribution, event list, table (outages)                                        |
| S2  | Training log       | argo strength-tracker, walking-pad         | Am I on track for this month's goal?                 | Train today or rest               | progress to target, metric trend, ranked list (records), table (sessions), entity card (exercise), form (log a workout) |
| S3  | Agent work         | argo warden, agents                        | What needs me, and what is stuck?                    | Approve, reassign or leave it     | board, decision card, event list (item timeline), status chip                                                           |
| S4  | Spend and usage    | argo usage-tracking, shutterflow analytics | Am I within budget, and what is driving it?          | Cut a project or raise the budget | progress to target with forecast, part of whole, ranked list, distribution                                              |
| S5  | Learning record    | rb knot detail, journal                    | Where am I with this topic?                          | Review it now or later            | record header, stat strip, event list grouped by day, aside                                                             |
| S6  | Settings and entry | shutterflow account, argo workout form     | Change one thing without breaking another            | Save or cancel                    | forms, sections, states                                                                                                 |

Every scenario renders the empty, loading and error states of each pattern it uses (toggled from the
page), at desktop 1440 and mobile 390, in both schemes.

## 3. Data-to-expression catalogue

The core of the spec. Read it by the **shape of the data**, then take the encoding. "Default" is what a
basalt agent reaches for today.

| Data shape                                                                   | Best encoding                                                                                                                                                     | Why it beats the default                                                                                        | basalt today                                                                   | Gap                                                                                           | Home                                                                                   |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Single value with a trend                                                    | Figure, text delta, axis-less sparkline with an end dot along the card's bottom edge                                                                              | The history says whether the number is normal; the end dot ties the line to the figure                          | `StatCard` + `sparkline` slot + `Sparkline` (`emphasizeLast` opt-in)           | guidance (the slot is optional and the default leaves it empty), chrome (stroke, end dot off) | `StatCard`; recipe                                                                     |
| Progress to a target (one bounded ratio)                                     | Linear meter: filled track, target tick, value and target as end captions                                                                                         | Length on a shared track is read more precisely than an angle or two numbers; the target is visible, not stated | Mantine `Progress` hand-rolled in argo, rb, shutterflow                        | flexibility                                                                                   | **`Meter`** (new)                                                                      |
| Progress with a forecast or committed/forecast split                         | Meter with two segments of one hue (solid committed, lighter forecast) and a target tick                                                                          | One strip carries three numbers without a legend                                                                | none                                                                           | flexibility                                                                                   | `Meter` `segments`                                                                     |
| A single headline ratio where the shape is the message (a score, a hit rate) | Ring meter, value centred, at most one per card row                                                                                                               | Reads before the number; earns its space only as the card's hero                                                | Mantine `RingProgress` hand-rolled (argo timer, weatherorb score)              | flexibility                                                                                   | `Meter` `shape="ring"`                                                                 |
| Part of a whole, 2–6 parts                                                   | One segmented bar with the parts in order and captions under the segments                                                                                         | Replaces a row of N count tiles or a donut plus a total card; compares parts and shows the total in one line    | `Donut`; rows of `StatCard`s                                                   | guidance (donut and tiles chosen by default), flexibility (no bar)                            | `Meter` `segments`; `Donut` only when the parts are the page's subject                 |
| Ranked list, top N                                                           | Rows of label, inline bar on a shared scale, right-aligned mono value                                                                                             | The bar ranks at a glance; a table with a share column needs reading                                            | Tables with a `%` column; hand-rolled `BarList`s (shutterflow, weatherorb)     | flexibility                                                                                   | **`BarList`** (new)                                                                    |
| Distribution                                                                 | Small histogram (`Bars`, axis-less in a card) or a strip of counts per bucket                                                                                     | Shows skew and outliers that a mean hides                                                                       | `Bars`; rb hand-rolls a swatch-and-count list                                  | guidance                                                                                      | recipe (`Bars` in a card)                                                              |
| Status over time                                                             | Band strip (`BandStrip`), or a calendar heat grid for daily data over months                                                                                      | Every period visible at once; gaps and runs are the reading                                                     | `BandStrip`, `Heatmap` (no month labels, so shutterflow hand-rolls a calendar) | flexibility (calendar layout)                                                                 | `Heatmap` `layout="calendar"`                                                          |
| Bounded score inside a row (0–10, health)                                    | Tick meter, ten segments, beside the number                                                                                                                       | A gauge that fits in a line of text or a table cell                                                             | none                                                                           | flexibility                                                                                   | `Meter` `shape="ticks"`, built only with a named consumer (§ 4)                        |
| A set of KPIs about one record                                               | Joined stat strip: one surface, cells divided by 1 px gaps, each cell its own encoding                                                                            | Reads as one instrument; N separate cards read as N unrelated tiles                                             | `StatGroup` (separate cards)                                                   | flexibility (no joined mode), guidance                                                        | `StatGroup` `variant="strip"`                                                          |
| Event sequence                                                               | Event list: day groups, actor and sentence on line one, mono time pinned right, an optional chip row, an optional rail                                            | Time at the edge keeps the sentence column clean; day groups give the rhythm                                    | Mantine `Timeline` (a stepper idiom); hand-rolled in argo, rb, linewatch       | flexibility                                                                                   | **`EventList`** (new)                                                                  |
| Work items by status                                                         | Board: columns with count and totals, compact cards, keyboard navigation                                                                                          | Load per stage is visible; stacked per-stage tables hide it                                                     | argo draws its stages as stacked tables                                        | flexibility                                                                                   | **`Board`** (new, no drag in v1)                                                       |
| An entity with facts                                                         | Record header (avatar tile, title, badges, one mono facts line, actions) + joined stat strip + event list + aside                                                 | The page answers "what is this and how is it doing" above the fold                                              | `PageBar`, `PageAside`; rb and argo hand-roll the rest                         | guidance                                                                                      | recipe                                                                                 |
| A request that needs a decision                                              | Decision card: question as the headline, facts line, an inset evidence panel (one chart or excerpt), one primary, one secondary, one quiet action, keyboard hints | The evidence sits beside the ask; the user decides without opening the record                                   | argo `QueueCard`, rb `ReviewQueueCard`                                         | guidance (+ an inset-panel surface)                                                           | recipe; promoted to a component only if argo and rb converge on one anatomy in Wave 33 |
| Record facts in a table row                                                  | Cell kinds: entity (avatar + name, no wrap), status chip, mono right-aligned figure, relative time, inline meter                                                  | Every column scannable by shape, not only by reading                                                            | text cells                                                                     | flexibility                                                                                   | `BasaltDataTable` column `meta.kind`                                                   |
| A list of references in a side panel                                         | List rows: leading glyph, title, one meta line, trailing affordance                                                                                               | Even rhythm; the meta line carries the facts                                                                    | obsidian and argo hand-roll rows                                               | guidance                                                                                      | recipe + tokens; a component only if obsidian adopts it                                |
| A page's state in one sentence                                               | Headline plus a summary sentence that carries live numbers                                                                                                        | Says what the page says; replaces decorative subtitles                                                          | `PageBar` (chrome only)                                                        | guidance                                                                                      | recipe; the sentence must contain at least one live number or it is cut                |

## 4. Homes

A new export names its first fleet consumer (adopt-or-delete). Symbol, subpath and rule-line budgets are
gated at their landed values (103/103 non-chart symbols, 14/14 chart symbols, 277/277 rule lines,
5164/5165 CLI lines); each new export raises its ceiling by exactly its own count in the same PR and names
the consumer in `scripts/consumers.json`.

| Pattern                                                           | Home                                                          | First consumers                                                                                                                                               | Wave                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Metric card anatomy (caption row, qualifier, text delta, end dot) | `StatCard`, `DeltaBadge` (variants, no new export)            | argo, linewatch, rb                                                                                                                                           | 32                                              |
| Joined stat strip                                                 | `StatGroup` `variant="strip"`                                 | argo body-composition, linewatch stat strip                                                                                                                   | 33                                              |
| `Meter` (linear, segments, target, ring)                          | `basalt-ui/charts`, Mantine-free, plain SVG/HTML, tokens only | argo (reading, warden budget, cache hit), rb (course, ingest), shutterflow (sync, keeper rate, storage), linewatch (link against ceiling), weatherorb (score) | 33                                              |
| `BarList`                                                         | `basalt-ui/charts`                                            | argo (top projects), shutterflow (bodies, lenses), weatherorb (factor bars)                                                                                   | 33                                              |
| Calendar heat grid                                                | `Heatmap` `layout="calendar"`                                 | shutterflow (`CalendarHeat`), argo (night strip)                                                                                                              | 33                                              |
| Table cell kinds, responsive behaviour, dense toolbar             | `BasaltDataTable`                                             | argo (9 tables), linewatch (2 Mantine tables), shutterflow (trash, jobs)                                                                                      | 34                                              |
| `EventList`                                                       | `basalt-ui` root                                              | argo (warden item timeline, narratives), rb (journal, session history), linewatch (transitions)                                                               | 35                                              |
| `Board`                                                           | `basalt-ui` root                                              | argo warden                                                                                                                                                   | 35                                              |
| Record page, decision card, entity card, list rows, page summary  | recipes in `basalt-design`                                    | argo, rb, obsidian                                                                                                                                            | 33–35                                           |
| Tick meter                                                        | `Meter` `shape="ticks"`                                       | none yet                                                                                                                                                      | not built until a consumer names it             |
| Schedule / agenda list                                            | none                                                          | none (argo uses `@mantine/schedule`)                                                                                                                          | not built                                       |
| Deal and pipeline cards                                           | none (domain)                                                 | none                                                                                                                                                          | not built; a `Board` card is a slot             |
| Drag and drop on `Board`                                          | none in v1                                                    | none (warden items move by agent action, not by hand)                                                                                                         | not built; library chosen in § 9 for when it is |

## 5. Scales

Every change goes through the derive config and the constants in `src/tokens/` (never a hand-edited hex),
then the level-0 golden tests are re-baselined in the same PR. Density, radius and font knobs keep their
contracts: level 0 is the new verbatim baseline.

| Scale                     | Now                                                               | Decision                                                                                                                                                                                          | Status | Why                                                                                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spacing grid              | Generic scale 11/13/18/20/26 (`palette.ts:342-346`), off any grid | Even-pixel steps 2/4/6/8/10/12/14/16/20/24/32; the Mantine scale becomes xs 8, sm 12, md 16, lg 20, xl 24                                                                                         | target | Off-grid steps are why no basalt rung equals a measured inset. Wave 32 diffs every `SPACE_SCALE` call site at level 0 and keeps the grid only if the boards pass.                                 |
| Card inset                | 11 vertical, 13 horizontal (`palette.ts:779,782`)                 | 12 vertical, 16 horizontal; 12 horizontal in a compact container                                                                                                                                  | target | Measured reference 12/16; DESIGN-CORE's "xs/sm" density law is kept by stepping with the grid (§ 11).                                                                                             |
| Gap between sibling cards | 12                                                                | 12; 1 px inside a joined strip                                                                                                                                                                    | hold   | Already on the grid.                                                                                                                                                                              |
| Page gutter               | 16 desktop, 8 compact (`palette.ts:661,670`)                      | 24 at the expanded size class only; 16 medium, 8 compact unchanged                                                                                                                                | target | 16 was chosen deliberately down from 20 ("pushed away from the seam"); the trial is at expanded only, where the reference's 24 measures, and Wave 32 reverts it if the seam reads detached again. |
| Radius                    | card 7, control 6, floating 8 (`palette.ts:197-202`)              | card 10, control 6, floating = card; the radius knob still shifts all                                                                                                                             | target | A 1 px card-to-control step makes nested surfaces look accidental; 10 keeps basalt tighter than the reference's 12 (DESIGN-CORE's "tight radii").                                                 |
| Row text                  | `md` 15 for nav rows, menu items, timeline (`core.ts:133`)        | Dense rows (table cells, nav, list and event rows, menu items) take `sm`, retuned 13.5 → 13 with a 20 px line; `md` 15 stays body for prose and form labels; inputs keep 16 under coarse pointers | target | 15 px rows are what wraps dense rows on compact.                                                                                                                                                  |
| Meta                      | `xs` 12.5                                                         | 12 with a 16 px line                                                                                                                                                                              | target | Grid-aligned line boxes.                                                                                                                                                                          |
| Caption                   | `micro` 11 mono uppercase                                         | 11 mono uppercase, +0.06em, faint                                                                                                                                                                 | hold   | The reference's 10.5 is below basalt's legibility floor for UI copy; `nano` 10 stays for drawn labels only.                                                                                       |
| Hero figure               | `kpi` 24, mono 600, −0.02em                                       | 22, mono **500**, −0.02em                                                                                                                                                                         | target | 24/600 plus a filled pill is what makes cards shout. Mono stays (§ 11).                                                                                                                           |
| Page headline             | `h1` 26, no tracking                                              | 26, −0.02em                                                                                                                                                                                       | target | Free polish, same size.                                                                                                                                                                           |
| Controls                  | `ctl` 32; 44 under coarse pointers                                | 32 default (hold); a **dense** 28 tier for table toolbars and filter rows at fine pointers only                                                                                                   | target | 32 wraps the toolbar; the pointer tier still lifts every control to 44 on touch, so no hit target shrinks where it matters. Internal token, no export.                                            |
| Nav row                   | about 32                                                          | 32                                                                                                                                                                                                | hold   | Carries badges; the reference's 28 is not worth breaking the pointer floor.                                                                                                                       |
| Aside                     | 300 (`palette.ts:644`)                                            | 300–360 by container, Wave 35 decides on the record scenario                                                                                                                                      | target | The reference's 380 is measured on a 1440 viewport only.                                                                                                                                          |

## 6. Anatomy, per family

### 6.1 Metric card (`StatCard`)

- **Caption row:** label in mono uppercase `micro`, faint; an optional **qualifier** right-aligned on the
  same row (period, target, source) in `micro` muted; an optional info glyph. The icon becomes optional and
  off by default. (`ChartCard` keeps its head-font title: it titles a chart, not a figure.)
- **Value row:** figure (§ 5 hero), unit inline after it in `sm` muted on the same baseline, delta after
  the unit.
- **Delta:** glyph plus signed figure in the trend colour as **text**, no fill (DESIGN-CORE § Design rules:
  "up/down deltas are text colour only, never a fill"). A `period` stays muted text.
- **Visual:** one encoding from § 3 along the bottom edge or beside the value. A card with no visual is
  allowed only when the number has no history, target or parts; the reviewer fails an empty lower half.
- **Footer** (optional): one muted line, a source or "as of", never a restatement of the caption.
- **Size:** content-driven; a row of cards aligns by the grid, not by a fixed height.

### 6.2 Chart in a card

- Axis-less, grid-less sparklines; one reference line with a short mono label where a target exists.
- Height 22 in a metric card, 24 in a stat cell; stroke 1.5; soft single-hue area on trend lines, none on
  meters; **end dot on by default** (`emphasizeLast`).
- Neutral (`VX.line`) unless the mark is a trend, a status or a category (DESIGN-CORE § When a hue is
  earned). A single metric's sparkline is neutral.
- Labels never repeat. The date tick formatter is span-aware: an hourly 48 h axis shows hours with the day
  marked at the boundary, never `17.10, 17.10, 18.10` (ledger row 137, with weatherorb's zoned ticks).

### 6.3 `Meter`

- One track (neutral fill), one or more segments in order, an optional target tick, optional end captions
  in `micro` mono. Segments of one series share a hue at two strengths (committed, forecast); categorical
  parts use the consumer's series colours. No hatching (V2-SPEC § 9.9: a flat fill).
- Shapes: `bar` (default; height 6, radius `fine`), `ring` (one per card, value centred), `ticks` (§ 4: not
  built yet).
- Accessible as `role="meter"` with `aria-valuenow/min/max` and a text label; segments are listed in an
  `aria-describedby` text. Never colour-only: the captions carry the numbers.

### 6.4 `BarList`

- Rows: label (truncates, `title` on hover), bar on one shared scale behind or beside the label, mono
  right-aligned value, optional secondary value muted. Bars neutral; the accent only on a highlighted row.
- 5–10 rows; past 10 it is a table with an inline-bar column.

### 6.5 Joined stat strip (`StatGroup variant="strip"`)

- One surface, cells divided by 1 px gaps over a faint fill, each cell: caption row, then a figure or an
  encoding. An optional full-width footer row (a next step) below.
- Compact container: cells wrap to two columns; never four squeezed cells.

### 6.6 Tables (`BasaltDataTable`)

- Header: keep micro mono uppercase; drop the filled band so the header shares the body fill, divided by the
  hairline; the sorted column is brighter with its arrow.
- Rows: 40 (hold). Cell text `sm` (§ 5).
- **Cell kinds** via `meta.kind`: `entity` (avatar or glyph + name, never wraps), `status` (status chip,
  § 6.10), `number` and `money` (mono, right-aligned, unit in the header), `relative-time` (mono muted, full
  date in a tooltip), `meter` (§ 6.3 inline), `text`.
- **Responsive** (§ 9.1): fold by `meta.priority` (exists) → at compact, the first column pins and the rest
  scroll horizontally, keyboard-reachable → `renderCard` only for non-comparable rows. A folded column stays
  reachable (per-row disclosure) and `aria-colcount`/`aria-colindex` stay correct.
- **Toolbar:** one row at the dense 28 tier; filter chips show a muted label and a bright value; secondary
  controls right-aligned; wraps only below the compact container.

### 6.7 `EventList`

- Day group labels (`micro` mono). A row: leading avatar or glyph, actor (500) and sentence on line one,
  mono time pinned right, optional muted body, optional chip row. Optional rail.
- Two densities: `feed` (two lines, about 52) and `timeline` (rail, body, chips).
- Virtualised above about 200 rows (§ 9.3); below that it renders plainly.

### 6.8 `Board`

- Columns: header with a status glyph, title, count and right-aligned totals; cards stack with a 6 gap;
  each column scrolls alone. Card: caption line (actor, type), title, a linked record, a status line, an
  optional meter or preview slot.
- Keyboard: arrow keys move between cards and columns, Enter opens. Compact: columns become a
  `SegmentedControl`-switched single column, never a 4-wide horizontal scroll.

### 6.9 Record page (recipe)

Record header (avatar tile, title, up to two badges, one mono facts line, actions right) → joined stat strip
→ main column (decision card if one is pending, then the event list) → `PageAside` (brief, open work,
signals). No new component; the recipe names the existing pieces.

### 6.10 Status chip

Mantine `Badge` defaults to the `light` variant (status tint) instead of `filled`; 20 high, radius `tight`;
an optional leading glyph that encodes the state by shape as well as colour. `filled` stays available for a
count on an accent surface.

### 6.11 Empty, loading, error

- **Empty** (`EmptyState`): inside the surface it replaces (a ring-edged tile in a section), title at `md`
  500 (not larger than its neighbours), one or two muted lines that say why it is empty and what to do, one
  action. Never "No data".
- **Loading:** a skeleton that has the pattern's shape (column-shaped rows exist; `StatCard` gets one so
  argo's five hand-rolled hero skeletons go away). No spinner inside a card.
- **Error:** the `QueryState` branch at the pattern's tier, one sentence and a retry.

### 6.12 Chrome leaks to close

The subtle `Button` label is neutral ink, not accent; the active `Tabs` underline is ink, not accent (Wave
32 confirms the current colour in code first). Both follow DESIGN-CORE § Accent discipline.

## 7. States and responsive behaviour

Every pattern is shot (§ 1) in: rest, hover (fine pointer), keyboard focus, the tooltip open where it has
one, empty, loading and error; desktop 1440 and mobile 390; light and dark. Responsive behaviour reads the
container class, never the viewport (DESIGN-CORE § three axes), except shell chrome.

| Pattern        | Compact container                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Metric card    | Figure shrinks by container query (exists); the visual stays; the qualifier drops under the caption if it would truncate |
| Stat strip     | Two columns                                                                                                              |
| Meter, BarList | Full width; captions stay                                                                                                |
| Table          | Fold, then pin-and-scroll; `renderCard` only where opted in                                                              |
| EventList      | Time moves under the actor line at the narrowest step; chips wrap                                                        |
| Board          | One column at a time with a column switcher                                                                              |
| Record page    | Aside docks below the main column (exists in `PageAside`)                                                                |

## 8. The rubric

Scored **per component**, then per page. A fresh agent that did not write the code scores the board and
must cite the crop (file, scheme, viewport, state) and the defect for every failed item. One failed item
fails the component. Only a pass merges.

### 8.1 Craft

1. Every inset, gap and radius is a § 5 step; nested surfaces step by at least 3 px of radius.
2. Type comes from the § 5 roles; no more than three sizes inside one card.
3. Density: no dead half of a card; no wrapped row in a dense list at 390.
4. Chrome is quiet: one ring per surface, no bare hairline borders on cards, no accent on chrome.
5. Both schemes pass contrast; nothing is distinguishable only by colour.
6. Desktop 1440 and mobile 390 both read as designed, not merely as not broken.
7. Hover, focus and tooltip states exist and are visible; focus is the 2 px outline.

### 8.2 Expression

1. The encoding matches the data's shape in § 3; the reviewer names the shape.
2. The space carries information: every visual answers a question the caption asks.
3. Colour is earned (trend, status or category); a single metric is neutral.
4. A number with a target shows the target; a number with history shows the history; a whole with parts
   shows the parts.
5. Labels never repeat on an axis; ticks fit the span.

### 8.3 Communication

1. No filler copy (§ 8.4).
2. Every number has its unit and, where it matters, its period, inline.
3. A tooltip or a one-line explanation exists wherever a number needs context (its definition, period or
   source), and none where the number is obvious.
4. Titles are precise nouns ("Ride distance, 7 days"), not categories ("Metrics").
5. The page balances numbers, charts and tables deliberately: no page is three rows of KPI cards, and no
   page is a single table when its data has a shape.
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

## 9. Research (2026-10-16, `/research`)

### 9.1 Responsive tables

TanStack Table ships column visibility and column pinning state and renders nothing; width-driven folding
and sticky pinning are the consumer's CSS. Primer recommends column-width options, removing less important
columns and horizontal scroll; mantine-react-table favours horizontal scroll; none of the surveyed systems
recommends card collapse. WCAG 1.4.10 exempts data tables from reflow if the scroll container is keyboard-
reachable; a column folded out of view must stay reachable (F102) with `aria-colcount`/`aria-colindex`
correct. **Decision:** keep basalt's `meta.priority` fold, add pin-and-scroll at compact as the default end
state, keep `renderCard` opt-in for non-comparable rows. Sticky pinned cells need opaque backgrounds and a
`minSize` (TanStack issue 5392). basalt is on `@tanstack/react-table` 9.2.8 with the pinning state already
wired (`table/data-table-state.ts:133`); the research could read only the v8 docs, so Wave 34 checks each
API against the installed v9 source.

### 9.2 Drag and drop (for when `Board` needs it)

Classic `@dnd-kit/core` is frozen since 2024-12 and labelled legacy. `@dnd-kit/react` 0.5.1 (2026-10-15) is
pre-1.0, has accessibility on by default and a TanStack Virtual example, but has an open React 19 StrictMode
issue (2116) and no React Compiler statement. `@atlaskit/pragmatic-drag-and-drop` 4.0.0 (2026-09-24) is
framework-agnostic with no React peer, small, has a TanStack Virtual example, and its React packages opt
into React Compiler gating; keyboard and announcements are the integrator's job. `@hello-pangea/dnd` has had
no release since 2025-02. **Decision:** none in v1 (no consumer drags). When one does, pragmatic-drag-and-
drop, with basalt owning the keyboard model and the live-region announcements; re-check `@dnd-kit/react` if
it reaches 1.0 first.

### 9.3 Virtualised event lists

`@tanstack/react-virtual` 3.14.21 (2026-10-16): dynamic heights via `measureElement` + `data-index`; sticky
day headers via `rangeExtractor` merging the active header index into `defaultRangeExtractor`; prepending
"earlier" items with `anchorTo: 'end'`, `followOnAppend` and a stable `getItemKey`. The React Compiler
skips components that call `useVirtualizer` and can memoise stale reads downstream; isolate the virtualiser
in a `"use no memo"` component and pass no instance across a compiled boundary (`useVirtualizerState` is
merged upstream but not confirmed released). Set `useFlushSync: false` to silence React 19's warning.

### 9.4 Claude Code discovery (for the shipped reviewer and skills)

Skills in a nested `.claude/skills/` load lazily, the first time the session touches a file under that
directory; subagents in `.claude/agents/` are found only by walking **up** from the working directory, so a
nested `apps/<app>/.claude/agents/` is invisible to a repo-root session. Path-scoped rules load when a
matching file is read. **Decision:** `sync` installs the reviewer subagent and the skills at the repo root
that sessions start in (the monorepo root), names them in the managed AGENTS block (row 135), and renders
each rule's `paths:` from `basalt.roots` (row 136). The subagent's `description` states when to use it; the
skill procedure invokes it by name.

## 10. Fleet needs

From a read-only survey of the six apps (2026-10-16). Filed as ledger rows 143–162 in
`docs/waves/argo-friction.md`.

| App                | basalt-ui | Needs most                                                                                                               | Hand-rolled today                                                                                                                                                                 |
| ------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| argo               | 2.13.1    | progress to target, part of whole, ranked list, joined stat strip, board, event list, table mobile cards, card skeletons | Mantine `Progress` and `RingProgress`, two six-card stat rows, three entity cards, the night strip, the item-timeline modal, five hero skeletons; warden stages as stacked tables |
| rb                 | 2.13.1    | progress to target, part of whole, distribution, record page, event list grouped by day, empty states                    | `StatTile`/`PerfTile` duplicating `StatCard`, four `Progress`, the confidence distribution, three empty states                                                                    |
| linewatch          | 2.11.1    | meter against a ceiling, joined stat strip, table to cards                                                               | status-bar metric cells, the stat strip, two Mantine tables with a CSS table-to-card switch                                                                                       |
| basalt-ui-obsidian | 2.11.1    | list rows                                                                                                                | every side-panel row, inline SVG icons                                                                                                                                            |
| weatherorb         | 2.14.0    | ring score, ranked bars, status over time                                                                                | factor bars, score hero, day chips, a comparison grid                                                                                                                             |
| shutterflow        | 1.40.3    | meter, ring, part of whole, ranked list, calendar heat grid                                                              | `CalendarHeat` (`Heatmap` drops month labels), `BarList`, five Mantine tables                                                                                                     |

Kanban (argo only), decision cards (argo, rb) and agendas (none) are the rare patterns.

## 11. Reconciliation with DESIGN-CORE

| DESIGN-CORE says                               | This spec                                          | Decision                                                                                                                           |
| ---------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Card interior padding is `xs`/`sm` (11/13)     | 12/16 on the new grid                              | Change the numbers, keep the law ("density is the point; card padding is the small steps"). Wave 36 rewrites the line.             |
| Tight radii: controls 6, cards 7               | Cards 10, controls 6                               | Change. Still tighter than the reference; the gap of 4 is the reason.                                                              |
| Mono for every numeral                         | Mono kept for every figure, weight 500 on the hero | Hold mono (identity, column alignment). The reference's proportional figures are refused.                                          |
| Deltas are text colour, never a fill           | Same                                               | Code is brought into line (`DeltaBadge`). No law change.                                                                           |
| Accent never on selection state                | Same                                               | Two leaks closed (§ 6.12). No law change.                                                                                          |
| Single-series sparkline is neutral             | Same, plus a default end dot                       | The dot takes the line colour unless the card has a trend verdict.                                                                 |
| Area fill on by default for plain metric lines | Same; off on meters                                | No change.                                                                                                                         |
| Responsive is three axes                       | Same                                               | Every rule in § 7 reads the container.                                                                                             |
| —                                              | The catalogue (§ 3) and the rubric (§ 8)           | New law. Wave 36 folds both into DESIGN-CORE and ships the catalogue as the decision table in `basalt-design` and `basalt-charts`. |

## 12. Decision log

| #   | Decision                                                                                         | Alternative refused                              | Reason                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Build `Meter` once with `bar`, `ring` and `segments`                                             | A `Gauge` and a `ProgressBar` and a `SegmentBar` | One export covers four fleet hand-rolls; the symbol budget is at its ceiling.                                                                                                                                  |
| D2  | `Meter` and `BarList` live in `basalt-ui/charts`                                                 | `src/dashboard`                                  | They are marks; the charts layer is Mantine-free and token-only, and `src/dashboard` stays chart-free by its own JSDoc. They are not cartesian, so they do not compose `CartesianChart` (as `Donut` does not). |
| D3  | No drag and drop in `Board` v1                                                                   | Ship DnD with the board                          | No consumer moves cards by hand; adopt-or-delete.                                                                                                                                                              |
| D4  | Decision card, entity card, record page, list rows are recipes                                   | Components                                       | Domain anatomy differs per app; promote only when two apps converge.                                                                                                                                           |
| D5  | Hold mono figures                                                                                | Proportional sans figures                        | Identity and column alignment; the reference's figures are not better on the rubric, only different.                                                                                                           |
| D6  | Dense 28 control tier on toolbars only, fine pointer only                                        | 28 everywhere                                    | The pointer floor binds; the toolbar wrap is the only measured cost.                                                                                                                                           |
| D7  | Gutter 24 at expanded only, as a trial                                                           | 24 everywhere, or hold 16                        | 16 was a deliberate earlier decision; the evidence for 24 exists only at 1440.                                                                                                                                 |
| D8  | Card caption becomes mono uppercase with a qualifier slot; `ChartCard` keeps its head-font title | One title style for all cards                    | A figure's label and a chart's title are different jobs; basalt's head font stays a differentiator.                                                                                                            |
| D9  | Scenarios share one dynamic playground route                                                     | One route per scenario                           | Route budget 14/15.                                                                                                                                                                                            |
| D10 | Not built: schedule list, deal and pipeline cards, tick meter                                    | Build for parity                                 | No fleet consumer. Recorded here so a later reference does not reopen them without one.                                                                                                                        |
