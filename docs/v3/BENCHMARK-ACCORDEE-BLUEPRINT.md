# Basalt UI v3: Accordee and Blueprint benchmark

Date 2026-11-21, master at `f6190ba48`. Ten read-only studies. Six are browser teardowns of the public Accordee demo, named `shell`, `tables`, `records`,
`comms`, `workflows` and `settings` below, each at 1600x1000 in light and dark and at 390x844. The other four read
Accordee's docs, its library, the Blueprint source on `develop`, and this tree. The ten reports and about 450
screenshots stay outside git. Section 10 lists what was not checked.

**Verdict.** A consumer cannot build Accordee's screens with v3 today, and missing parts are the smaller half of the
reason. Three structural choices block it: the surface model, the page chrome and the overlay model. Settle those
before the freeze, together with the block tier, which moves recipes and adds a CLI verb. Everything else is
additive and fits 3.x minors.

- **Engine: basalt is ahead.** URL state, server modes, virtualisation, typed column kinds, 19 lint ids and a rendered
  design check have no counterpart in Accordee. Its tables render every row (236 on Invoices), and its note and task pop-ups have no
  URL.
- **Product design: Accordee is ahead.** One surface model and one page grammar carry 40 screens. Breadth follows from
  that: record windows, saved-view tabs, boards, a calendar, a workflow builder, deep settings.
- **Blueprint:** five mechanisms are worth taking (section 5). Its styling layer is not.
- **Distribution:** no public registry. Add a block tier on the ledger `eject` already has (section 6).

**Filed 2026-11-21.** The owner approved the direction the same day. The first rows are `bench-*` in `docs/plan.yaml`;
their decisions, which settle the five calls below with defaults, are in `docs/v3/issues/bench/README.md`.

**Five calls were the owner's.**

1. **The surface model** (3.1): a frame and one work surface, replacing the single grey plane with floating cards.
2. **Kill-list reversals** (section 4): column resize, row height per view, a user group-by, `Board`.
3. **The overlay set** (3.3): which of seven side-surface names survive the freeze.
4. **The block tier** (section 6).
5. **Runtime theme attributes** (3.4): whether density, accent and layout are public attributes a user can switch.

The view row (3.2) needs no call. It is implementation work on the defaults stated there.

## 1. What Accordee's look is made of

Eight rules, measured in the demo. The parts follow from them.

| Rule               | Accordee                                                                                                                                                                                            | basalt v3 today                                                                                                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planes             | A `#fafafa` frame carries the sidebar. One white panel holds the work: inset 8 px, radius 8, 1 px border at 10% black. A "Classic" layout makes the panel flush                                     | One `bg-background` plane for rail, header and main (`shell/parts/grid.tsx`). Hairlines divide it: `border-e` on the rail, an `after:h-px` rule under the header. Content turns white only inside a card |
| Page chrome        | Two 44 px rows inside the panel. Row 1: breadcrumb, and close, previous, next on a record; global tools right. Row 2: tabs with counts left; search, filter, edit view and one primary button right | A 48 px header on the frame with breadcrumb and the page's claimed actions. Tabs are a segment in the `PageBar` band, saved views a popover, filters `FilterSet` pills: three places                     |
| Lists are the page | The table runs edge to edge in the panel: cell hairlines, 40 px rows, sticky header, sticky first columns, sticky footer                                                                            | The table sits in a card on the grey plane. In the expression-18 n87 shot it is a card inside a card                                                                                                     |
| Cards              | 1 px border, radius 8, no shadow, on white. Only dashboard tiles and settings groups are cards                                                                                                      | Borderless white cards on grey, for every block of content                                                                                                                                               |
| Type               | 13 and 14 px working sizes, weights 400 and 440 only. Size and colour carry hierarchy                                                                                                               | `font-medium` 50 times and `font-semibold` 19 times across shell, page, cards and primitives                                                                                                             |
| Overlays           | No scrim on desktop. A drawer is an `aside` inside the panel, resizable, its width remembered. A record opens as pop-up, drawer or full screen from one Layout menu. Only wizards block             | `Dialog` and `Sheet` are modal on `bg-scrim`. `Peek` is the one non-modal, resizable overlay                                                                                                             |
| One ladder         | Controls 28, 30, 32; rows 40; bars 44; icons 16                                                                                                                                                     | `h-ctl` and a 24 px `sm`; rows 32, 40, 48 by density                                                                                                                                                     |
| User preferences   | Appearance, 7 accents, density (spacing times 0.84), layout and 6 fonts, written to `html[data-*]` at runtime                                                                                       | Scheme at runtime. Accent, neutral and vibrancy at build time                                                                                                                                            |

