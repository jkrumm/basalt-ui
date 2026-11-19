# Research: data grids for working data

Verdict: basalt takes the grid look as an option of the one `DataTable` (`look: 'grid'`), with rules on both axes, a compact row, tabular figures, a sideways scroll with the identity column pinned, and APG cell focus by arrow keys. Columns move by drag and by keyboard, and the order lives in the display state beside visibility, so it survives a reload and rides in a saved view. Users pin columns to the start in the grid look. Resize stays out. Every product studied resizes; basalt's widths are a law of the kinds (`ch` x 8 px + 24 px), and that law is what makes the tiers right in server HTML with nothing measured.

The page answers owner review 2 (2026-11-19, plan row `v3-owner-2-table-grid`): "a real data table (with borders, like Excel or Blueprint) for real data, or tables like we have now for just visualizing". The study ran on 2026-11-19 as four `agw research` runs (deep), one per product pair; every claim below comes from a source listed at the end, and each run's unverified points stay marked as such.

## What each product does

| Pattern           | Blueprint                                                                   | Glide                                                               | AG Grid Community                                                                         | MUI X (MIT)                                            | TanStack examples                          | Mantine React Table                    | Airtable grid                                           | Linear issue list                    |
| ----------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------ | -------------------------------------- | ------------------------------------------------------- | ------------------------------------ |
| Header cell       | name, reorder handle, menu chevron you fill, resize edge; no sort or filter | title, icon, menu arrow you draw                                    | sort mark, resize edge, filter button; the column menu is Enterprise                      | sort, three-dot menu on hover (sort, filter, hide)     | plain text, pin buttons, resizer           | actions menu per header, sort on click | menu on the field name: hide, insert, delete            | sort by column on project lists only |
| Rules and density | rule styling not verified; rows 20 px                                       | `verticalBorder` per column plus a separate `horizontalBorderColor` | `rowBorder`, `columnBorder`, header borders as theme params; spacing scale                | `showCellVerticalBorder`; three densities, user toggle | none                                       | density toggle xs, md, xl              | four row heights, Short is the default                  | none documented                      |
| Column reorder    | drag, off by default; no keyboard                                           | drag; app applies the move                                          | drag, and Shift+Left/Right on a focused header                                            | Pro only, drag                                         | dnd-kit drag with a default KeyboardSensor | drag; not on touch                     | drag the header or the grip in Hide fields; no keyboard | none for columns                     |
| Resize            | on by default, double-click autosizes                                       | drag with start, move, end callbacks                                | drag, and Alt+Left/Right                                                                  | tier unclear (Pro on the licensing page)               | drag, double-click reset                   | drag                                   | drag the edge                                           | none                                 |
| Pin               | `numFrozenColumns` prop only                                                | `freezeColumns` prop only                                           | `pinned` prop, or drag to the edge; menu pin is Enterprise; pinned width capped           | Pro, from the menu                                     | `columnPinning` state, sticky offsets      | `enablePinning`                        | drag a divider, up to three fields                      | none                                 |
| Hide              | do not render the column                                                    | remove the column                                                   | `hide`, drag out of the grid; chooser is Enterprise                                       | menu item and a columns panel                          | visibility checkboxes                      | menu and a columns menu                | "N fields hidden" button, auto-saved                    | display properties                   |
| Selection         | regions: cells, rows, columns                                               | cells, ranges, rows, columns                                        | rows; cells and ranges are Enterprise                                                     | one row; multi is Pro, cells Premium                   | rows                                       | rows                                   | cells and ranges, row checkbox                          | rows, X and Shift                    |
| Keyboard          | arrows move the focused cell; Shift extends                                 | full table: arrows, Ctrl, Shift, Page, Escape                       | arrows, Home/End, Page, Enter or F2 edits, Space selects; Up from row 1 enters the header | arrows, Home/End, Ctrl+Home/End, Page; Tab not handled | none                                       | none documented                        | arrows, Shift+arrows, Enter or F2, Escape               | Up/Down or J/K on rows               |
| ARIA              | root `tabIndex` 0, no role seen                                             | hidden table mirrors the canvas                                     | `grid`, `gridcell`, `aria-colindex` over hidden columns                                   | `rowheader` option                                     | none                                       | none documented                        | `role=application`, one tab stop                        | none documented                      |
| Frozen rows       | `numFrozenRows`                                                             | none                                                                | pinned rows from data                                                                     | Pro                                                    | not read                                   | sticky header and footer               | header only                                             | sticky group headers                 |
| Narrow width      | none                                                                        | touch-aware selection                                               | touch gestures; no responsive mode                                                        | none found                                             | sideways scroll                            | no touch reorder                       | grid on mobile with cuts                                | native apps                          |
| Persistence       | controlled props, app stores                                                | controlled props, app stores                                        | `getState`/`setState` with a version; app stores                                          | `exportState`/`restoreState`; app stores               | JSON state; app stores                     | "not a built-in feature"               | per view, collaborative or personal                     | per view; URL carries view options   |

