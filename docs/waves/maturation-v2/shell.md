# v2 audit: shell (src/shell/**, src/dashboard/**, defineNav)

Scope read: shell/index.tsx, nav-types.ts, page-bar.tsx, page-aside.tsx, aside-docking.ts, use-size-class.ts, app-breadcrumbs.tsx, page-title.tsx, app-sidebar.tsx (head + structure), app-mobile-nav.tsx (head + MobileNav), dashboard/section.tsx, widget-header.tsx, stat-card.tsx, stat-group.tsx, settings-section.tsx, router-tanstack/nav.ts, use-nav.ts. Consumers: argo, rb, linewatch, basalt-ui-obsidian, weatherorb (w37/basalt-2). Not covered: sidebar-blocks internals, mobile-nav-model internals, query-state, empty-state, delta-badge, CSS modules beyond the media-query inventory.

Headline: the shell is functionally rich but carries a large, consumer-less prop surface (account, search, brand.menu, controlled collapse, headerHeight, isActive, getScrollElement have no consumer outside the playground) and a few correctness/perf footguns in the nav wiring (anchor identity churn, label-keyed fold state, unmemoized contexts). The single most valuable change: make `useNav` produce stable per-destination anchors and key sections by group id, then delete the consumer-less props.

---

## Findings

### shell-01 (major, bug/perf) useNav rebuilds every `Anchor` component on each navigation, remounting every nav link

Evidence: router-tanstack/use-nav.ts:167-176 defines `const Anchor: NavAnchor = (props) => createElement(Link, ...)` inside `toSidebarItem`, inside a `useMemo` whose deps include `href` (line 218). app-sidebar.tsx:246 and app-mobile-nav.tsx:457 pass it as `<NavLink component={Anchor}>`. A new function identity per recompute is a new component type to React.
What is wrong: every route change (and every render in which `badges` changes identity, see shell-02) unmounts and remounts all `<a>` hosts in sidebar, mobile bar and More sheet. Keyboard focus on the clicked link is lost, hover/press state and any CSS transition on the row reset, and Tooltips on the rail re-initialise.
Proposal: build one stable anchor per item id once per `config` (module-level `WeakMap<NavConfig, Map<id, NavAnchor>>`), and pass active state through props or a context the anchor reads (`aria-current` already arrives as a prop). Add a mount-count test (render, navigate, assert the same DOM node). Verify the focus-loss claim in a real browser before the fix; the code path is unambiguous but no test pins identity.
Breaking: no. Consumers: all (argo, rb, obsidian use BasaltShell + nav).

### shell-02 (major, dx/perf) `badges` must be hoisted/memoized, and every consumer passes an inline literal

Evidence: shell/index.tsx:259-261 ("hoist or memoize the object"); use-nav.ts:218 has `badges` in the memo deps. argo __root.tsx:~112 `badges={{ calendar: badges.calendar, m365: badges.m365 }}`, rb app-shell.tsx:~46 `badges={{ review: dueCount }}`: both new objects every render, so the whole section tree (and with shell-01, every anchor) is rebuilt on each shell render.
What is wrong: a documented footgun that every consumer trips. A framework should not need a hoisting comment.
Proposal: compare badges structurally inside useNav (shallow-equal per id on a ref, only recompute when a value changed), or split badges out of the sections memo: sections computed from (config, href), badges overlaid in a second cheap pass. Delete the doc sentence.
Breaking: no. Consumers: argo, rb.

### shell-03 (major, api/bug) Sections have no key; persisted fold and mobile `tabs` are keyed by label slug

