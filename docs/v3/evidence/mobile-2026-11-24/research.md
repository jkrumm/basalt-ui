## Bottom line

1. **Input zoom:** iOS Safari zooms when a focused input, select or textarea has a computed font-size below 16px. The only clean fix is a computed 16px on touch or coarse-pointer devices. `maximum-scale=1` and `user-scalable=no` do not stop the zoom on iOS and break pinch-zoom for everyone. A `font-size-adjust` workaround (a single-source report from October 2026) keeps the text visually smaller while the computed size stays 16px.
2. **Viewport and safe areas:** use `dvh`/`svh`/`lvh` for heights, `env(safe-area-inset-*)` with `viewport-fit=cover` for edges, and treat the keyboard separately. Viewport units ignore the virtual keyboard. On iOS Safari the keyboard resizes only the visual viewport, so fixed bottom bars can be covered. The VirtualKeyboard API is Chrome-on-Android only. Base UI's `Drawer.VirtualKeyboardProvider` is the cross-browser route inside sheets.
3. **Navigation:** a bottom bar of 3 to 5 destinations, with search as a trailing tab, is the shared native pattern. Overflow goes to a More list or a modal menu, not a sixth tab. A floating pill matches Apple's iOS 26 tab bar but not Material 3, which puts the bar full-width at the bottom. Minimize-on-scroll is an Apple option for tab bars with an attached accessory. Material allows hide-on-scroll-down, but not while a screen reader is active.
4. **Sheets and drawers:** basalt should use Base UI Drawer, which has snap points, swipe-to-dismiss, nested drawers and a virtual-keyboard provider. Vaul's repository says it is unmaintained. Use a native `<dialog>` for modal sheets and the Popover API for non-modal menus.
5. **Hover replacements:** gate hover styles with `@media (hover: hover)`, and give every hover-only affordance a tap path (popover or sheet). Long-press and context-menu patterns are not sourced here.
6. **Touch targets:** design hit areas of 44pt (Apple) or 48dp (Material) with at least 8dp between targets. WCAG 2.2 AA sets a 24 CSS px floor. The 300ms tap delay is gone on iOS 10+ pages with a `width=device-width` viewport. `navigator.vibrate()` is not a dependable haptic channel for web on iOS.
7. **Density:** use container queries for card-internal spacing, and viewport queries only for the shell. Shrinking body text on phones runs against Apple's 17pt iOS default. Fluid type is not sourced here.
8. **Tables:** on phones, use a card or list projection for row detail. For comparison and numeric tables, use horizontal scroll with a sticky first column and a visible cut-off, and let users choose columns.
9. **Scroll:** `overscroll-behavior: contain` stops scroll chaining in sheets and can disable pull-to-refresh. Its support on iOS Safari is not confirmed by the sources read. The View Transition API exists; its current browser support is not confirmed here.

## 1. iOS Safari input zoom

**The rule.** Safari on iOS zooms the page when a focused `<input>`, `<select>` or `<textarea>` has a computed font-size below 16px, and does not zoom back out after the keyboard closes. Specification.website states the rule as 16px (1rem) or larger, and Hammerspace describes the same behaviour: the zoom stays on after dismissal, and the user has to pinch back. CSS-Tricks (2021) found the threshold at 16px in its test. I did not find a WebKit document that states the threshold; it comes from secondary write-ups and community reports, so treat it as medium confidence. Recent reports from August to October 2026 (GitHub issues and a PR) describe the zoom still happening on iPhone Safari and installed PWAs. They are community evidence, not a WebKit statement.

**Current iOS.** I found no WebKit release note in Safari 26 that changes this rule. The October 2026 Hammerspace post and the 2026 reports both describe the zoom as current. The iOS version that changed the behaviour is not identified in the sources.

**Ways to avoid the zoom, ranked:**