The WAI-ARIA APG grid pattern is the keyboard reference: one tab stop for the grid, the arrows move one cell and stop at the edge, Home and End go to the row's ends, Ctrl+Home and Ctrl+End to the grid's corners, Page Up and Page Down by an author-set count, Enter or F2 enters a cell's widget and Escape returns to the grid. A cell holding one widget that needs no arrows (a button, a checkbox) puts focus on the widget.

## What basalt takes, and what it refuses

| Pattern                                                                                                                   | Verdict                 | Why                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Grid look as an option of one component                                                                                   | take                    | AG and MUI both make the bordered grid a setting of the same grid; a second component would fork the kinds, the plan, the tiers and the saved views.                                                                                       |
| Rules on both axes at the row rule's colour                                                                               | take                    | Glide's split of vertical and horizontal border colour shows the axes are separate; basalt draws both from the one hairline token so the grid reads as the same kit.                                                                       |
| A compact row (28 px, the density floor on touch) and tabular figures in every cell                                       | take                    | Blueprint's 20 px and Airtable's Short row are the dense end; 28 px is the kit's existing `sm` row, so no new size is invented.                                                                                                            |
| A density toggle for the user                                                                                             | refuse                  | MUI and MRT ship one; per-table density is on the table concept's kill list and has no consumer. The look already carries the dense row.                                                                                                   |
| Sort, filter and menu visible at rest                                                                                     | keep                    | MUI hides the menu until hover; the owner asked for visible icons, and basalt already draws all three at rest (Issue 2418).                                                                                                                |
| Every visible column in the grid look, scrolling sideways with the identity column pinned                                 | take                    | Every grid studied scrolls sideways; none drops columns by width. Dropping columns is a reading behaviour and stays in the reading look.                                                                                                   |
| APG roving cell focus: one tab stop, arrows, Home/End, Ctrl+Home/End, Page Up/Down, Enter on a cell's widget, Escape back | take                    | APG is the reference; AG and MUI follow it.                                                                                                                                                                                                |
| A tab stop per cell (Material React Table)                                                                                | refuse                  | APG names that the table pattern, not the grid pattern; Tab must leave the grid.                                                                                                                                                           |
| `role=application` (Airtable)                                                                                             | refuse                  | It drops the table semantics screen readers announce; Airtable states a performance reason basalt does not have.                                                                                                                           |
| Header cells inside the arrow-key grid                                                                                    | refuse for now          | AG puts the header in the grid; Blueprint does not. basalt's header controls are already their own tab stops; moving them into the grid is later work once the body model has shipped.                                                     |
| Column reorder by drag in the column list                                                                                 | take                    | Airtable's grip list and the category order basalt already ships (`parts/category-order.tsx`) are the same pattern, with its pointer capture and live region.                                                                              |
| Column reorder by keyboard                                                                                                | take                    | AG's Shift+Arrow on a header is the one documented precedent; basalt uses the category order's keys (Alt with Up or Down on a grip) and adds Move left and Move right to the column menu, which every pointer and screen reader reaches.   |
| Drag a header cell to move it                                                                                             | later                   | Blueprint, Glide, AG and Airtable do it. basalt's header already carries sort, filter and menu as click targets; drag on the same chrome needs an activation distance and a drop indicator, and the list and the menu meet the need first. |
| Order persisted as display state, in the saved view, not in the URL                                                       | take                    | Every product leaves persistence to the app or the view. basalt's law already holds display (visibility) on the device lane and in a saved view, never in a shared link, so order joins visibility there.                                  |
| User pinning to the start, grid look only                                                                                 | take                    | AG, MUI Pro, MRT and Airtable let the user pin; Blueprint and Glide pin by prop only. A pin matters only where the table scrolls sideways, which is the grid look.                                                                         |
| Pin to the end                                                                                                            | refuse                  | `actions` already pins to the end by default, and no consumer asked for more; AG and MUI Pro offer it.                                                                                                                                     |
| A fixed cap on pinned columns (Airtable 3, AG grid width minus 50 px)                                                     | refuse                  | A number with no measurement behind it. basalt's rule: below the card threshold only the identity column stays pinned, so a pin never eats a phone's width.                                                                                |
| Column resize                                                                                                             | refuse, a decision kept | See "Resize stays out" below.                                                                                                                                                                                                              |
| Cell or range selection, clipboard, fill                                                                                  | refuse                  | Enterprise or Premium in AG and MUI; out of scope with cell editing.                                                                                                                                                                       |
| Frozen rows beyond the head                                                                                               | refuse                  | The sticky head and the footer cover it; AG pins rows from data, MUI behind Pro.                                                                                                                                                           |