Evidence: nav-types.ts:67-75 (`SidebarSection` has `label`, no key); sidebar-block-model.ts:73-91 (`sidebarSectionFoldKey` = `slugifyLabel(label)`, which lowercases and strips non-[a-z0-9]); app-sidebar.tsx:300-304 uses it for the persisted fold; use-nav.ts:224-231 translates a group id in `mobile.tabs` back into the group's LABEL; mobile-nav-model.ts:287-323, 368 key slots by `section.label` ("`SidebarSection` carries no key").
What is wrong: `NavGroupMeta.id` exists and is thrown away at the resolver boundary. Renaming a label silently resets a user's persisted fold; two groups "Übersicht"/"Überblick" slugify to the same `bersicht`/`berblick`-style keys and non-Latin labels slugify to `""` (all share one fold key). `mobile.tabs` ids are validated at compile time and then matched by display text at runtime.
Proposal: add `key: string` (required) to `SidebarSection`, fed from `group.id`; fold key `sidebar-section:<key>`; mobile model keyed by section key; delete `slugifyLabel` and the label translation in use-nav. One-time fold reset on upgrade is acceptable (MIGRATING note).
Breaking: yes (persisted fold state resets; `SidebarSection` shape). Consumers: argo, rb, obsidian (all use sections).

### shell-04 (major, dead-code/api) Consumer-less props on BasaltShell: adopt-or-delete

Evidence: grep across argo/rb/linewatch/obsidian/weatherorb for `account=`, `search={`, `headerHeight`, `collapsed=`, `onCollapsedChange`, `getScrollElement`, `isActive=`, `brand.menu`: zero hits outside apps/playground. Surface: shell/index.tsx:163-245 props; account-types.ts (122 lines), app-sidebar-account.tsx (180), sidebar-search.tsx (154), app-mobile-nav.tsx account rows (148-205) plus `accountRowCount` coupling in shell/index.tsx:507.
What is wrong: roughly 600 lines plus tests and a mobile-row-count arithmetic dependency for features the owner's six apps do not use. Violates adopt-or-delete.
Proposal: delete `account`/`SidebarAccount`/account-types, `search`/`SidebarSearch`, `brand.menu`, `headerHeight`, controlled `collapsed`/`onCollapsedChange` (the `toggleSidebar` command bridge already covers external toggling), `isActive` (and with it the undocumented `_asChild` Link seam in use-nav.ts:48-61, 171-174, which MAINTAINING must re-verify on every router bump), `getScrollElement`. Re-add behind a named consumer when one exists. Net-negative by a large margin.
Breaking: yes (MIGRATING entry), none of the six apps affected. Consumers: playground only.

### shell-05 (major, api) Controlled collapse is an invalid-state union

Evidence: shell/index.tsx:214-234: `storageKey` "ignored when `collapsed` is set"; `onCollapsedChange` "a no-op when omitted"; shell/index.tsx:449-487.
What is wrong: `collapsed` without `onCollapsedChange` yields a frozen sidebar with no warning; `storageKey` plus `collapsed` silently drops the key. Three optional props encode two modes.
Proposal: if not deleted per shell-04, make it `{ storageKey?: string } | { collapsed: boolean; onCollapsedChange: (c: boolean) => void }` (never-typed cross keys). Preferred: delete controlled mode (shell-04).
Breaking: yes. Consumers: none.

### shell-06 (major, perf) Context values are unmemoized; every `Section`/`PageBar` re-renders on any claim change

Evidence: page-bar.tsx:131-148 `value: PageBarSlots` is a fresh 14-field literal each render (also `mobileNav` filter/map at 124-127 runs per render); page-aside.tsx:127-138 same for `AsideRegion`; shell/index.tsx:387 `globalActions ?? []` passes a new array per render. `Section` calls `useInPageBarShell()` -> `useContext(PageBarContext)` (dashboard/section.tsx:~225), so every Section subscribes to the whole monolith.
What is wrong: any state in `PageBarProvider` (kebab claim count, panelHost count, panel claim, both portal targets) re-renders every Section and PageBar in the tree; ShellBody re-renders on every navigation and resize-class change, producing a new `value` each time.
Proposal: split PageBarContext into three narrow contexts (portal targets, kebab claim, aside-panel slot) plus a boolean `InShellContext`; `useMemo` each value; memoize `mobileMoreActions` on `globalActions` identity (and see shell-02: same hoisting footgun for `globalActions`). `Section` should read only `InShellContext`.
Breaking: no. Consumers: all.