- **Computed 16px on the controls (recommended).** Set `font-size: 1rem` on `input`, `select` and `textarea`, scoped to touch devices with `@media (pointer: coarse)` if you want smaller desktop controls. The `pointer` feature was not read from MDN here; it is the standard coarse-pointer test. Specification.website says to keep form text at 16px or larger and reports this as the fix.
- **`maximum-scale=1` (do not use).** WebKit's iOS 10 post says Safari now ignores `user-scalable`, `min-scale` and `max-scale`, so the page cannot block pinch-zoom there. MDN's viewport page says the same ('iOS10+ ignores it by default'). Hammerspace (October 2026) reports that Safari ignores `maximum-scale=1` for this purpose, while Android still honours it. Older advice that `maximum-scale=1` fixes the iOS zoom (West Wind, 2023; a Stack Overflow answer) predates or misreads the iOS 10 change. Even where it works, MDN warns that disabling zoom stops people with low vision from reading the page, and WCAG 1.4.4 requires resize support.
- **`font-size-adjust` with a 16px computed size (single source, medium confidence).** Hammerspace sets `font-size: 1rem` on inputs and then `font-size-adjust: calc(1ex / 1em * var(--body-font-size) / 1rem)`, which shrinks the visible x-height while Safari still reads 16px. It is gated with `@supports (-webkit-touch-callout: none)` and `@media (pointer: coarse)`. The author reports Safari does not factor the adjustment into its zoom decision. MDN lists `font-size-adjust` as Baseline since July 2024, and the adjustment is applied to the x-height, so cap height and visual size differ from a plain smaller font. The ratio is approximate and may need tuning per font.
- **`transform: scale()` on the input (reasoned, not tested in any source here).** Scaling a 16px input down with `transform` should leave the computed font-size at 16px, so Safari should not zoom. The cost is that the hit area and layout shrink or need compensating width. No source read confirms this on current iOS.
- **`touch-action` (does not solve it).** `touch-action: manipulation` limits browser gestures such as double-tap zoom and pinch on the element. It does not change the focus zoom, which is a separate Safari behaviour. MDN lists `manipulation` as a value; the focus zoom is not described there.
- **`text-size-adjust` (does not solve it).** Controls text inflation after orientation changes in iOS. It does not change the focus zoom. MDN's page was not read here.

**Design-system implication.** Make the form-control base 16px (`1rem`) on touch, and keep smaller text for labels and metadata. A 14px body with 16px inputs is consistent with Hammerspace's example.

## 2. Viewport units, safe areas, and the keyboard

**Viewport units.** `dvh` (dynamic), `svh` (small) and `lvh` (large) track the mobile address and tool bars. `100vh` is measured with the bars retracted, so it sits under the address bar on load. web.dev describes the three families, their `dv`/`sv`/`lv` prefixes, and that `dvh` is clamped between `lvh` and `svh`. Its support table lists Chrome 108, Firefox 101 and Safari 15.4 for the family (the article is from 2022; the figures are the ones printed on the page). The keyboard is not part of the UA UI, so no viewport unit shrinks for it. Use `dvh` for full-height shells and sheets, but do not rely on it to clear the keyboard. For a keyboard-sized element, use the keyboard APIs below.

**`viewport-fit=cover` and `env()`.** MDN's viewport page says `viewport-fit=cover` makes the page fill the display and 'it's highly recommended to use the safe area inset variables'. MDN's `env()` page lists `safe-area-inset-top|right|bottom|left` as the distance from the viewport edge that is safe from non-rectangular cut-outs. It is 0 on a rectangular viewport with nothing occupying space, and greater than 0 otherwise. The `safe-area-max-inset-*` variants are constants. Use `padding-bottom: max(env(safe-area-inset-bottom), 0px)` (or `calc`) for the bottom bar and sheet footer. `env()` is Baseline since January 2020 per MDN.