## Resize stays out

Every product but Linear resizes, and Blueprint has it on by default. basalt refuses it for one reason: a column's width is a law of its kind (`ch` x 8 px + 24 px, an icon column 44 px, a `content` column sized to its loaded values), and the tier thresholds, the pinned offsets and the phone cards are computed from those widths in pure code, so the server HTML is already right and nothing is measured. A user width breaks that chain: the plan would read a device value, the server could not know it, and the keyboard would need a resize model of its own, which only AG documents (Alt+Arrow).

What would change it: a census of consumer tables where a kind width cuts real values that the `content` width cannot fit (the S3 spike, `docs/v3/spikes/table-fit.md`, found 71 cells over, 58 of them `entity`, and answered them with the `content` width), or the owner asking for it after working in the grid look.

## Odd patterns in the present table, and what happens to each

| Pattern                                                           | Seen where                                                                                 | Fix or reason to stay                                                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| A column cannot move                                              | `parts/toolbar.tsx` `Display` lists columns in declaration order only                      | Fixed: the list reorders by drag and by keyboard, the menu gains Move left and Move right.                  |
| The identity column shows a checkbox in Display that does nothing | `Display` writes `visibility` for every column; `core/plan.ts` ignores it for the identity | Fixed: the identity row is checked and disabled, as its menu already offers no Hide.                        |
| The Display button does not say a column is hidden                | `Display` trigger is the bare word                                                         | Fixed: it names the count ("Display, 2 hidden"), as Airtable's "N fields hidden" does.                      |
| The search box is an empty field with no visible word             | `Search` has an `aria-label` and no placeholder                                            | Fixed: it carries a placeholder naming the table ("Search bookings").                                       |
| Focus lands on a row, never a cell                                | `core/keyboard.ts` roves rows                                                              | Stays in the reading look, where a row is the unit; the grid look roves cells.                              |
| A priority column vanishes as the table narrows                   | tier CSS in `table.css`                                                                    | Stays in the reading look, where the Details door reaches it; the grid look keeps every column and scrolls. |
| Rules run past the last column on a wide table                    | the filler column (`data-fill`)                                                            | Stays in the reading look, where it carries the row tint; the grid look ends its rules at the last column.  |
| A numeric header puts its filter and menu before the label        | `HeaderContent` reverses the row for `numeric`                                             | Stays: the label stays on the figures' edge, so the header and the column align.                            |

## Sources

### Blueprint Table and Glide Data Grid