### shell-07 (major, wiring) Full-bleed / viewport-fill pages are hand-computed with shell internals in three argo files

Evidence: argo features/hermes-chat/chat-page.tsx:~48-51 (`calc(100dvh - var(--app-shell-header-offset) - var(--app-shell-footer-offset))` and `calc(var(--app-shell-padding) * -1)`); features/astro-window/constants.ts:32 (`MAP_FULL_BLEED_HEIGHT` with `2 * var(--app-shell-padding)`, comment explains `h="100%"` collapses because Main uses min-height); features/calendar/calendar-page.tsx:230-233 (`100dvh - header-height - --basalt-page-bar-h - …`).
What is wrong: three consumers reach into Mantine AppShell variables to express "fill the content box" and "bleed the page gutter". The 2.x shell already owns Main as the scrollport (app-main.module.css), so it can own this.
Proposal: publish `--basalt-page-fill-h` (content box height net of header, footer, band and padding) and `--basalt-page-bleed` (negative page gutter) from ShellBody, or ship a `<PageFill>` primitive (`fill` = height, `bleed` = edge-to-edge). Add a guard on raw `--app-shell-*` reads outside shell/ (same family as `raw-breakpoint`).
Breaking: no (additive), consumers then delete three hand-calcs. Consumers: argo.

### shell-08 (major, wiring/guard) Shell-less apps copy the gutter, the bleed and a width `@media` into a directory named `shell/`