**`interactive-widget`.** MDN's viewport page defines `interactive-widget=resizes-visual` (the default), `resizes-content` and `overlays-content`. The Chrome blog (2022) classifies browsers. Safari on iOS and Chrome on iOS resize only the visual viewport, so `position: fixed` elements stay put and can be covered by the keyboard. Chrome, Firefox and Edge on Android resize the layout viewport too, so full-height elements shrink. Chrome 108 added the `interactive-widget` key on Android, and the blog says it is not supported in Chrome on iOS, which uses WebKit. I did not verify whether Safari has since shipped `interactive-widget`; treat it as unavailable there.

**VirtualKeyboard API.** MDN marks it experimental and 'limited availability', secure context only. `navigator.virtualKeyboard.overlaysContent = true` stops the browser resizing the viewport. The `geometrychange` event and `boundingRect` give the keyboard's position, and the `keyboard-inset-*` env variables let CSS reserve space. MDN's example uses `env(keyboard-inset-height, 0px)` in a grid row for a chat input. This is a Chrome-Android path, so it cannot be the only mechanism.

**Keyboard and bottom bars in practice.**

- Material 3 explicitly allows the keyboard to cover the navigation bar 'temporarily', for example while a search flow is open. For basalt's phone tab bar, hiding it while a text field is focused follows Material's rule.
- Inside sheets with forms, use Base UI's `Drawer.VirtualKeyboardProvider`. Base UI says it 'manages keyboard-aware focus and scroll handling for software keyboards' for sheets that contain form fields.
- Outside sheets, a `visualViewport` resize listener is the usual fallback. I did not read the Visual Viewport spec page, so treat it as unverified here.

## 3. Mobile navigation patterns

**Apple HIG (tab bars page, changelog updated June 2026).**

- A tab bar floats above content at the bottom of the screen on a Liquid Glass background that lets content show through. The floating look is therefore Apple's own iOS 26 pattern.
- Tab bars are for navigation, not actions. Actions on the current view belong in a toolbar.
- Keep the tab bar visible when people change sections. Hiding it leaves them unsure where they are; the exception is a modal view.
- Use the fewest tabs that cover the hierarchy. Avoid overflow. When tabs don't fit, the trailing tab becomes a More tab that lists the rest, which the HIG calls harder to reach and notice.
- Do not disable or hide tab buttons when their content is empty; explain the empty state instead.
- Labels should be single words where possible. Badges are for critical information only.
- A dedicated search tab can sit at the trailing end.
- For tab bars with an attached accessory (the Music MiniPlayer example), you can minimize the tab bar and move the accessory inline on scroll-down. People exit that state by tapping a tab or scrolling to the top. The developer enum `UITabBarController.MinimizeBehavior.onScrollDown` is iOS 26+.
- Users may customise tabs; the HIG suggests a default of five or fewer.

**Material 3 navigation bar (guidelines page).**

- Use a navigation bar for 3 to 5 top-level destinations on compact and medium windows. Use tabs for two destinations; use a modal navigation rail or menu for more than five.
- Icon plus a 1 to 2 word label. Do not wrap or truncate labels. Filled icon for the active destination; the active indicator is a pill that expands from the icon centre.
- The container spans the full window width and sits at the bottom. A floating action button sits above it, not on top of it.
- Re-selecting the active destination scrolls to the top. Preserve or reset state per destination, and choose consistently.
- Do not swipe between destinations. Swipe is for items such as carousel cards or archive actions.
- The bar can hide on scroll-down and reappear on scroll-up, but not when a screen reader is active.
- Badges: small for an update, large for a count.
- Use a navigation rail for expanded windows. This matches basalt's desktop rail.

**How the patterns fit.**

- _Bottom tab bar, 3 to 5 items:_ the default. Both guidelines agree.
- _Floating pill or dock:_ native to iOS 26's look. It departs from Material's full-width bottom container, so it is a platform-specific choice rather than a shared one.
- _Tab that opens a sheet (More, view switcher):_ this is the sanctioned answer to overflow in Material ('modal navigation rail or menu') and a common iOS fallback, although the HIG discourages the More tab itself. Use it for the sixth-and-beyond destinations, not for a primary view. A sheet for a view switcher is a choice, not a sourced rule.
- _Morphing or expanding menus, top app bar with large collapsing title, navigation drawer:_ I did not read the Material 3 top app bar, drawer or Expressive pages. Treat them as unverified here.

