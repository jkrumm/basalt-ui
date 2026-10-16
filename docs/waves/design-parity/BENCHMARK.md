# Keel benchmark — measured scales next to basalt's current values

Wave 29, steps 1–3 of `docs/waves/PLAN.md` Part 3. This page is **data, not a spec**: Wave 30 writes the spec and the rubric, so nothing here recommends a design.

- Source: the look-only Keel Workspace capture (no source, no licence; screenshots and measured numbers only). Font family names and every other style value here are computed-style measurements of the rendered page, not font files or stylesheets; no font asset was fetched or committed. Route index: [keel/ROUTES.md](keel/ROUTES.md). Per-pattern crops and geometry: [keel/inventory.json](keel/inventory.json). Raw histograms behind every table below: [keel/scales.json](keel/scales.json). The PNG crops are not in git (public repo, unlicensed benchmark): they live in the gitignored `.design-parity/keel/`. Reproduce with `bun scripts/evidence/keel-capture.ts`. basalt citations point at code (CSS, TypeScript), not comments.
- Keel numbers are computed CSS px at 1440x900 desktop and 390x844 mobile, dark scheme, summed over the 10 captured route views. The histograms are dark scheme only. For each pattern, geometry was compared between dark and light and no difference was found (the inventory notes say so per pattern). Counts in the tables are desktop; the mobile value sets for padding, gap, radius, border, ring and shadow match desktop except that mobile has no 30 px padding, and mobile lacks three type triplets (see the type ramp).
- basalt values are the level-0 defaults, cited as file:line. A "—" means basalt has no equivalent token or the value was not measured here.

## Spacing

Keel's observed values, clustered by how often they occur as padding or as flex/grid gap (count = declarations over all visible elements; the 2 px and 8 px values include icon and chip internals).

| Step (px) | Keel padding uses | Keel gap uses | Where Keel spends it                                                        |
| --------- | ----------------- | ------------- | --------------------------------------------------------------------------- |
| 1–3       | 170               | 458           | 1 px hairline grids, 2 px segmented-control inset, 3 px inline glyph gaps   |
| 4         | 264               | 163           | chip and icon gaps, tight stacks                                            |
| 6         | 510               | 1053          | control gaps, list item inner gap, side-panel row padding                   |
| 8         | 676               | 894           | row padding, grid gap between KPI tiles, kanban column gap                  |
| 10        | 361               | 146           | card vertical padding (kanban 10), row horizontal padding, icon-to-label    |
| 12        | 1371              | 247           | most common padding: card side padding (kanban 12), board and card-grid gap |
| 14        | 54                | —             | decision card and agent card padding                                        |
| 16        | 56                | 3             | KPI card and decision card side padding, stat cell padding                  |
| 20        | 8                 | 9             | gap between decision cards and between page sections                        |
| 24        | 172               | 8             | page gutter (scroll container side padding 24), toolbar side padding        |
| 30–56     | 108               | 2             | large empty regions, sidebar footer                                         |

Concrete component insets (inventory):

| Component                           | Keel                                                                                               | basalt current                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| KPI / metric card padding (t r b l) | 12 16 14 16                                                                                        | 11 13 (vertical 11, horizontal 13), packages/basalt-ui/src/tokens/palette.ts:779,782 |
| Decision card padding               | 14 16                                                                                              | —                                                                                    |
| Agent profile card padding          | 14                                                                                                 | —                                                                                    |
| Kanban card padding                 | 10 12                                                                                              | —                                                                                    |
| Side-panel list row padding         | 6 8 (row), 8 (open-work row)                                                                       | row inset 10 x 6, palette.ts:282,284                                                 |
| Table cell padding (first/last)     | 0 12 / 24 on the first cell                                                                        | —                                                                                    |
| Nav item padding                    | 0 6 0 8, icon gap 8                                                                                | row inset 10 x 6, palette.ts:282,284; nav icon gap 10, palette.ts:388                |
| Page gutter (scroll container)      | 24 sides, 8 top, 32 bottom                                                                         | 16 desktop, 8 mobile, palette.ts:661,670                                             |
| Gap between sibling cards           | 8 (KPI strip), 12 (card grid, board), 20 (decision list, page sections), 6 (cards inside a column) | section gap 12, palette.ts:787                                                       |
| Gap between adjacent controls       | 8 (toolbar), 6 (button inner)                                                                      | 6, palette.ts:807                                                                    |
| Stack rhythm                        | —                                                                                                  | 4 / 8 / 12 / 16 / 24, palette.ts:287–297                                             |
| Generic scale                       | —                                                                                                  | 11 / 13 / 18 / 20 / 26, palette.ts:342–346                                           |

