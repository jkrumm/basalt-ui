# W7 — Mantine 9.7 adopt-or-delete

Plan bullet: "Mantine 9.7 adopt-or-delete (`useAppShellResize` vs aside-docking, EmptyState / DataList /
Toolbar / ActionBar), adopting only where it deletes basalt code" (`audit-h-ecosystem-2026-10.md:17`).

Installed and read: `@mantine/core` **9.7.1** (`bun.lock`), `esm/components/**` and `styles/*.css`
under `node_modules/.bun/@mantine+core@9.7.1+*/node_modules/@mantine/core`. Paths below are relative
to that package root. The adoption bar: deletes more basalt lines than it adds, and every current
behaviour stays covered by an existing test (density/ctl size tiers and `--vx-*` tokens included).

**Result: five REJECT, zero ADOPT. Package diff: +0 / −0 lines. No MIGRATING.md entry (no public change).**

| Mantine 9.7         | Basalt counterpart                                                        | Verdict    |
| ------------------- | ------------------------------------------------------------------------- | ---------- |
| `useAppShellResize` | `shell/aside-docking.ts` (+ `ShellFrame` hunk, `shell/index.tsx:409-425`) | **REJECT** |
| `EmptyState`        | `dashboard/empty-state.tsx` (116 lines)                                   | **REJECT** |
| `DataList`          | none as a component; `<dl>` inline in `dashboard/stat-card.tsx:318-332`   | **REJECT** |
| `Toolbar`           | `controls/actions.tsx` `ActionGroup` / `OverflowMenu`                     | **REJECT** |
| `ActionBar`         | none (no floating selection bar in basalt)                                | **REJECT** |

## useAppShellResize vs aside-docking — REJECT

The hook is **user drag-resizing** of a section: `useAppShellResize` keeps per-section `sizes`,
`activeSection`, `startResize/previewResize/endResize` and collapse reporting
(`esm/components/AppShell/use-app-shell-resize/use-app-shell-resize.mjs:6-141`), fed by
`AppShell.ResizeHandle` (`AppShellResizeHandle/AppShellResizeHandle.mjs:104-156`, `clampResizeSize`
against a viewport max). Its section table only names the CSS vars it writes
(`resize-section-config.mjs:3-40`).

`aside-docking.ts` answers a different question: _given the size class and a media query, does an
open aside push main or overlay it, and what width does the region reserve_ (`resolveAsideDocking`,
`aside-docking.ts:41-45`; `asideDockQuery` keeps `MAIN_MIN_WIDTH` beside the navbar). Nothing in the
hook decides docking vs overlay or rail width, and basalt has no resizable region
(`grep -r "ResizeHandle\|useAppShellResize\|resizable" packages/basalt-ui/src` → no match).
Adopting would add a drag feature, not delete the decision function. Revisit only if a resizable
aside is requested (that is a product call, not a consolidation).

## EmptyState vs dashboard/empty-state.tsx — REJECT

Mantine's root sets only `display:flex` and a `gap` from `--empty-state-gap-{xs..xl}`, which are
`calc(Nrem * var(--mantine-scale))` (`styles/EmptyState.css:1-40`) — **fixed rem, not
`--vx-space-stack-*`**, so they do not ride the density multiplier. It has no outer padding (basalt's
`tier="page" | "section"` paddings, `empty-state.tsx:46-49`), caps the description at `32rem`
(`EmptyState.css:112`) against basalt's `22.5rem`, and sizes title/description off
`--mantine-font-size-*` rather than `VX.text.xl` / `VX.text.md` plus the head font at stretch 88%.
Matching basalt means keeping nearly every style line as `styles`/`vars` overrides on top of the
Mantine component, plus a title/description → slot mapping (`flattenChildren`/indicator extraction,
`EmptyState.mjs:15-100`). Net: more lines, a looser contract (`title: string` is required in basalt),
and the existing `empty-state.test.tsx` density assertions would need rewriting. Also a public
`EmptyStateSlot` / `classNames` seam change for no deletion.

## DataList — REJECT

No basalt row-list component exists that it would replace. The only consumer-shaped analogue is
`StatCard`'s breakdown, a `<dl>` with `<div>` row wrappers carrying `data-tone`
(`stat-card.tsx:318-332`) whose layout (bleed/right placement, tone colours, tabular values) lives in
`stat-card.module.css`. `DataList` (`DataList/DataList.mjs:22-50`) renders its own `dl` with
`--data-list-fz/-lh/-gap` from Mantine's size scale and a `label-width` / `with-divider` model; swapping
it in would not remove the CSS that does the real work and would lose the tone attribute. Adding
`DataList` as a basalt export has no named consumer (consolidation doctrine: a new export needs one).

## Toolbar vs ActionGroup / OverflowMenu — REJECT

Mantine `Toolbar` is `role="toolbar"` with roving-tabindex arrow-key navigation
(`Toolbar/Toolbar.mjs:47-100`, `use-toolbar-navigation.mjs`), plus toggle/group/divider parts. It has
**no overflow behaviour** (no `ResizeObserver`, no fold: `grep -n "overflow\|ResizeObserver"
Toolbar/*.mjs` → none). `ActionGroup` / `OverflowMenu` (`controls/actions.tsx`, 969 lines) are almost
entirely the measured fold (`planBarFold` `:515`, `useMeasuredFold` `:563`), the mobile bar/more/hidden
policy (`barActionMobile` `:162`) and the menu projection (`menuRows` `:326`) — none of which Toolbar
provides. The ctl size tiers are basalt's own (`BarButton` / `BarIconButton`), not Toolbar's
`--toolbar-toggle-size`. Roving-tabindex keyboard nav is the one thing Toolbar offers that basalt's
bar lacks; that is an a11y addition (adds code and behaviour), not a deletion, so it is out of scope
for adopt-or-delete.

## ActionBar — REJECT

`ActionBar` is a floating, portaled, `Affix`-positioned (`bottom: 30`) transient bar for bulk
selection with `Transition` + `onClose` (`ActionBar/ActionBar.mjs:33-83`). Basalt has no such surface
(`grep -rE "ActionBar|BulkBar|SelectionBar" packages/basalt-ui/src` → none; table selection has no
floating bar), so there is nothing to delete. Adopting it is a new export without a named consumer.