**The shell edges.** The owner dislikes the lines toward the sidebar and the top. Accordee has more edges there, not
fewer: a full border around the panel. My reading of why it looks calmer: its border wraps one surface, while ours
cuts one plane into three regions that share a colour.

**Where Accordee is weaker.** Do not copy these.

- No virtualisation or paging, no inline editing, no row actions.
- Record pop-ups keep no URL (invoices alone use `?open=`), and Esc does not close them.
- Three focus treatments, and 32 and 36 px controls on one settings page.
- Contrast is checked by hand. Phones get a hamburger sheet and no tab bar.
- The workflow builder has no undo. The agent skills shipped on 2026-11-20 with five lint rules and no rendered check.

## 2. Can a consumer build it

S is structural (section 3), D was cut by decision (section 4), A is additive.

| Screen family         | Today  | basalt has                                                                                                    | Missing                                                                                                                                                                                                                                                   |
| --------------------- | ------ | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell and nav         | No     | `defineNav` groups and badges, 64 and 240 px rail, palette, user menu, header tiers, phone tab bar            | S: work surface; the frame is closed (`./shell` exports 5 values, no slots, composites never eject). A: workspace switcher, favourites, user-ordered nav, resizable rail                                                                                  |
| Dashboard             | Yes    | Chart kinds, `ChartCard`, `StatCard`, `CardGrid`, `ViewTabs`                                                  | A: a grid the user rearranges. Low priority; the owner rates our cards and charts level or better                                                                                                                                                         |
| List page             | Partly | Engine, 14 column kinds, selection and `BulkBar`, reorder and hide, footers, cards on a phone, `look: 'grid'` | S: edge-to-edge table, view row. D: column resize, row height per view, group-by. A: saved views as tabs with a manage-view panel, sticky first columns, footer aggregate that cycles on click, cell kinds for a person, tags, a countdown, a logo entity |
| Board, gallery        | No     | `KanbanCard`, `CardGrid`, recipes `board` and `view-switch`                                                   | D: `Board`. A: drag and drop (the package has no drag dependency), gallery                                                                                                                                                                                |
| Record preview        | Partly | `Peek`: non-modal, resizable, `?peek=`, pin, full-page link                                                   | S: one record surface in three presentations; `Dialog` ends at 672 px, so no record window and no 1100x700 wizard. A: header actions, previous and next, minimise; `Sheet`, `Dock` and `PageAside` have fixed widths                                      |
| Record page           | Mostly | `Page`, `SplitPage`, `PageSummary`, `Facts`, `Section`, `Tabs`, `EventList`, `recordAt`                       | A: avatar and entity chip, tabs with counts, previous and next (the property list that edits in place is `PropertyList`, the band's identity is `PageBar` `identity`)                                                                                     |
| Inbox, mail, messages | Partly | `SplitPage`, `RowList`, `Resizable`, recipe `two-pane`                                                        | A: avatar, a row with unread dot and hover checkbox, remembered split width, composer, thread                                                                                                                                                             |
| Calendar              | No     | `DatePicker`, `IntervalTrack` (read-only)                                                                     | A: calendar primitive, week, month and day views, mini month                                                                                                                                                                                              |
| AI chat               | Partly | `partView`, `defineBlock`, `defineCatalog`, nine recipes                                                      | A: composer, reasoning trace, model picker and mentions as parts                                                                                                                                                                                          |
| Workflow builder      | No     | `ChainView` (read-only, pan and zoom)                                                                         | A: pan and zoom canvas with hand and pointer tools, group cards, connectors                                                                                                                                                                               |
| Settings              | Mostly | `FormSection`, `FormField` layout `row`, `FormFooter`, `InnerNav` with a filter                               | A: choice cards, checkbox matrix, tag input, one-time code, swatch picker, sortable list                                                                                                                                                                  |
| Themes                | No     | `setScheme`                                                                                                   | S: runtime attributes (3.4)                                                                                                                                                                                                                               |
| Sign-in, onboarding   | Partly | `Stepper`, the form layer                                                                                     | A: split wizard dialog with a live preview pane, one-time code                                                                                                                                                                                            |

**The workflow builder is not a node graph.** Accordee's builder is a CSS grid of three columns holding eight
collapsible group cards, one SVG layer of 1.5 px elbow edges, and a `transform` for pan and zoom. No canvas library,
no free nodes, no marquee, no mini-map. A clicked row selects nothing; the side panel is workflow-level. That is a
card layout with connectors, and it is in reach: a pan and zoom surface, a group card and a connector layer.

## 3. Structural items, before the freeze

### 3.1 Surface model

`AppShell` gains a work surface: main becomes one white surface, the rail and the brand zone stay on the frame tint,
and a `frame` option picks `panel` (inset) or `flush`. The identity row moves inside the surface. Cards on the
surface take a hairline instead of contrast against a grey ground, and a list page lets its table run edge to edge.

This changes the ground under every card, section and table, and it changes the reviewer rubric. It is the item a
3.x minor cannot deliver without a visible break in every consumer. Build the n87 page both ways and let the owner
pick: basalt has not shown this look yet.

### 3.2 Page chrome

`PageBar` gains the list-page row: tabs with counts left, search, filter, view and one primary action right, in one
44 px line. A tab is a saved view or a named filter; the `ViewStore` port already carries saved views. Accordee
refactored 16 list pages onto one `ToolbarTabs` component before it could lint the pattern.

### 3.3 Overlay model

Record work is non-modal by default. One record surface presents as `peek`, `window` or `page`, the user switches
and the choice persists. Keep `?peek=`: an addressable overlay is our lead. The header contract grows to title, tag,
actions, previous and next, presentation menu, close. `Dialog` gets a size above 672 px and a split form for wizards.

Seven names cover side surfaces today: `Peek`, `Dock`, `PageAside`, `Sheet`, `PreviewCard`, `OverlayHost`,
`DetailHost`. The owner reads them as one confusing family. Decide the set before the names freeze.

### 3.4 Runtime theme attributes

`data-density` already moves `--basalt-ctl-h` and `--basalt-row-h` at `<html>` or any subtree, and nothing switches
it. Radius has no knob in 3.0 (`tokens/table.ts:341`). Decide whether density, a panel or flush layout and a set of
pre-derived accents are public attributes. Derivation stays at build time, so `derive.ts` still
guarantees the contrast of each accent.

## 4. Kill-list reversals

`docs/v3/concepts/data-table.md` line 341 and the cards concept cut these for zero consumers. Accordee shows the
product shape that needs four of them.

| Cut                               | Accordee                                                                                                                                        | Recommendation                      |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Column resize                     | 7 px handle, double-click resets, width saved per view                                                                                          | Reverse                             |
| Per-table density                 | Row height 32, 40 or 52 per saved view                                                                                                          | Reverse, as a view property         |
| User group-by                     | A row in the manage-view panel; group rows collapse                                                                                             | Reverse                             |
| `Board`                           | Customers, contracts, leads and tasks as boards with counts and totals; dnd-kit attributes in the DOM (`tables`), the drag itself not exercised | Reverse; needs a drag-and-drop peer |
| `DataGrid`, other cell editors    | None: a double click opens the record                                                                                                           | Keep cut                            |
| Nested filter builder, operators  | Chip groups in a popover, no builder                                                                                                            | Keep cut                            |
| Multi-sort, export in the grammar | Single sort; CSV export as a menu entry                                                                                                         | Keep cut; the export recipe stays   |

## 5. Blueprint: five mechanisms

Core 6.23.2 on 2026-11-19, 391 commits to `develop` in twelve months, a move from Sass to
`--bp-*` tokens in OKLCH. Its `llms.txt` is a list of links into a hash-routed site.

1. **One closed vocabulary on one ladder.** `size`, `variant`, `intent` and `fill` mean the same on every control,
   at 24, 30 and 40 px. A button, an input, a select and a tag line up without tuning. Ours: `Button` has `md` and
   `sm`. Audit that every control shares the names and the heights. This is most of what reads as unfinished in our
   form items.
2. **Two kinds of group.** One control with parts (a leading and a trailing slot: `Input` has `start` and `end`)
   and several controls shown as one (`ButtonGroup` fuses edges, `ControlGroup` keeps 2 px). `PageBar` fuses
   action groups privately (`page-action-group`). Promote that to a public group that sets size and variant for its
   children through CSS variables, so a child can still opt out. Blueprint's class cascade cannot.
3. **One list engine behind four shells.** `Select`, `Suggest`, `MultiSelect` and `Omnibar` share `QueryList`:
   items as data, a renderer that receives `{ active, disabled }`, a create-item row. Add what Blueprint lacks:
   groups as data, async items, virtual rows. Then `Select`, `Combobox` and the command palette render one option
   the same way.
4. **A panel kit.** `Section`, `SectionCard`, `CardList`, `ControlCard`, `EntityTitle`, `CompoundTag`. We lack
   three: the choice card (Accordee's radio cards), the entity title (avatar, title, subtitle, tags: also the record
   header and the table's entity cell) and the key-value tag.
5. **A measured overflow list.** One primitive with `collapseFrom` and `minVisible`. We fold header tiers,
   `FilterSet` `+N` and the `PageBar` "more" menu separately.

Not worth taking: Sass theming and the `bp6-` class namespace, modifiers a child cannot undo, measured slot widths,
the doubled component generations (`Popover` and `PopoverNext`), a table with no sorting or paging.

## 6. Distribution: blocks, not a registry

The verdict of `primitives-distribution.md` section 8 holds. The registry format has no version and no lockfile, and
`add --overwrite` destroyed four of four edits.

Accordee points at a different gap. An inbox pane, a record window, a workflow builder, a week calendar and a wizard
dialog are too product-shaped to freeze as npm API, and a consumer will want to edit them. Today that tier is 32
recipes: markdown with code to copy, which no compiler checks. `board.md`, `two-pane.md`, `saved-views.md`,
`view-switch.md` and the three `chat-thread` files are components written as prose.

| Tier        | Lives in                                                                                                | Changes by                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Primitive   | npm, `basalt-ui/ui/<name>`                                                                              | Upstream, or `eject` per file                                                                                   |
| Composite   | npm subpaths                                                                                            | Upstream only                                                                                                   |
| Block (new) | Source in the package, installed into the app by the CLI, tracked in the eject ledger with a merge base | The consumer edits it; `sync` merges three ways; a block two consumers run unchanged is promoted to a composite |
| Recipe      | Markdown                                                                                                | Shrinks to wiring notes                                                                                         |

A block typechecks in CI, renders in the playground and answers "which page do I copy" for an agent. It is also the
unit of a later library site. Upstreaming stays the default for primitives and composites.

## 7. Agent layer and docs

| Accordee                                                                                                                                               | basalt today                                                             | Take                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Catalog generated from `@catalog Use for / Don't use for` tags, 116 entries, fails the gate when stale                                                 | 187 per-export docs with `use when` and `never when`                     | Have it                                                    |
| An exemplar per archetype: "a list page copies Invoices, a record page copies a lead"                                                                  | Recipes; `basalt-design` picks a form                                    | Yes: one reference page per archetype, delivered as blocks |
| `house-rules.md` outranks the skills; a `learn-taste` skill appends a dated line after each correction and says so                                     | The consumer's `DESIGN.md` tops the precedence, and nothing writes to it | Yes, cheap                                                 |
| Gate: lint with five rules, a colour scan, a baseline of old violations                                                                                | 19 ids, `shot`, the reviewer                                             | Ahead                                                      |
| Docs route by table (To change, Open); prompts are printed with the expected result; each tool page is stamped with the tool version it was checked on | None of the three                                                        | Yes, with the docs site                                    |
| Library: 206 entries on one template, a live isolated preview each, a numbered "Try it", cross-links with a reason, no code                            | None                                                                     | After 3.0; it needs an isolated preview route per block    |

## 8. Order of work

**Before the freeze.**

1. Surface-model spike on the n87 page, both ways, for the owner.
2. The view row in `PageBar`, saved views as tabs.
3. The record surface, the overlay name set, the larger `Dialog`.
4. The runtime-attribute decision.
5. The block-tier decision.
6. `Avatar` and an entity title: small, and they touch table kinds, the shell and record headers.

Trial 2 judges the look. Run the spike first, or the trial tests a surface about to change.

**3.x minors, by what the fleet and the factory need.** `Board` with drag and drop; the three table reversals;
control groups and the list engine; the calendar; the canvas with group cards and connectors; chat parts as blocks;
choice card, checkbox matrix, tag input and one-time code; the library site.

**Out.** Whiteboard, network map, map view, a user-arranged dashboard grid, the invoice editor, a runtime font choice.

**Against the stock-take.** `STOCKTAKE.md` found that the design holds and needs no second restructuring. That stands
for the engine and the API shape. It does not stand for the look: sections 3.1 to 3.3 join its freeze list.

## 9. Stale docs found, not fixed

- `.claude/rules/basalt-tokens.md` and the root `AGENTS.md` describe radius and density as configuration; radius has
  no knob in 3.0.
- `llms.txt` is stamped v2.29.0.
- `recipes/file-drop.md` says no upload primitive exists; `FileUpload` ships.
- The header of `table/core/features.ts` says reorder is absent; it ships.
- The root `AGENTS.md` counts six shipped rule files; there are five.

## 10. Not checked

- Accordee's source is private. Its structure, skills and lint rules are quoted from its docs.
- The reports are agent claims. I looked at 26 screenshots and re-read six basalt claims in source: the `./shell`
  exports, the shell grid, the `Dialog` sizes, the table kill list, the radius comment, the missing avatar primitive.
- Drag and drop, empty and loading states, and reduced motion in the demo were not exercised.
- Whether `Combobox` groups or virtualises its options: its doc names async only.
- Our type scale was counted by class name, not measured in a browser.

## 11. Results: the reference pages, 2026-11-23

After the `bench-*` rows, five reference pages were built from shipped parts only (Issue 3079). They use one parts-inventory
domain with a fixed today, in `apps/playground/src/routes/ref/`: a parts list, a notes list, a supplier record, a
create flow and a settings page. They compile on the playground's app lint preset with zero `basalt/*` waivers and no
`c.custom` column. `basalt-design` names each one as the page to copy for its archetype.

"Buildable" here means a consumer can build the family from shipped parts, without a waiver or a custom column.

| Screen family         | Now    | Built as                                                                                                                                                                                                                                                                                                                                                                                                                                         | Gaps filed                                                                                                                                                                                                                              |
| --------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell and nav         | Yes    | Every page sits on the work surface and in one `defineNav` group                                                                                                                                                                                                                                                                                                                                                                                 | None; the section 2 additive items were not exercised                                                                                                                                                                                   |
| Dashboard             | Yes    | Not rebuilt; unchanged since section 2                                                                                                                                                                                                                                                                                                                                                                                                           | None                                                                                                                                                                                                                                    |
| List page             | Yes    | `/ref/parts`: saved views as counted tabs, a flush summary strip, a grid with a sticky identity column, person, tags, status and countdown cells, group-by, a footer sum, the manage-view panel and a bulk bar                                                                                                                                                                                                                                   | None open: 3086 landed during the row, so search, filters, layout and the primary share the view row                                                                                                                                    |
| Board, gallery        | Yes    | The same parts as a board by replenishment and as a gallery, each a saved view                                                                                                                                                                                                                                                                                                                                                                   | 3088: the board's and gallery's loading, empty and error frames fall back to the table                                                                                                                                                  |
| Record preview        | Yes    | `/ref/notes`: a typed-icon title, a quiet preview and linked records with no tick column; a row opens as a side panel, a window or the page, with previous and next                                                                                                                                                                                                                                                                              | None                                                                                                                                                                                                                                    |
| Record page           | Mostly | `/ref/suppliers/$id`: identity with a face, properties, tabs with counts over related lists, an activity feed                                                                                                                                                                                                                                                                                                                                    | 3087 landed: the band names the supplier once with its face, subtitle and tag (`PageBar` `identity`), and its properties edit in place (`PropertyList`); 3092 landed, but the breadcrumb link is still 20 px tall (followed up in 3091) |
| Inbox, mail, messages | Mostly | `/ref/mail`, the `mailbox` block: folders as counted tabs, `MailList` rows with an unread dot, a star, an order chip and a face that turns into a checkbox, period headers that stick over a windowed list, a list the reader widens (`SplitPage` `resize`, remembered), `MailThread` with one message open and file cards, the `Composer` under the thread or as a panel, window or page, a draft kept on the device, and a list-form `BulkBar` | Messages as a channel view is the chat parts' row; the composer's body is one line tall until typed in, `Composer` has no row floor                                                                                                     |
| Calendar              | Yes    | `Schedule` on `basalt-ui/cards` with week, month and day views, over the `calendar` primitive (PR #1271); status as of 2026-11-24                                                                                                                                                                                                                                                                                                                | None                                                                                                                                                                                                                                    |
| AI chat               | Yes    | Composer, mentions, model picker and trace parts on `basalt-ui/ai` (PR #1276); status as of 2026-11-24                                                                                                                                                                                                                                                                                                                                           | None                                                                                                                                                                                                                                    |
| Workflow builder      | Partly | `FlowCanvas` on `basalt-ui/cards` and the builder reference page (PR #1270); status as of 2026-11-24                                                                                                                                                                                                                                                                                                                                             | None                                                                                                                                                                                                                                    |
| Settings              | Yes    | `/ref/settings`: an inner nav of panes, bordered sections of rows, choice cards, a checkbox matrix, a tag input, an export row and a danger row                                                                                                                                                                                                                                                                                                  | None                                                                                                                                                                                                                                    |
| Themes                | No     | Not in scope; runtime attributes are still the open decision of section 3.4                                                                                                                                                                                                                                                                                                                                                                      | None                                                                                                                                                                                                                                    |
| Sign-in, onboarding   | Partly | The create flow: a new purchase order in the split wizard dialog with a live preview and a review step                                                                                                                                                                                                                                                                                                                                           | None for the wizard; sign-in itself was not built                                                                                                                                                                                       |

**The look, measured.** The design reviewer scored the last shot round of the five pages: 1800 and 390, light and
dark, every state, the open note panel and the wizard dialog included. It marks no P0. Every P1 it still marks comes
from inside a shipped part or the shot runner, not from how the pages compose them:

- 16 px hit areas on ticks, radios and steppers.
- Overlapping text boxes in the flush stat cell and the table cells.
- Nested radii in the board.
- A grid's state body clipped at its pinned edge.
- Board and gallery states drawn as a table.
- Default state copy with no cause.
- A full-height peek under a short record.
- Four type sizes in the wizard.

`/kit/layouts` and `/kit/forms/choices` raise the same part findings, filed together as 3088. The runner cropped
state frames under an open dialog, fixed on master as 3093. The quality matrix passes the reference routes with three known entries,
each filed against its part (3091). A neutral delta's contrast (3090), the runner's overlay anchors (3089), the view row
(3086) and most of the part findings (3088) were fixed on master while these pages were built.

**What the pages show about the parts.** One gap still matters for the Accordee look, and it is page chrome: the record page names its record twice
(3087). The list page needed a second row for search and filters until 3086 landed. The engine,
the column kinds, the views and the form parts held without an escape.