Where they diverge:

- Keel's dominant padding is 12; basalt's card inset is 11 vertical and 13 horizontal, so no single basalt rung equals Keel's card padding.
- Keel's page gutter is 24; basalt's is 16.
- Keel spends 14 and 20 as real steps; basalt's stack rhythm has neither, and its scale (11, 13, 18, 20, 26) does not sit on a 4 px grid.
- Keel has a tight 1.5 px / 2 px / 3 px micro tier (hairline grids, inset tracks, glyph gaps); basalt's step values below 4 are the 1 px hairline, a 2 px prose quote inset and a 1.5 px inline-code inset.

## Type ramp

Size / weight / line-height triplets, ranked by frequency across all visible text (desktop; the mobile ramp is the same list minus three desktop-only sans triplets, 13/400/24, 13/500/16 and 13/600/20, with nothing mobile-only; the other counts are slightly lower).

| Keel size/weight/line-height                  | Uses                    | Role observed                              |
| --------------------------------------------- | ----------------------- | ------------------------------------------ |
| 28/500/34, tracking −0.02em                   | 9                       | page headline                              |
| 20/600/28, tracking −0.012em                  | 1                       | record title                               |
| 20/500/24, tracking −0.02em                   | 37                      | KPI and stat figure                        |
| 16/500/24                                     | 4                       | decision question title                    |
| 14/400 and 14/500, 16 or 20                   | 37                      | section titles, panel titles               |
| 13/500/20                                     | 445                     | row titles, names, emphasised row text     |
| 13/400/20                                     | 718                     | body and row text                          |
| 12/500/16                                     | 236                     | secondary emphasised text, pill labels     |
| 12/400/16                                     | 917                     | meta, muted secondary lines, header labels |
| 11/400 and 11/500, 16                         | 220 (sans 150, mono 70) | chips, counts, times in mono               |
| 10.5/500/14 mono, uppercase, tracking +0.06em | 51                      | KPI and stat captions                      |
| 9.5/400/12 mono, tracking +0.02em             | 5                       | axis and target captions under bars        |

| Keel                                                                        | basalt current                                                                                                                                                                               |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9 distinct sizes (9.5 to 28), 12 recurring size/weight/line-height triplets | Ladder of 11 named sizes, 10 / 11 / 12.5 / 13.5 / 15 / 16 / 18 / 21 / 24 / 26 / 30, packages/basalt-ui/src/tokens/core.ts:128–139                                                            |
| Body 13 / 20 (row and card text)                                            | Body 15 (md), core.ts:133                                                                                                                                                                    |
| Meta 12 / 16                                                                | xs 12.5, core.ts:131                                                                                                                                                                         |
| KPI figure 20 / 24, proportional sans                                       | kpi 24 (core.ts:137), mono, weight 600 (dashboard/widget-header.module.css:174–178)                                                                                                          |
| Caption 10.5 mono uppercase, +0.06em                                        | micro 11 (core.ts:130); table header cells and the group heading are mono uppercase faint, 0.06em and 0.08em tracking, theme/index.ts:1093–1101 and dashboard/widget-header.module.css:86–94 |
| Page headline 28 / 34                                                       | h1 26 (article density), core.ts:138                                                                                                                                                         |
| Weights: 400 and 500 dominant, 600 rare                                     | hero value 600, widget title 550, table header 500, dashboard/widget-header.module.css:177,71 and theme/index.ts:1097                                                                        |
| Line-height mostly 20 on 13 and 16 on 12 (1.54 and 1.33)                    | row line-height 1.35 additive law, palette.ts:1111                                                                                                                                           |
| Figure tracking −0.02em on 20 and 28                                        | hero value tracking −0.02em, dashboard/widget-header.module.css:178                                                                                                                          |