## 4. Bottom sheets and drawers

**Base UI Drawer (exists).** Base UI's drawer page (current, 2026) says the Drawer 'extends Dialog' and adds gesture support, snap points and indent effects. Use a plain Dialog if you don't need those.

- `swipeDirection` defaults to `down` for bottom sheets; `up`, `left` and `right` are also available.
- `snapPoints` takes numbers from 0 to 1 as fractions of the viewport, numbers above 1 as pixels, and strings in px or rem (for example `'148px'`). You then apply `--drawer-snap-point-offset` in CSS.
- `Drawer.SwipeArea` supplies an edge swipe. Add `data-base-ui-swipe-ignore` to a descendant to stop it dismissing (use `x` or `y` for one-axis carousels).
- `Drawer.Content` lets people select text with a mouse without the swipe interfering.
- Nested drawers stack using `[data-nested-drawer-open]` and the `--nested-drawers` variable. Each drawer keeps its own focus management.
- `Drawer.VirtualKeyboardProvider` manages keyboard-aware focus and scroll for forms.
- `Drawer.Provider`, `IndentBackground` and `Indent` give the iOS-style background indent.
- Base UI's own components list (2026) includes the drawer. A third-party wrapper says the stable version is v1.3.0, from March 2026; that wrapper is secondary. shadcn's drawer documentation says it uses Base UI.

**Vaul.** Its GitHub README states: 'This repo is unmaintained'. It has 8.8k stars and 135 open issues. npm reports latest 1.1.2. Do not add it to a new Base UI-based system.

**Native dialog and popover.**

- The Popover API is Baseline 2025 (MDN). Popovers are always non-modal. For a modal sheet, use a `<dialog>`, which can also be made a popover with `<dialog popover>`.
- Popover controls: `popovertarget`, `popovertargetaction` (show, hide, toggle), `::backdrop`, `:popover-open`, and `interestfor` for interest invokers that show on hover or focus with no JavaScript. The interest-invoker support status was not verified.
- A `<dialog>` used as a sheet gives you focus trapping through its native modal behaviour. Mark the page content inert separately if you need it (the `inert` attribute was not read here).

**Scroll locking and overscroll.**

- `overscroll-behavior: contain` on a sheet's scroll container stops scroll chaining into the page. Chrome's blog says `none` also removes the Android glow and iOS rubber-banding inside the element. MDN marks the property 'limited availability', so iOS support is not confirmed. A 2026 OpenReplay article says body scroll-locking is unreliable on iOS Safari.
- The Webflow fix for iOS (a `position: fixed` body with negative `top` set to the current scroll offset, then restored) is a community pattern from 2026, not a standard.
- Drag-to-dismiss, snap and nested scroll are supplied by Base UI, so a custom sheet on a plain `<dialog>` would have to implement them.

## 5. Touch replacements for hover

- MDN's `hover` media feature tests whether the primary input can hover. Its value `none` covers devices where it is 'inconvenient' (many phones emulate hover on a long press). Put hover-only styling inside `@media (hover: hover)` so touch devices never see stuck hover states.
- Every affordance that appears on hover needs a tap path. Tooltips become tap-to-open popovers that stay open until dismissed. Hover cards become popovers or sheets with a visible trigger, because a hover card has no tap equivalent.
- Menus on touch belong in a sheet or a popover with focus management, not a hover-open submenu.
- Long-press and context menus: `contextmenu` and long-press behaviour, and Apple's action-sheet and Material menu guidance, were not read. Treat as unverified. Do not make long-press the only route to an action.
- Interest invokers (MDN Popover API) can show popovers on focus and hover, which covers keyboard users; touch needs an explicit tap.