Evidence: linewatch web/src/shell/root-layout.module.css:1-50 and web/src/shell/page-bar.module.css:1-50 restate `--vx-space-app-shell-inset{,-mobile}` and the 52.5em step; comment in root-layout: "A width `@media` is only legal under `shell/**`, which is why this file lives here". linewatch components/dashboard-section.tsx:33 re-declares `scrollMarginTop: var(--basalt-page-bar-h)` for its compact branch. src/shell/page-bar.tsx:~190-205 documents `classNames.root` as the place for "your gutter bleed".
What is wrong: the guard keys on a directory name, so the consumer relocates files to satisfy it, and the framework hands shell-less apps no page container. Every shell-less app (linewatch now, weatherorb standalone surfaces) rebuilds container + gutter + bleed.
Proposal: ship `<BasaltPage>` (shell-less page container: max width, gutter on the shell's own tokens, owns the PageBar bleed through a context or CSS var, owns `--basalt-page-bar-h` consumption). Then delete linewatch's two CSS files and make the `@media` guard path-independent (flag any width @media outside basalt-ui, no directory carve-out). Also expose an `anchorStyle`/`SectionAnchor` so compact fallbacks need not re-derive the offset.
Breaking: no. Consumers: linewatch, weatherorb.

### shell-09 (major, docs/api) `useSizeClass` is documented "Shell-only" but is public API used by 4 consumers and 2 internals

Evidence: use-size-class.ts:3-5 ("Shell-only — components size by container, not by this"); exported from src/index.ts; used in argo routes/strength-tracker.tsx:88, components/timer-nav.tsx:39, linewatch components/live-chip.tsx:67, obsidian vault-search-spotlight.tsx:137 and routes/index.tsx; internally content/article-layout.tsx:30.
What is wrong: the doc states a rule the code and every consumer break. The three expressions of one 840px boundary (Mantine `sm` in `AppShell breakpoint`/`visibleFrom`, the `52.5em` CSS literal, `SIZE_CLASSES.medium`) are pinned only by tests; the prose says "below `sm`" in ~40 places while the hook returns `compact`.
Proposal: update the doc to the real contract (public, JS-only reads for portal targets and mount-one-of-two); settle one vocabulary (say `compact` everywhere, `sm` only in Mantine props with a comment that they are the same line). Consider `useIsCompact()` since all four consumers only test `=== 'compact'` / `!== 'compact'`.
Breaking: no. Consumers: argo, linewatch, obsidian.

### shell-10 (major, layering) `dashboard/section.tsx` imports the whole shell barrel; `shell/index.tsx` re-exports a pile of non-public internals

Evidence: dashboard/section.tsx:61 `import { PAGE_BAR_HEIGHT_VAR, useInPageBarShell } from '../shell'` (the barrel pulls app-sidebar, mobile nav, MobileNav, page-aside); controls/data-table import `../dashboard` barrel (table/data-table.tsx:86); shell/app-sidebar.tsx:39, app-brand.tsx:19, app-mobile-nav.tsx:42 import types from `./index` (a cycle: index imports them). shell/index.tsx:61-94 exports AppSidebar, MobileNav, SidebarSearch, SidebarAccount, NavCountBadge, projectMobileNav, MOBILE_* constants, AppBreadcrumbs: none are in src/index.ts and none has a consumer (grep).
What is wrong: the module graph is not a DAG of small deep modules; bundlers cannot prove side-effect freedom and a barrel cycle makes tests slow to isolate. Sub-pieces are exported for tests only.
Proposal: move `BrandConfig`/`SettingsMenuItem` to `shell/shell-types.ts`; move `PAGE_BAR_HEIGHT_VAR`/`useInPageBarShell` to a tiny `shell/page-bar-context.ts`; Section and data-table import the leaf. Reduce `shell/index.tsx` to BasaltShell + the 4 public symbols; tests import files directly. Add a madge-style cycle check to `pre`.
Breaking: no (none public). Consumers: none.

### shell-11 (minor, api) `ShellFrame` is `@internal` yet exported and doubles the props type

Evidence: shell/index.tsx:157, 363-393 (`ShellBaseProps`, `ShellFrameProps`, `ShellFrame`); `ShellBaseProps` is exported from src/index.ts; no consumer imports ShellFrame (grep).
What is wrong: two prop types and a second component whose only purpose is to separate router resolution from rendering; `BasaltShell` already takes `{...rest}`.
Proposal: keep the split as non-exported functions in one file, export only `BasaltShellProps`. Rename away from "Base".
Breaking: type-only. Consumers: none.

### shell-12 (minor, api) Boolean/optional pairs that should be unions on nav and settings rows

Evidence: nav-types.ts:44-46 `active?: boolean` + `ancestor?: boolean` ("NOT active itself"); SettingsMenuItem `active?` + `current?: 'selection'|'page'` (shell/index.tsx:145-154: `current` is meaningless without `active`); `mobile?: boolean | NavMobilePlacement` (nav-types.ts:33, nav.ts:28: `true`≡`'tab'`, `false`≡`'hidden'`); `SidebarSection.mobile?: false | NavSectionMobile` with `tab?: true`.
What is wrong: `active && ancestor` and `current` without `active` are representable and meaningless; three spellings of one placement. All consumers already write `mobile: 'tab'`/`'bar'` strings.
Proposal: `state?: 'active' | 'ancestor'` on SidebarItem; `selected?: boolean | 'page'` on SettingsMenuItem (or `state`); `mobile?: 'tab'|'more'|'hidden'` only; section `mobile?: 'hidden' | { label?, icon? }` where presence of the object means tab. Delete boolean branches in mobile-nav-model.
Breaking: yes. Consumers: argo (settings `active`), others only string placements.

### shell-13 (minor, api) NavItemMeta/NavGroupMeta duplicate SidebarItem/SidebarSection with `id` vs `key` drift

Evidence: nav.ts:20-40 vs nav-types.ts:28-75: same fields restated (`short`, `mobile`, `icon`, `disabled`), `id` in one and `key` in the other; use-nav.ts:182-202 maps field by field with seven conditional spreads.
Proposal: derive `SidebarItem` from `NavItemMeta` via `Omit<NavItemMeta,'id'|'exact'> & { key }` or make the resolver the only producer and mark `SidebarItem` internal. One definition of the shared fields; a type test that pins their equality.
Breaking: no. Consumers: none.

### shell-14 (major, wiring) `defineNav` writes a module-global that Spotlight and route-transition read; BasaltShell takes `nav` separately

Evidence: nav.ts:155-162, 180-185 (`activeNav`, "last call wins"); provider/spotlight-actions.tsx:44 and provider/route-transition.ts:146 read `getActiveNav()`; shell/index.tsx:348-355 takes `nav` as a prop.
What is wrong: two sources of truth for "the nav": the prop the shell renders and the global others see. A second `defineNav` call (a test, a storybook, the obsidian package alongside an app) silently re-points Spotlight and view transitions. `navTarget` is pure; `defineNav` is not, despite the name and the doc "identity at runtime".
Proposal: register the nav through the provider (`<BasaltProvider nav={NAV}>`, or `BasaltShell` registers via context) and delete `getActiveNav`; keep `defineNav` pure. PR #285 touches the same provider gating; coordinate rather than duplicate.
Breaking: yes (provider prop), trivial for 6 apps. Consumers: all.

### shell-15 (minor, a11y) Section toggle `aria-controls` points at an unmounted node; heading is not a landmark

Evidence: dashboard/section.tsx:~123-128 ChevronToggle `aria-controls={controls}` while the body (`{open && <div id={bodyId}>}`, line ~262) is unmounted when closed; the label is the static "Collapse section"/"Expand section" for every section.
What is wrong: dangling IDREF when collapsed; every chevron on a page has an identical accessible name, so a screen reader list of buttons is "Collapse section" x N.
Proposal: label `Collapse ${title}` / `Expand ${title}`; drop `aria-controls` when closed (or keep the body mounted with `hidden`, but then `Activity` semantics apply, see page-aside). Give the root `role="region" aria-labelledby` the heading id when `id` is set.
Breaking: no. Consumers: all Section users.

### shell-16 (minor, api) `Section` inherits metric props it should not have; admitted debt in comments

Evidence: section.tsx:81 `Omit<WidgetHeaderProps, 'tier'|'classNames'|'actions'>` exposes `value`, `unit`, `delta*`, `sparkline` on a section; stat-card.tsx:~230-240 and settings-section.tsx:~52-60 both say "`Section` and `ChartCard` still cut their own ad-hoc subsets; both should move onto these same three slices".
What is wrong: `<Section value="…" delta={3}>` type-checks and renders a metric row under a section heading; two comments record the intended fix as a TODO.
Proposal: `Section` takes `WidgetHeaderTitleProps & { count? }` only; ChartCard takes title+metric+delta slices. Remove the TODO comments with the change.
Breaking: yes (types only). Consumers: unlikely any (grep Section usage shows title/summary/actions/tabs).

### shell-17 (minor, api) `PageBar.title`/`icon` are accepted and silently ignored inside the shell

Evidence: page-bar.tsx:~155-165 ("Read only when there is no `BasaltShell` outlet … Inside a shell … this is ignored"); `hasLead = !inShell && …` (line ~305). Friction row 40 (argo W11) is the same ambiguity.
What is wrong: a prop whose meaning depends on a distant provider and which is dropped without a trace; `filtersEnd?: BarAction[]` vs `actions?: PageBarActions` are also different shapes for sibling slots.
Proposal: dev-only warning when `title`/`icon` is passed in a shell (the in-shell flag is already in hand), mirroring `useAsidePanelSlot`'s warning; align `filtersEnd` onto the `PageBarActions` family or document why it is a plain array.
Breaking: no. Consumers: none observed.

### shell-18 (major, bug-risk) `PageAside` claim model allows two asides and shares one fold flag

Evidence: page-aside.tsx:111-125 `claims` is a counter, `folded` a single boolean, `publishFolded: setFolded`; the doc says "One per page" (line 2) and page-bar.tsx:54 "At most one" but nothing enforces it. Release resets `folded` to false for everyone (line ~120).
What is wrong: two mounted `PageAside`s (a route plus a layout, or during a route transition when both are alive) fight over one fold flag and one portal target; during a transition the outgoing release clears `folded` after the incoming one published it. Only argo's site-map mounts one today, so it is latent.
Proposal: claim by identity (`useId`) in a Set, dev-warn on a second claimant, key the published fold to the claimant id, and ignore a release whose id is not the current owner (the same identity-check `claimPanel` already does at page-bar.tsx:122-125).
Breaking: no. Consumers: argo (latent).

### shell-19 (minor, perf/api) `useMeasuredHeightVar` publishes `--basalt-page-bar-h` on `documentElement` even inside a shell where nothing reads it

Evidence: page-bar.tsx:~237-290 (`publishBarHeight`, `useMeasuredHeightVar(hasRow2 || (!inShell && hasRow1))`); section.tsx:~232-237 reads the var only when `!inShell`. In a shell the only readers are consumers' own calc()s (argo calendar-page.tsx:233).
What is wrong: a ResizeObserver, a global style write and a `scrollIntoView` side effect (publishBarHeight re-aims the hash on first publish) run in every shell page for a value the framework does not use there; the global `documentElement` write is shared mutable state across two bars.
Proposal: with shell-07 shipping a fill-height var, publish only for the shell-less bar; move the hash re-aim into Section (it owns the anchor).
Breaking: possibly (argo calendar reads the var). Consumers: argo calendar-page.

### shell-20 (minor, dead-code/dx) Duplicated inline SVG icons across shell and dashboard

Evidence: `IconCheck` twice (app-sidebar.tsx:156, app-mobile-nav.tsx:105); `IconChevron` (sidebar-blocks.tsx:41) vs Section's inline chevron path (section.tsx:~130-140); IconCollapse/IconAsideFold/IconAsidePanel/IconGear/IconUser/IconSearch/IconMore each a private function (app-brand.tsx:26, page-aside.tsx:186/214, app-sidebar.tsx:134, app-sidebar-account.tsx:47, sidebar-search.tsx:40, app-mobile-nav.tsx:82); InfoGlyph embeds a raw path (widget-header.tsx).
Proposal: one `shell/glyphs.tsx` (or `theme/glyphs`) with a single `Glyph` factory; shared check/chevron. Roughly 150 lines removed.
Breaking: no. Consumers: none.

### shell-21 (minor, api/dx) `WidgetHeader` flat prop bag and `InfoGlyph` double duty

Evidence: widget-header.tsx props: `value, unit, delta, deltaPeriod, deltaPolarity, deltaFormat, deltaGlyph` (7 flat fields forwarded one by one into DeltaBadge, also re-forwarded in StatCard); `subtitle` silently becomes a hover glyph when `info` is absent and a muted line otherwise (JSX: `info === undefined && subtitle !== undefined && <InfoGlyph …>` plus a separate `subtitle` span).
What is wrong: the same string renders in two places depending on a sibling prop; the delta cluster is five props that always travel together; InfoGlyph hand-rolls a tooltip (own pointerdown listener, not hoverable, no touch affordance beyond click) instead of Mantine's Tooltip/Popover used elsewhere in the shell.
Proposal: `delta?: { value, period?, polarity?, format?, glyph? }`; make `subtitle` always a line and `info` always the glyph (or a single `description: { line | tip }` union); rebuild InfoGlyph on `Popover` with `openDelay`/hover-intent so it is hoverable and portal-safe.
Breaking: yes (types). Consumers: argo StatCards (delta usage) need a mechanical edit.

### shell-22 (minor, api) `SettingsRow` accepts `control` and `children` for the same slot

Evidence: settings-section.tsx:102-136 (`control?: ReactNode`, `children?: ReactNode`, rendered `{control ?? children}`); rules/basalt-controls.md:24 names `SettingsRow.control` as the sanctioned home.
What is wrong: two ways to fill one slot; `children` silently loses to `control`. The row also styles labels with inline `style` (VX.text) while siblings use CSS modules.
Proposal: keep `control` only (the one the control-home guard knows), drop `children`; move label/description styles to the module.
Breaking: yes (small). Consumers: check argo settings pages before removal.

### shell-23 (minor, perf) ShellBody does unmemoized per-render derivation

Evidence: shell/index.tsx:498 `findActiveCrumb(sections)` per render (the active item was already computed in use-nav as `winnerId`); `globalActions ?? []` (387, 572); `HeaderGlobalActions` re-filters/maps per render (657-659).
Proposal: have useNav return `activeCrumb` alongside `sections` (it already knows the winner and its group), delete the tree walk (findActiveCrumb/findActiveWithParent, ~45 lines) from the shell.
Breaking: no. Consumers: none.

### shell-24 (minor, test) Shell tests are large and pin implementation, with one 900-line file per component

Evidence: wc: index.test.tsx 903, app-mobile-nav.test.tsx 900, app-sidebar.test.tsx 821, page-aside.test.tsx 756, mobile-nav-model.test.ts 653, page-bar.test.tsx 526; CSS-text tests (`app-sidebar.module.css.test.ts`, `page-aside.module.css.test.ts`, `app-brand.module.css.test.ts`) assert on stylesheet strings; no test pins anchor identity (shell-01) or two-claimant behavior (shell-18).
Proposal: when deleting per shell-04, cull the matching tests; replace CSS-string tests with the existing layout suite assertions where geometry is the contract; add the two missing contract tests.
Breaking: no.

### shell-25 (minor, dx) `app-mobile-nav.tsx` is an 560-line component function with closures as row builders

Evidence: app-mobile-nav.tsx:283-846 (one `MobileNav` function containing scrollToTop, onActivate, rows, menuBlockRow, sheetBlockRow, activateBlock …) plus a rAF-timed focus race workaround (comment at ~line 380-390).
Proposal: split into `MobileBar`, `MoreSurface` (menu vs sheet) and `useActiveRetap` hook; replace the rAF with the Drawer's `onExitTransitionEnd`/`returnFocus` prop if Mantine exposes it (verify against installed source, not memory).
Breaking: no. Consumers: none.

### shell-26 (minor, api) `StatGroup` states its column law twice (data attributes and CSS custom properties)

Evidence: stat-group.tsx:~80-92 sets `data-cols`, `data-sm-cols` and `--basalt-stat-group-cols-sm/lg`; stat-group.module.css selects on `[data-cols]` with `@container` literal px (lines 48-101).
Proposal: pick one carrier (the attributes, since the CSS selects on them) and drop the inline custom properties if unread (grep the module first).
Breaking: no. Consumers: none.

---

## Summary table

| id       | sev   | kind      | one line                                                                           |
| -------- | ----- | --------- | ---------------------------------------------------------------------------------- |
| shell-01 | major | bug       | Anchors rebuilt per navigation                                                     |
| shell-02 | major | dx        | badges must be hoisted, all consumers inline                                       |
| shell-03 | major | api       | Sections keyed by label slug                                                       |
| shell-04 | major | dead-code | account/search/brand.menu/headerHeight/controlled/isActive/getScrollElement unused |
| shell-05 | major | api       | collapsed/onCollapsedChange invalid union                                          |
| shell-06 | major | perf      | Unmemoized contexts re-render Sections                                             |
| shell-07 | major | wiring    | Fill/bleed hand-computed from AppShell vars (3 argo files)                         |
| shell-08 | major | wiring    | Shell-less page container missing; guard keyed on dir name                         |
| shell-09 | major | docs      | useSizeClass doc contradicts use                                                   |
| shell-10 | major | layering  | Section imports shell barrel; cycle; internal exports                              |
| shell-14 | major | wiring    | defineNav global vs nav prop                                                       |
| shell-18 | major | bug       | PageAside multi-claim unenforced                                                   |