Where they diverge:

- Keel's body is 13 and its meta is 12; basalt's body is 15 and its meta is 12.5, so every Keel row is two to three points smaller than its basalt counterpart.
- Keel's KPI figure is 20, basalt's is 24; Keel's page headline is 28, basalt's h1 is 26.
- Keel runs weight 500 as its default emphasis and uses 600 once; basalt's hero value is 600 and its widget title 550.
- Keel's caption is 10.5 with 0.06em tracking; basalt's micro is 11, with 0.06em on table headers and 0.08em on the group heading. Keel's table header is 12 sentence-case sans; basalt's is micro mono uppercase.
- Both apply −0.02em tracking to the hero figure; Keel also applies it to its 28 headline, basalt's h1 carries none in the ladder (core.ts:138).

## Radius set

| Keel radius (px) | Elements | Role observed                                                            |
| ---------------- | -------- | ------------------------------------------------------------------------ |
| 12               | 129      | cards, panels, tiles, board cards, side panels                           |
| 8                | 536      | buttons, inputs, nav items, list rows, segmented-control track, toolbars |
| 6                | 385      | pills, chips, segmented-control segments, small badges                   |
| 5                | 226      | small icon chips, key hints                                              |
| 4                | 365      | checkboxes, small inline marks                                           |
| 3.5              | 60       | compact marks                                                            |
| 2 / 1.5 / 1      | 1390     | micro bars, meter ticks, progress segments                               |
| pill (9999)      | 432      | avatars, dots, round gauges, scrollbar thumbs                            |

| Keel                                                                   | basalt current                              |
| ---------------------------------------------------------------------- | ------------------------------------------- |
| Card 12                                                                | card 7 (card = 7 + level), palette.ts:197   |
| Control 8                                                              | ctrl 6 (ctrl = 6 + level), palette.ts:198   |
| Chip and segment 6                                                     | tight 5 (ctrl − 1), palette.ts:203          |
| Small mark 4–5                                                         | fine 4 (ctrl − 2), palette.ts:204           |
| Popover / floating (shadow 0 12 28 −6; radius not measured separately) | floating 8 (card + 1), palette.ts:202       |
| Pill                                                                   | pill 9999, palette.ts:252                   |
| —                                                                      | scale stops 2 / 16 / 32, palette.ts:245–249 |

Where they diverge:

- Keel's card radius is 12 against basalt's 7; Keel's control radius is 8 against basalt's 6. Every anchor is 2 to 5 px larger in Keel, and the anchor gap card minus control is 4 in Keel and 1 in basalt.
- Keel has a populated 3.5 to 6 px tier (pills, chips, segments); basalt has the same three tiers numerically (4, 5, 6) but they hang off the control anchor, not the card.

## Border and divider treatment