## 6. Touch targets, tap behaviour, haptics

- **Targets.** WCAG 2.2 SC 2.5.8 (Target Size Minimum, AA) requires 24 by 24 CSS pixels, or spacing of 24px circles that do not intersect other targets. It is not met by inline text links, user-agent controls or essential presentations. The Enhanced criterion 2.5.5 uses 44 by 44 CSS pixels, and the WCAG working group recommends it for important controls.
- **Material.** Material 3 says to make touch targets at least 48 by 48dp, with a 24dp icon and 48dp padded hit area. It states that 'iOS recommends 44 x 44dp'. Pointer targets are 44dp. Targets should be 8dp or more apart.
- **Apple.** The 44pt figure comes from the Material page's statement. Apple's Layout page, the primary source, was not read here; Apple's Accessibility page was read, but its Mobility section was cut off.
- **Tap delay.** WebKit's iOS 10 post says fast tapping (no double-tap wait) applies when the page has a viewport meta with `width=device-width` and is at scale 1. Pinch-zoom is now allowed on every page, so layouts must survive zoom.
- **touch-action.** Use `touch-action: manipulation` on interactive regions to skip double-tap zoom where you don't need it. MDN explains that browsers handle pan and pinch by default, and that Pointer Events receive `pointercancel` when the browser takes over a gesture.
- **Active states.** Use `:active` styling with a visible pressed state; the hover media query above keeps hover from being mistaken for it. Not separately sourced.
- **Tap highlight.** The `-webkit-tap-highlight-color` property was not read. Set it deliberately if you remove the iOS highlight, and keep a visible focus ring.
- **Haptics.** `navigator.vibrate()` (MDN) is 'limited availability', requires sticky user activation, and has no effect on devices without vibration hardware. It is silenced by silent or Do Not Disturb modes. MDN's compat data for Safari was not read, so I cannot confirm Safari support from a primary source. Treat haptics as optional enhancement; Apple's HIG advises pairing haptics with sound for accessibility, which is a native-app guideline.

## 7. Responsive density

- **Container queries.** MDN: a `container-type` of `size` or `inline-size` makes the element a query container. Styles can then respond to the container's width rather than the viewport. This suits a card that appears in a wide grid and in a narrow sheet. Basalt's use of container queries for layout matches the mechanism.
- **Shell versus content.** Use viewport media queries for the rail/bottom-bar switch in the AppShell, and container queries for card, chart and form density. This avoids nesting gutters: page gutter + card padding + chart padding compounds on a phone. The fix is to let cards and charts go edge-to-edge (zero card padding under a phone container width) and keep the gutter on the page only. That is a design choice; I did not find a source here that states it.
- **Fluid type.** A `clamp()` scale with a `cqi` or `vw` term is common. One secondary guide advises keeping the maximum at most 2.5 times the minimum for type. I did not verify that from a primary source.
- **Shrinking text on phones.** Apple's Accessibility page lists iOS and iPadOS default text at 17pt and minimum at 11pt, and says to support enlargement to at least 200%. Shrinking phone body text below a 16px-equivalent therefore runs against the platform default. Keep 16px for inputs (section 1) and body text where possible, and use smaller type only for metadata and labels.
- **Touch and density.** Keep the 44pt or 48dp hit area even when the visual is dense; pad the hit area, not the glyph.

## 8. Tables on phones

Nielsen Norman Group (2017, the most primary source I read on this) says:

- Columns must be legible without zooming. A wordy comparison table may fit only two columns on a narrow screen; a numeric table can fit more.
- Rotating the phone is a last resort.
- Sticky column headers are needed when the table spans more than one screen.
- Horizontal scroll is 'somewhat acceptable' for large tables on mobile, provided the overflow is visible (a cut-off column or an arrow). Dots are easy to miss.
- Lock the left (row header) column when scrolling horizontally.
- Let users choose which columns to view; use accordions for groups.