- <https://github.com/palantir/blueprint/tree/develop/packages/table>
- <https://github.com/palantir/blueprint/blob/develop/packages/table/src/tableProps.ts>
- <https://github.com/palantir/blueprint/blob/develop/packages/table/src/table.tsx>
- <https://github.com/palantir/blueprint/blob/develop/packages/table/src/tableHotkeys.ts>
- <https://github.com/palantir/blueprint/blob/develop/packages/table/src/headers/columnHeaderCell.tsx>
- <https://github.com/palantir/blueprint/blob/develop/packages/table/src/headers/columnHeader.tsx>
- <https://github.com/palantir/blueprint/blob/develop/packages/table/src/docs/table.mdx>
- <https://github.com/palantir/blueprint/issues/3731>
- <https://github.com/palantir/blueprint/pull/3732>
- <https://modernreactspa.com/learn/desktop-shell-uis-blueprintjs>
- <https://github.com/bigcapitalhq/blueprintjs-tanstack-table>
- <https://blueprintjs.com/docs/#table>
- <https://github.com/glideapps/glide-data-grid>
- <https://grid.glideapps.com/>
- <https://github.com/glideapps/glide-data-grid/blob/main/packages/core/API.md>
- <https://docs.grid.glideapps.com/api/dataeditor/input-interaction>
- <https://docs.grid.glideapps.com/api/dataeditor/selection-handling>
- <https://docs.grid.glideapps.com/api/dataeditor/styling>
- <https://github.com/glideapps/glide-data-grid/blob/main/packages/core/src/common/styles.ts>
- <https://github.com/glideapps/glide-data-grid/pull/1196>
- <https://github.com/glideapps/glide-data-grid/releases>
- <https://www.w3.org/WAI/ARIA/apg/patterns/grid/>
- <https://context7.com/tanstack/table>
- <https://context7.com/glideapps/glide-data-grid>
- <https://raw.githubusercontent.com/palantir/blueprint/develop/packages/table/src/table.tsx>
- <https://github.com/palantir/blueprint/blob/develop/packages/table/src/tableUtils.ts>

### AG Grid Community and MUI X Data Grid (MIT)

- <https://www.ag-grid.com/javascript-data-grid/column-moving/>
- <https://www.ag-grid.com/javascript-data-grid/column-pinning/>
- <https://www.ag-grid.com/javascript-data-grid/keyboard-navigation/>
- <https://www.ag-grid.com/javascript-data-grid/community-vs-enterprise/>
- <https://www.ag-grid.com/javascript-data-grid/cell-selection/>
- <https://www.ag-grid.com/javascript-data-grid/column-menu/>
- <https://www.ag-grid.com/javascript-data-grid/column-sizing/>
- <https://www.ag-grid.com/javascript-data-grid/theming-borders/>
- <https://www.ag-grid.com/javascript-data-grid/theming-compactness/>
- <https://www.ag-grid.com/javascript-data-grid/grid-state/>
- <https://www.ag-grid.com/javascript-data-grid/accessibility/>
- <https://www.ag-grid.com/javascript-data-grid/row-height/>
- <https://www.ag-grid.com/javascript-data-grid/row-selection/>
- <https://www.ag-grid.com/javascript-data-grid/touch/>
- <https://www.ag-grid.com/javascript-data-grid/row-pinning/>
- <https://www.ag-grid.com/javascript-data-grid/column-headers/>
- <https://mui.com/x/react-data-grid/column-ordering/>
- <https://mui.com/x/react-data-grid/accessibility/>
- <https://mui.com/x/introduction/licensing/>
- <https://mui.com/x/react-data-grid/column-pinning/>
- <https://mui.com/x/react-data-grid/row-selection/>
- <https://mui.com/x/react-data-grid/style/>
- <https://mui.com/x/react-data-grid/state/>
- <https://mui.com/x/react-data-grid/column-visibility/>
- <https://mui.com/x/api/data-grid/data-grid/>
- <https://mui.com/x/react-data-grid/column-menu/>
- <https://mui.com/x/react-data-grid/cell-selection/>
- <https://mui.com/x/react-data-grid/row-pinning/>
- <https://mui.com/x/react-data-grid/column-dimensions/>
- <https://mui.com/x/react-data-grid/sorting/>
- <https://mui.com/x/react-data-grid/>
- <https://context7.com/websites/mui_x_react-data-grid>

### TanStack Table examples, Mantine React Table and dnd-kit