| Keel (counts over all visible elements)                                                                                                               | basalt current                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card edge: a 1 px ring drawn with a zero-blur box-shadow (1 px ring on 1328 elements, 1.5 px on 61, 2 px on 14); real CSS borders on only 71 elements | Card edge: a shadow-card token whose value carries the ring, tokens/core.ts:256,403; the hairline surface token is the card ring only, tokens/core.ts:274 |
| Drop shadows (offset x y, blur, spread): 0 1 2 0 (25), 0 1 1 0 (12), 0 2 6 −1 (10); which element each belongs to was not traced                      | shadow-card, packages/basalt-ui/src/tokens/core.ts:256,403                                                                                                |
| Large floating shadow: 0 12 28 −6 (10), 0 12 32 −8 (1)                                                                                                | —                                                                                                                                                         |
| Row and header dividers: a 1 px inset shadow on the row's bottom edge (524 uses), colour role hairline-subtle                                         | Table separators use the hairline surface token (theme/controls.module.css:291); row and header heights set in theme/index.ts:1094,1102                   |
| Stat strip: four cells separated by 1 px gaps over a faint fill                                                                                       | —                                                                                                                                                         |
| Ring colour role: hairline-subtle (cards, inputs), hairline-default (secondary buttons, pills)                                                        | ring colour is the hairline surface token, tokens/core.ts:274                                                                                             |
| Focus: not measured                                                                                                                                   | —                                                                                                                                                         |

Where they diverge:

- Both systems draw the card edge as a ring inside the shadow rather than a border; the construction matches.
- Keel's row and header dividers are 1 px inset shadows in the subtle hairline role; basalt's are table borders in the hairline surface colour, width not measured here.
- Keel has a second ring weight (1.5 px, 2 px) for emphasised and selected states (61 and 14 uses); basalt's ring is a single weight.

## Density

| Measure                                                | Keel                                                  | basalt current                                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Table row height                                       | 40 (companies, people)                                | 40, theme/index.ts:1102 from palette.ts:820                                                         |
| Table header height                                    | 36                                                    | 36, theme/index.ts:1094 from palette.ts:817                                                         |
| Grouped list row (work list)                           | 36                                                    | —                                                                                                   |
| Table rows fully visible in 900 px (companies, people) | 17 (toolbar 48, tabs 40, header 36 above them)        | —, not measured here                                                                                |
| Table rows fully visible in 844 px, mobile             | 16 (the table scrolls sideways, first column pinned)  | —                                                                                                   |
| Controls (button, input, toolbar)                      | 28                                                    | ctl 32, palette.ts:323; md 42, palette.ts:262; tag 20, palette.ts:309; widget 24, palette.ts:312    |
| Nav item                                               | 28                                                    | 2 x 6 row inset plus a 1.35 line height at 15 px is about 32, palette.ts:284 and :1111, core.ts:133 |
| KPI card height                                        | 131 (width 149–229)                                   | —                                                                                                   |
| Decision card height                                   | 164 (with preview pane), 3 visible in 900 px          | —                                                                                                   |
| Agent profile card                                     | 330 (width 373)                                       | —                                                                                                   |
| Kanban card                                            | 104–114 (180 with a preview), 6 to 8 per column       | —                                                                                                   |
| Deal card                                              | 84–120                                                | —                                                                                                   |
| Timeline event                                         | 60–86                                                 | —                                                                                                   |
| Activity item                                          | 52                                                    | —                                                                                                   |
| Meeting item                                           | 54                                                    | —                                                                                                   |
| Sidebar                                                | about 240 wide, section labels 10.5 mono              | 256 wide, 48 rail, palette.ts:631,635                                                               |
| Right column                                           | 380–384 wide                                          | 300 wide aside, palette.ts:644                                                                      |
| Top bar above content                                  | 48 (inside the rounded shell; content starts at y 56) | 44, palette.ts:620                                                                                  |

Where they diverge:

- Table rows and headers have the same height in both (40 and 36). Keel's controls and nav rows (28) are 4 px shorter than basalt's ctl tier (32); its 20 px chips equal basalt's tag tier (20).
- Keel's card heights are driven by content (a preview pane beside the text, a stat panel inside the card); basalt's StatCard and ChartCard are the only card shapes with a documented height behaviour.
- Keel's right column is 80 px wider than basalt's aside.

## Chart-in-card conventions

Observed on the KPI strip, the decision-card preview panels, the agent stat panel and the record stat strip. Counts come from the 6 inline charts found at desktop; the others are drawn with plain boxes.