The practical split:

- **Card or list projection** suits record-level tables where each row is a thing to act on, and where five or fewer fields matter on a phone. Pick priority columns and move the rest into the expanded view.
- **Horizontal scroll with a sticky first column** suits comparisons and dense numeric data, where the user needs to scan across columns.
- **Column chooser** (NN/g) lets users trade columns for legibility.

A secondary summary (wpDataTables, June 2026) makes the same split: card layouts for tables with many columns, a fixed first column for some. I did not read a primary source on card projection specifically, so rate that split as medium confidence.

## 9. Scroll behaviour and navigation transitions

- **Overscroll.** MDN gives `auto`, `contain` and `none` for each axis. `contain` stops scroll chaining. Chrome's post says `overscroll-behavior: contain` on `html` prevents overscroll navigation (the back/forward gesture on Chrome Android). For pull-to-refresh, set `overscroll-behavior-y: contain` on the scrolling root, which disables the native refresh without a non-passive touch listener.
- **iOS support.** Chrome's 2018 post said other browsers were 'in development'. MDN's current page marks the property as 'limited availability', so I could not confirm Safari support. Test on device before relying on it for scroll locks.
- **Momentum scrolling and rubber-banding.** The sources read don't address momentum (`-webkit-overflow-scrolling` is legacy); iOS uses native momentum by default for scrollable regions.
- **View transitions.** The View Transition API provides `document.startViewTransition()` for same-document (SPA) transitions and `pagereveal` / `pageswap` events for cross-document ones. Accessibility issues (reading position, focus, live-region announcements) are part of the MDN rationale. The support status for cross-document transitions was not read here; basalt's TanStack Router integration of view transitions was not checked.
- **Scroll restoration and swipe-back.** Native swipe-back on iOS Safari and Chrome's history gestures were not sourced. Material's guidance (no swipe between destinations; re-select resets scroll) is the relevant rule for the tab bar.

## Recommendations for basalt-ui v3

- Set the base form-control font to 16px on `pointer: coarse`, and do not add `maximum-scale` or `user-scalable=no` to the viewport meta. Use `font-size-adjust` only if the design needs a visually smaller input, and test it on a device.
- Build sheets on Base UI Drawer. Use `snapPoints` for peek sheets, `VirtualKeyboardProvider` for any sheet with a form, and `data-base-ui-swipe-ignore` on horizontal carousels inside sheets.
- Keep the phone bottom bar to 3 to 5 items with labels. Put search as the trailing tab if it is a top-level destination. Route the rest through a More sheet, and hide the bar while a text field is focused.
- Use `dvh` for full-height shells, env() insets for the bar and sheet footer, and `viewport-fit=cover` only with those insets in place.
- Use `@media (hover: hover)` for hover styling, and make every hover-revealed element reachable by tap.
- Use 44pt/48dp hit areas with 8dp spacing for the design system's controls; the WCAG 2.5.8 floor is 24px.
- Use container queries for card and chart density; avoid stacked gutters on phones.
- For tables, offer both a card projection and a horizontal-scroll variant with a sticky first column, selected by data type.

## What stays open

- The exact iOS version that changed the input-zoom behaviour, if any. No WebKit release note read says so, and the 2026 reports say the zoom still occurs.
- Whether the `transform: scale()` approach avoids the zoom on current iOS. It is reasoned, not tested in any source here.
- Safari's support for `interactive-widget`, `overscroll-behavior`, `interest-invoker` popovers, cross-document view transitions, and `navigator.vibrate` (MDN compat data not read).
- Material 3 top app bar, navigation drawer, Expressive components and bottom-sheet specs were not read.
- Apple's Layout page (the primary source for the 44pt target) and the HIG sheets and menus pages were not read.
- Long-press, context menus, tooltips on touch: no primary source read.
- The `pointer` media feature and `inert` were not read from MDN.