- <https://tanstack.com/table/latest/docs/framework/react/examples/column-dnd>
- <https://tanstack.com/table/latest/docs/framework/react/examples/column-ordering>
- <https://tanstack.com/table/latest/docs/framework/react/examples/column-pinning-sticky>
- <https://www.mantine-react-table.com/docs/guides/column-ordering>
- <https://www.mantine-react-table.com/docs/guides/column-ordering-dnd>
- <https://tanstack.com/table/v8/docs/framework/react/examples/column-dnd>
- <https://www.mantine-react-table.com/docs/guides/column-pinning>
- <https://www.mantine-react-table.com/docs/guides/column-resizing>
- <https://www.mantine-react-table.com/docs/guides/density-toggle>
- <https://tanstack.com/table/v8/docs/framework/react/examples/column-pinning-sticky>
- <https://tanstack.com/table/v8/docs/guide/column-pinning>
- <https://tanstack.com/table/v8/docs/api/features/column-ordering>
- <https://docs.dndkit.com/api-documentation/sensors/keyboard>
- <https://dndkit.com/legacy/api-documentation/sensors/keyboard>
- <https://www.mantine-react-table.com/docs/api/table-options>
- <https://www.w3.org/WAI/ARIA/apg/patterns/grid>
- <https://www.mantine-react-table.com/docs/guides/state-management>
- <https://www.mantine-react-table.com/docs/guides/column-hiding>
- <https://dndkit.com/legacy/guides/accessibility>
- <https://www.npmjs.com/package/mantine-react-table>
- <https://github.com/KevinVandy/mantine-react-table>
- <https://registry.npmjs.org/-/package/mantine-react-table/dist-tags>
- <https://www.mantine-react-table.com/docs/guides/column-actions-menu>
- <https://tanstack.com/table/v8/docs/guide/column-sizing>
- <https://www.material-react-table.com/docs/guides/accessibility>
- <https://www.mantine-react-table.com/docs/guides>
- <https://mantine.dev/core/table>
- <https://dndkit.com/extend/plugins/accessibility>
- <https://dndkit.com/legacy/presets/sortable/overview>
- <https://github.com/KevinVandy/mantine-react-table/releases>

### Linear, Airtable and the WAI-ARIA APG grid pattern

- <https://www.w3.org/WAI/ARIA/apg/patterns/grid/>
- <https://www.w3.org/WAI/ARIA/apg/patterns/grid/examples/data-grids/>
- <https://www.w3.org/WAI/ARIA/apg/patterns/grid/examples/advanced-data-grid/>
- <https://linear.app/docs/display-options>
- <https://linear.app/docs/creating-issues>
- <https://linear.app/docs/editor>
- <https://linear.app/docs/board-layout>
- <https://linear.app/docs/select-issues?_rsc=11tpt>
- <https://linear.app/docs/search>
- <https://linear.app/changelog/page/5>
- <https://linear.app/changelog/page/6>
- <https://linear.app/changelog/page/7>
- <https://linear.app/changelog/page/10>
- <https://linear.app/changelog/page/25>
- <https://linear.app/changelog/issue-selection>
- <https://linear.app/changelog/timeline>
- <https://linear.app/rss/changelog.xml>
- <https://linear.app/mobile>
- <https://support.airtable.com/articles/7905594155-airtable-grid-view>
- <https://support.airtable.com/articles/2203617073-accessibility-in-airtable>
- <https://support.airtable.com/articles/7980233311-Airtable-keyboard-shortcuts>
- <https://support.airtable.com/articles/6540330000-airtable-field-actions?>
- <https://support.airtable.com/articles/8716174546-sorting-records-in-airtable-views>
- <https://support.airtable.com/articles/3784973334-shared-view-url-filters>
- <https://support.airtable.com/articles/5189551686-getting-started-with-airtable-views>
- <https://support.airtable.com/articles/9609457174-Airtable-desktop-and-mobile-feature-differences>
- <https://community.airtable.com/interface-designer-12/feature-request-freeze-or-pin-columns-in-grid-view-48809>
- <https://www.airtable.com/guides/build/create-custom-views-of-data>
- <https://support.airtable.com/docs/en/airtable-grid-view>