| Convention          | Keel                                                                                                                                                          | basalt current                                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Axes                | none on sparklines and gauges; the one larger preview chart has no axis lines and a single short mono label on its threshold line                             | axis font micro 11, tokens/core.ts:148                                                                                                                                                                                   |
| Gridlines           | none; one reference line with a label where a target exists                                                                                                   | neutral grid at 7% ink (light) and 6% white (dark), tokens/palette.ts:1212                                                                                                                                               |
| Sparkline height    | 22 (KPI tile), 24 (record stat), 57 (decision preview), 61 (ring gauge); tile height 131                                                                      | 26, packages/basalt-ui/src/dashboard/stat-card.module.css:140                                                                                                                                                            |
| Stroke              | 1.5 px line, 2 px dashed ring and ticks, up to 6 px on gauge arcs                                                                                             | 2.5 primary, 2 secondary, core.ts:146–147                                                                                                                                                                                |
| Area under the line | a soft single-hue fill on the trend line, none on gauges                                                                                                      | single-hue gradient built with color-mix on the area-top variable, charts/compile.ts:372                                                                                                                                 |
| End marker          | a filled dot at the last point of a trend line                                                                                                                | —                                                                                                                                                                                                                        |
| Unit placement      | unit directly after the figure on the same baseline in a smaller muted size (13 against 20); currency symbol attached to the number; compact K and M suffixes | unit prop rendered right after the value on the hero row: mono, 13.5, weight 500, muted, baseline-aligned (dashboard/stat-card.tsx:464, dashboard/widget-header.tsx:304–305, dashboard/widget-header.module.css:188–195) |
| Qualifiers          | right-aligned on the caption row (period, target), 12 sans muted or 10.5 mono caps                                                                            | —                                                                                                                                                                                                                        |
| Delta               | arrow glyph plus a small figure, 11–12 px, sign always shown, coloured text with no fill                                                                      | glyph plus mono figure in the status colour on a 13% tinted fill, dashboard/delta-badge.tsx:70                                                                                                                           |
| Legend              | none inside tiles; segmented bars carry two or three mono captions at their ends and under their segments                                                     | legend font sm 13.5, gap from the spacing table, core.ts:161                                                                                                                                                             |
| Figure style        | proportional sans at 20 with negative tracking; mono reserved for captions, times and axis labels                                                             | mono at 24, weight 600, tracking −0.02em, dashboard/widget-header.module.css:174–178                                                                                                                                     |
| Colour in the chart | one accent per series (agents are told apart by a fixed set of five hues reused across charts); neutral track behind the fill                                 | —                                                                                                                                                                                                                        |

Where they diverge:

- Keel draws sparklines at 22 px with a 1.5 px stroke and no axes or grid; basalt's sparkline slot is 26 px and its line weights are 2.5 and 2.
- Keel sets numerals in proportional sans and keeps mono for captions and times; basalt sets the hero value in mono.
- Keel and basalt both place the unit inline after the figure in a smaller muted size; Keel's is 13 sans against a 20 figure, basalt's is 13.5 mono against a 24 figure.
- Keel puts a mono uppercase caption row above each figure with the qualifier on its right; basalt's widget heading is a sentence-case head-font title at 13.5 muted (dashboard/widget-header.module.css:79–82) with the delta on the value row.
- Keel's delta has no fill; basalt's delta badge sits on a tinted fill (dashboard/delta-badge.tsx:70).

## Pattern coverage in the inventory

30 measured patterns, each cropped at desktop and mobile in dark and light (120 crops). Unverified: a loading state, which could not be observed (see [keel/ROUTES.md](keel/ROUTES.md)); the inventory carries it as a thirty-first entry with status unverified and no crops. The compare harness (Wave 29, step 4) and the baseline board (step 5) read the inventory; the gap audit (Wave 30) scores each pattern.
