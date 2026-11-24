# modern-web-guidance, folded into basalt-ui

Issue 1291, 2026-11-15. Source: [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) at the clone of that day (`modern-web-guidance list`: 208 guides in 18 categories, plus a separate `chrome-extensions` skill with 24 reference files). This page is also the input of the dotfiles follow-up: the last column marks the rows that belong in the global React, TanStack and web rules, not in basalt.

## Verdict

basalt-ui already holds almost everything that has a basalt surface. Of the 208 guides, **10 adopt** (they fold into 6 findings: 1 code fix, 3 rule lines, 2 plan rows), **74 hold** (Base UI, the token layer, the router or a primitive already does it) and **124 reject** with the reason in the row. The separate `chrome-extensions` skill is one more reject row.

What changed in this repo:

| Finding                                                                                                                   | Change                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ime-safe-enter-submit`                                                                                                   | `commitsDraft` in `core/commit-key.ts`, shared with `useCommittedField`, `controls/search-filter.tsx` and the agent composer: the table search box and the text filter editor ignore the Enter that confirms an IME composition. Tests in `table/parts/toolbar.test.tsx`. |
| `autofill-*`, `forms`                                                                                                     | One `not guarded:` line in `agent/rules/basalt-ui.md`: autocomplete tokens and `inputMode`.                                                                                                                                                                               |
| `validate-input-after-interaction`, `required-field-feedback`, `select-menu-interaction`, `accessible-error-announcement` | The same line: validate on blur and on submit. Base UI and TanStack own the timing; `:user-invalid` is the CSS form of the same rule.                                                                                                                                     |
| `ime-safe-enter-submit` (rule side)                                                                                       | One `not guarded:` line in `agent/rules/basalt-state.md`: Enter-to-commit is `useCommittedField`.                                                                                                                                                                         |
| `form-fields-automatically-fit-contents`                                                                                  | Plan row `v3-mwg-textarea-field-sizing`.                                                                                                                                                                                                                                  |
| `scroll-progress-indicator`                                                                                               | Plan row `v3-mwg-progress-timeline`.                                                                                                                                                                                                                                      |

Shipped rule lines: 224 of 272 (`check-budgets`, area `agent`); each file holds its own budget (`AGENT_LINE_BUDGETS`). No new export, lint rule, dependency or primitive.

## Browser support used for the verdicts

Researched 2026-11-15 against MDN browser-compat-data and webstatus.dev; stable releases that day: Chrome 157, Firefox 160, Safari 27.2. basalt states no browser target of its own (no browserslist); the verdicts use "Baseline Newly or better in all three engines" as the line.

| Feature                                                            | Chrome    | Safari | Firefox                        | Baseline                                        |
| ------------------------------------------------------------------ | --------- | ------ | ------------------------------ | ----------------------------------------------- |
| `field-sizing: content`                                            | 123       | 26.2   | 152                            | Newly, 2026-06                                  |
| `:user-invalid`, `:user-valid`                                     | 119       | 16.5   | 88                             | Widely                                          |
| Scroll-driven animations (`animation-timeline`, `animation-range`) | 115       | 26     | 159                            | Newly, 2026-10                                  |
| `@starting-style`, `transition-behavior: allow-discrete`           | 117       | 17.5   | 129 (no `display` transitions) | Newly, 2024-08                                  |
| View Transitions, same document                                    | 111       | 18     | 144                            | Newly, 2025-10                                  |
| View Transitions, cross document                                   | 126       | 18.2   | no                             | Limited                                         |
| CSS anchor positioning                                             | 125       | 26     | 147                            | Newly per MDN; webstatus umbrella still limited |
| `command` / `commandfor`                                           | 135       | 26.2   | 144                            | Newly, 2025-12                                  |
| `scrollbar-color`                                                  | 121       | 26.2   | 64                             | Newly, 2025-12                                  |
| `text-wrap: balance`                                               | 114       | 17.5   | 121                            | Newly                                           |
| `text-wrap: pretty`                                                | 117       | 26     | no                             | Limited                                         |
| `contrast-color()`                                                 | 147       | 26     | 146                            | Newly, 2026-04                                  |
| `scheduler.yield()`                                                | 129       | no     | 142                            | Limited                                         |
| `interpolate-size`, `calc-size()`                                  | 129       | no     | no                             | Limited                                         |
| Speculation Rules                                                  | 109       | no     | no                             | Limited                                         |
| Temporal                                                           | 144       | no     | 139                            | Limited                                         |
| `dialog closedby`                                                  | 134       | no     | 141                            | Limited                                         |
| `popover="hint"`, `interestfor`                                    | 151 / 142 | no     | 153 / no                       | Limited                                         |

## legacy-scan

`npx modern-web-guidance@latest legacy-scan packages/basalt-ui/src` (33 guides, 35 rules, about 20% of the corpus; 669 test and doc files skipped): **2 findings**, both `ime-safe-enter-submit`: `table/parts/toolbar.tsx:54` and, by reading (the scan prints only the first path), the same line in `table/parts/toolbar-editor.tsx`. `legacy-scan apps/playground`: **0 findings**. After the fix the scan reports 0 for `src`. The CLI scans one path per run.

## Decision: the upstream skill is not recommended or wired

`basalt-ui init`, `sync` and `doctor` do not install, recommend or run it.

- Its SKILL.md says "MANDATORY: execute first for all HTML/CSS and clientside JS tasks" and fetches over the network on each task. In a basalt app that sends the agent to raw `dialog`, popover, anchor and CSS patterns that `basalt/import-boundary` and `basalt/primitive-bypass` forbid. The consumer chain is `DESIGN.md > the shipped basalt-* rules > skills`; a second always-first skill outranks it in practice.
- 80% of the guides have no basalt surface (carousels, passkeys, WebGL, WebMCP, extensions). The 20% with deterministic rules found 2 hits in 20k lines.
- The eval dashboard's numbers load by script after sign-in and could not be read; its method is controlled A/B runs on greenfield starter apps, which says nothing about an app built on a framework with its own rules.
- Cost of changing this: one `doctor` notice line and one line in `AGENTS-block.md.tpl`. A maintainer who wants the scan runs `legacy-scan` by hand; the command is above.

## Rows

Legend. Verdict: **adopt**, **holds**, **reject** with the reason: _base-ui_ (Base UI owns it; replacing it breaks the import boundary), _no surface_ (basalt ships no such primitive; it is consumer code, and adopt-or-delete forbids an export without a consumer), _known_ (the model already writes it right), _support_ (a target engine lacks it), _volatile_ (experimental, origin trial or behind a flag), _need_ (no measured problem; a guardrail without a measured need is excluded). Web rule: `✓` where the dotfiles web, React or TanStack rules should carry it.

### accessibility

| id                            | upstream says                              | basalt today                                                  | verdict            | web rule |
| ----------------------------- | ------------------------------------------ | ------------------------------------------------------------- | ------------------ | -------- |
| accessibility                 | Index: semantics, focus, forms, media      | Base UI parts plus `ui/field.tsx` labels; `PageBar` landmarks | holds              | ✓        |
| accessible-error-announcement | Mirror `:user-invalid` into `aria-invalid` | `controls/form-field.tsx` `invalid` plus a live error region  | holds              | ✓        |
| accessible-generated-content  | Alt text for `::before`/`::after` content  | no generated content with meaning                             | reject: no surface |          |
| respect-os-text-scale         | rem sizes follow the OS scale              | `css/typography.css` base `1rem`                              | holds              | ✓        |

### built-in-ai

| id                 | upstream says          | basalt today                          | verdict          | web rule |
| ------------------ | ---------------------- | ------------------------------------- | ---------------- | -------- |
| language-detection | On-device detector API | none                                  | reject: volatile |          |
| language-model     | Prompt API             | `src/agent` streams to a server model | reject: volatile |          |
| summarizer         | Summarizer API         | none                                  | reject: volatile |          |
| translator         | Translator API         | none                                  | reject: volatile |          |

### css

| id                               | upstream says                                    | basalt today                                                                        | verdict                                      | web rule |
| -------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------- | -------- |
| animate-to-intrinsic-sizes       | `interpolate-size` for height auto               | `ui/accordion.tsx` and `ui/collapsible.tsx` animate Base UI's panel-height variable | reject: support (Safari and Firefox lack it) |          |
| atrule-support-conditionals      | `@supports at-rule()`                            | not used                                                                            | reject: need                                 |          |
| calculate-with-intrinsic-sizes   | `calc-size()`                                    | not used                                                                            | reject: support                              |          |
| child-state-based-styling        | `:has()` on a child state                        | Tailwind `has-*` and Base UI `data-*` states                                        | holds                                        | ✓        |
| content-based-styling            | `:has()` on content                              | same                                                                                | holds                                        |          |
| css                              | Index: cascade, scope, nesting, tokens           | `@layer basalt.*` in `css/*.css`; tokens in `tokens/`                               | holds                                        | ✓        |
| css-layout                       | Index: flex, grid, subgrid, container queries    | container-keyed layout (`lint:viewport-keyed`), subgrid in `cards/stat-group.tsx`   | holds                                        | ✓        |
| design-token-reactivity          | Density and theme as inherited custom properties | `--vx-*` tiers, density law in `docs/DESIGN-CORE.md`                                | holds                                        |          |
| dynamic-sibling-styling          | `sibling-count()` spectrums                      | none                                                                                | reject: need                                 |          |
| fluid-scaling                    | `cqi` units for scaling                          | container tiers `@narrow`, `@regular`, `@wide`                                      | holds                                        |          |
| individual-transform-properties  | `translate`, `rotate`, `scale` apart             | Tailwind `translate-*` in `ui/sheet.tsx`                                            | holds                                        |          |
| overflow-clipping-control        | `overflow-clip-margin`                           | not needed                                                                          | reject: need                                 |          |
| reduce-style-repetition          | CSS `@function`                                  | not used; tokens and Tailwind variants                                              | reject: need                                 |          |
| responsive-design                | Container queries, `dvh`, aspect ratio           | `@container` in `table/`, `cards/`; `90dvh` in `ui/sheet.tsx`                       | holds                                        | ✓        |
| selector-atrule-combinations     | `@media` inside a selector                       | Tailwind variants                                                                   | reject: known                                |          |
| size-aware-styling               | Container queries                                | `lint:viewport-keyed`                                                               | holds                                        |          |
| style-parent-with-has            | `:has(:user-invalid)` on a label                 | Base UI `data-invalid` on `Field` root                                              | holds                                        |          |
| usage-aware-component-variations | Container style queries                          | `useSizeClass()` for chrome                                                         | reject: need                                 |          |

### forms

| id                                     | upstream says                                   | basalt today                                                                                                              | verdict                                        | web rule |
| -------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------- |
| animated-select-picker                 | Animated custom select                          | `ui/select.tsx` (Base UI) with `data-starting-style`                                                                      | holds                                          |          |
| autofill-address-form                  | `autocomplete` address tokens                   | no address form shipped; rule line                                                                                        | adopt                                          | ✓        |
| autofill-highlight-inputs              | Style `:autofill`                               | not styled                                                                                                                | reject: need                                   |          |
| autofill-payment-form                  | `cc-*` tokens                                   | rule line                                                                                                                 | adopt                                          | ✓        |
| autofill-sign-in-form                  | `username`, `current-password`                  | rule line                                                                                                                 | adopt                                          | ✓        |
| autofill-sign-up-form                  | `new-password`, `email`                         | rule line                                                                                                                 | adopt                                          | ✓        |
| brand-consistent-forms                 | `accent-color` on native controls               | Base UI checkbox, radio, slider, tokens                                                                                   | holds                                          |          |
| branded-select-styling                 | `appearance: base-select`                       | `ui/select.tsx` (Base UI) with a native variant                                                                           | reject: base-ui                                |          |
| custom-select-picker-layouts           | Unusual option layouts                          | `ui/select.tsx`, `ui/combobox.tsx`                                                                                        | holds                                          |          |
| form-fields-automatically-fit-contents | `field-sizing: content`                         | `ui/textarea.tsx` is `resize-y` at fixed rows; chat composer autosizes in script                                          | adopt: plan row `v3-mwg-textarea-field-sizing` | ✓        |
| forms                                  | Index: labels, errors, autofill                 | `ui/field.tsx`, `controls/form-field.tsx`                                                                                 | holds                                          | ✓        |
| ime-safe-enter-submit                  | Ignore Enter while `isComposing` or keyCode 229 | `use-committed-field.ts` held; `search-filter.tsx` and the composer lacked keyCode 229 and the table toolbar had no check | adopt: fixed                                   | ✓        |
| required-field-feedback                | Required error only after interaction           | form layer validates on blur                                                                                              | adopt: rule line                               | ✓        |
| rich-media-picker                      | Rich options in a select                        | `ui/combobox.tsx` items are nodes                                                                                         | holds                                          |          |
| select-menu-interaction                | Select error only after interaction             | same                                                                                                                      | adopt: rule line                               |          |
| slider                                 | Style a range input                             | `ui/slider.tsx` (Base UI)                                                                                                 | holds                                          |          |
| sms-otp-form                           | `autocomplete=one-time-code`, WebOTP            | no OTP form                                                                                                               | reject: no surface                             | ✓        |
| switch                                 | `<input switch>`                                | `ui/switch.tsx` (Base UI)                                                                                                 | holds                                          |          |
| validate-input-after-interaction       | `:user-invalid` timing                          | validators run on blur and submit                                                                                         | adopt: rule line                               | ✓        |

### html

| id                              | upstream says                          | basalt today                         | verdict            | web rule |
| ------------------------------- | -------------------------------------- | ------------------------------------ | ------------------ | -------- |
| accessible-web-components       | ARIA through ElementInternals          | no custom elements                   | reject: no surface |          |
| custom-elements                 | Lifecycle rules                        | none                                 | reject: no surface |          |
| form-associated-custom-elements | `formAssociated`                       | none                                 | reject: no surface |          |
| html                            | Index: dialog, popover, details, focus | Base UI dialog, popover, collapsible | holds              | ✓        |
| prerendering-custom-elements    | SSR plus hydrate elements              | none                                 | reject: no surface |          |
| shadow-dom                      | Encapsulation                          | none; tokens cascade                 | reject: no surface |          |
| styling-web-components          | `::part`, `:host`                      | none                                 | reject: no surface |          |
| web-components                  | Index                                  | none                                 | reject: no surface |          |

### js

| id                              | upstream says            | basalt today                                             | verdict         | web rule |
| ------------------------------- | ------------------------ | -------------------------------------------------------- | --------------- | -------- |
| calculate-event-differentials   | `Temporal.Duration`      | `format/date.ts` on `Intl`                               | reject: support |          |
| capture-location-agnostic-data  | `Temporal.PlainDate`     | `ui/date-picker.tsx` builds the local day from ISO parts | reject: support |          |
| coordinate-global-events        | `Temporal.ZonedDateTime` | no scheduling surface                                    | reject: support |          |
| sort-high-precision-timestamps  | `Temporal.Instant`       | none                                                     | reject: support |          |
| support-global-calendar-systems | Non-Gregorian calendars  | `Intl.DateTimeFormat` in `format/`                       | reject: need    |          |

### performance

| id                                   | upstream says                             | basalt today                                                          | verdict               | web rule |
| ------------------------------------ | ----------------------------------------- | --------------------------------------------------------------------- | --------------------- | -------- |
| batch-analytics-events               | One beacon for many events                | `telemetry.ts`                                                        | reject: need          |          |
| break-up-long-tasks                  | `scheduler.yield()`                       | virtualized tables; no long handler measured                          | reject: support, need | ✓        |
| calculate-total-foreground-time      | `visibilitychange` accounting             | none                                                                  | reject: no surface    |          |
| conditional-async-dependencies       | Lazy polyfill import                      | none                                                                  | reject: known         |          |
| defer-rendering-heavy-content        | `content-visibility: auto`                | `ui/virtual-list.tsx`, DataTable `virtual`                            | holds                 | ✓        |
| defer-work-until-scroll-ends         | `scrollend`                               | none                                                                  | reject: need          |          |
| deliver-optimized-decorative-images  | AVIF with fallback                        | no decorative images shipped                                          | reject: no surface    |          |
| deprioritize-background-fetches      | `fetch priority: low`                     | fetches go through `liveQuery` (`lint:data-primitive`)                | reject: need          |          |
| detect-initial-visibility-state      | `prerendering`, `visibilityState`         | none                                                                  | reject: no surface    |          |
| efficient-background-processing      | Pause work when hidden                    | `core/channel.ts` and `data/synced-runtime.ts` read `visibilityState` | holds                 |          |
| faster-spa-view-transitions          | Keep a visited view's DOM for a fast back | route transitions in `provider/route-transition.ts`; no kept DOM      | reject: need          |          |
| flicker-free-client-side-ab-testing  | Anti-flicker snippets                     | none                                                                  | reject: no surface    |          |
| full-session-analytics               | `pagehide` beacon                         | none                                                                  | reject: no surface    |          |
| identify-heavy-scripts               | Long Animation Frames                     | none                                                                  | reject: no surface    |          |
| identify-inp-causes                  | INP diagnosis                             | none                                                                  | reject: no surface    |          |
| improve-next-page-load-performance   | Speculation Rules prefetch                | `routerDefaults` intent preloading, Query-owned freshness             | holds                 | ✓        |
| interaction-paint-timing             | Interaction timing                        | none                                                                  | reject: no surface    |          |
| interactions-in-complex-layouts      | Avoid layout thrash                       | container-keyed CSS, no forced layout in handlers                     | holds                 |          |
| lazy-load-video-and-audio            | Defer media                               | no media primitive                                                    | reject: no surface    |          |
| optimize-image-priority              | `fetchpriority` for LCP                   | none                                                                  | reject: no surface    |          |
| optimize-preload-priority            | `<link rel=preload>` priority             | none shipped                                                          | reject: need          |          |
| optimize-script-priority             | `async`, `defer`                          | Vite output                                                           | reject: known         |          |
| out-of-order-html-streaming          | Declarative streaming                     | SPA                                                                   | reject: volatile      |          |
| performance                          | Index: CWV, loading, interaction          | `check-budgets` byte budgets                                          | holds                 | ✓        |
| resolution-optimized-pseudo-elements | Image set in pseudo-elements              | none                                                                  | reject: no surface    |          |
| schedule-tasks-by-priority           | `scheduler.postTask`                      | none                                                                  | reject: need          |          |

### privacy, pwa

| id                     | upstream says               | basalt today                               | verdict            | web rule |
| ---------------------- | --------------------------- | ------------------------------------------ | ------------------ | -------- |
| privacy                | Index: minimization, audits | `basalt-ui` ships no tracking              | reject: no surface |          |
| install-web-app        | Install API                 | `basaltAppPlugin` writes the manifest only | reject: no surface |          |
| migrate-web-app-origin | Origin migration            | none                                       | reject: volatile   |          |

### security

| id                            | upstream says                    | basalt today                                           | verdict            | web rule |
| ----------------------------- | -------------------------------- | ------------------------------------------------------ | ------------------ | -------- |
| client-side-encryption        | Hybrid PQ crypto                 | none                                                   | reject: no surface |          |
| digital-signatures            | WebCrypto signatures             | none                                                   | reject: no surface |          |
| local-network-access          | LNA permission                   | none                                                   | reject: no surface |          |
| passkey-authentication        | WebAuthn sign-in                 | auth is the consumer's                                 | reject: no surface |          |
| passkey-conditional-create    | Silent passkey create            | same                                                   | reject: no surface |          |
| passkey-management            | List passkeys                    | same                                                   | reject: no surface |          |
| passkey-reauthentication      | Step-up                          | same                                                   | reject: no surface |          |
| passkey-registration          | Register                         | same                                                   | reject: no surface |          |
| passkeys                      | Index                            | same                                                   | reject: no surface |          |
| quick-sign-ins                | Credential Management            | same                                                   | reject: no surface |          |
| restrict-outbound-connections | CSP `connect-src`                | consumer headers                                       | reject: no surface | ✓        |
| sanitize-untrusted-html       | Sanitizer API                    | `contentTrust="untrusted"` (`lint:untrusted-markdown`) | holds              | ✓        |
| secure-external-subresources  | SRI                              | no third-party assets                                  | reject: no surface |          |
| security                      | Index: XSS, CSP, cookies         | `lint:untrusted-markdown`                              | holds              | ✓        |
| trusted-types                 | Trusted Types policy             | none                                                   | reject: need       |          |
| validate-origins              | `URL.origin`, not string parsing | the one origin check is `cli/shot/serve.ts`            | reject: no surface | ✓        |
| verify-email-ownership        | Email Verification               | none                                                   | reject: no surface |          |

### ui-atoms

| id                                  | upstream says                                   | basalt today                                                    | verdict                                    | web rule |
| ----------------------------------- | ----------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------ | -------- |
| carousel-slide-effects              | Scroll-driven slide effects                     | no carousel                                                     | reject: no surface                         |          |
| component-specific-light-dark-theme | `color-scheme` per element                      | `data-theme` scoping in `css/tokens.css`                        | holds                                      |          |
| icons                               | `currentColor`, `aria-hidden`, text alternative | `IconComponent` type, icon passed in                            | holds                                      |          |
| position-aware-tooltips             | Arrow follows the flip                          | Base UI positioner and arrow, `ui/tooltip.tsx`                  | reject: base-ui                            |          |
| pull-to-reveal                      | Pull-down reveal                                | none                                                            | reject: no surface                         |          |
| responsive-table                    | Header semantics, small screens                 | `table/`: phone cards or `phone: 'scroll'`                      | holds                                      |          |
| scroll-position-aware-elements      | Back-to-top                                     | none                                                            | reject: no surface                         |          |
| scroll-progress-indicator           | `animation-timeline: scroll()`                  | `page/article-progress.tsx` measures in script                  | adopt: plan row `v3-mwg-progress-timeline` | ✓        |
| scrollability-affordance-hints      | Scroll shadows                                  | `ui/scroll-area.tsx` draws none                                 | reject: need (a look choice, not a defect) |          |
| shrinking-header-on-scroll          | Scroll-driven header                            | fixed `PageBar`; restraint law                                  | reject: need                               |          |
| single-line-overflow                | Ellipsis plus the full text on hover            | `truncate` in `cards/stat-card.tsx`, `dashboard/event-list.tsx` | holds                                      |          |
| state-aware-sticky-headers          | `:stuck`                                        | sticky rows in `common/virtual-rows.tsx`                        | reject: need                               |          |
| viewport-aware-dropdowns            | Flip at viewport edges                          | Base UI positioner                                              | reject: base-ui                            |          |

### ui-behaviors

| id                                     | upstream says                             | basalt today                                                           | verdict                  | web rule |
| -------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------- | ------------------------ | -------- |
| 2d-panning                             | Free pan surfaces                         | none                                                                   | reject: no surface       |          |
| anchor-positioning-tab-underline       | Anchored tab indicator                    | `ui/tabs.tsx` indicator from Base UI vars                              | holds                    |          |
| animate-element-entry-exit             | `@starting-style`, `allow-discrete`       | `data-starting-style` and `data-ending-style` in `ui/*`                | holds                    | ✓        |
| animate-to-from-top-layer              | Animate dialog, popover, tooltip          | `ui/dialog.tsx`, `sheet.tsx`, `popover.tsx`, `tooltip.tsx`, `menu.tsx` | holds                    | ✓        |
| carousel-snap-highlights               | Highlight snapped item                    | none                                                                   | reject: no surface       |          |
| consistent-cross-document-transitions  | Block until styles load                   | SPA                                                                    | reject: support          |          |
| cross-document-transitions             | `@view-transition`                        | SPA                                                                    | reject: support          |          |
| custom-button-actions                  | `command`, `commandfor`                   | Base UI triggers own it                                                | reject: base-ui          |          |
| declarative-dialog-popover-control     | `commandfor` on a dialog                  | Base UI `Trigger`                                                      | reject: base-ui          |          |
| directional-navigation-transitions     | Slide by direction                        | `ROUTE_TRANSITION_TYPES` forward, back, sibling                        | holds                    | ✓        |
| drag                                   | Drag a floating element                   | none                                                                   | reject: no surface       |          |
| drag-and-drop                          | Reorder children                          | none                                                                   | reject: no surface       |          |
| dynamic-sibling-animations             | Staggered delays                          | none; restraint law                                                    | reject: need             |          |
| dynamic-sort                           | Animated reorder                          | DataTable sorts without animation                                      | reject: need             |          |
| group-element-transitions              | Animated list moves                       | none                                                                   | reject: need             |          |
| highlight-text-ranges                  | CSS Custom Highlight API                  | none                                                                   | reject: no surface       |          |
| interactive-content-reveal             | Pointer spotlight                         | none                                                                   | reject: no surface       |          |
| interest-triggered-action-previews     | `interestfor` previews                    | none                                                                   | reject: support          |          |
| interest-triggered-tooltips            | `interestfor`, `popover=hint`             | `ui/tooltip.tsx` (Base UI)                                             | reject: base-ui, support |          |
| light-dismiss-a-dialog                 | Outside click closes                      | Base UI dialog                                                         | holds                    |          |
| motion                                 | Compositor-only animation, reduced motion | `motion-reduce:` in `ui/*`; `styles.reduced-motion.test.ts`            | holds                    | ✓        |
| move-dom-element-without-losing-state  | `moveBefore`                              | none                                                                   | reject: need             |          |
| parallax-scroll-effects                | Scroll parallax                           | none                                                                   | reject: no surface       |          |
| persistent-top-layer-ui                | Keep overlays open across a move          | none                                                                   | reject: need             |          |
| physics-based-easing                   | `linear()` springs                        | `ease-standard` token                                                  | reject: need             |          |
| platform-controls-dismiss-dialog       | Esc, back gesture                         | Base UI dialog and drawer                                              | holds                    |          |
| prevent-page-scroll-under-modal-dialog | Scroll lock                               | Base UI scroll lock                                                    | holds                    |          |
| same-document-transitions              | Shared-element transitions                | route transition only; no shared element                               | holds                    |          |
| scoped-component-transitions           | Element-scoped view transitions           | none                                                                   | reject: need             |          |
| scroll-completion-effects              | `scrollend`                               | `page/toc-click-pin.ts` pins by script                                 | reject: need             |          |
| scroll-entry-exit-effects              | Reveal on scroll                          | none; restraint law                                                    | reject: need             |          |
| scroll-snap-realtime-feedback          | `scroll-state`                            | none                                                                   | reject: no surface       |          |
| scroll-snap-state-sync                 | Snap events                               | none                                                                   | reject: no surface       |          |
| scroll-target-on-load                  | `scroll-snap` target                      | none                                                                   | reject: no surface       |          |
| scrollytelling                         | Scroll-driven stories                     | none                                                                   | reject: no surface       |          |
| search-hidden-content                  | `hidden=until-found`                      | `ui/accordion.tsx` `hiddenUntilFound`                                  | holds                    |          |
| sortable-table                         | Sort by header                            | `table/` sort via kind columns                                         | holds                    |          |
| spatial-navigation                     | Arrow-key grid focus                      | `table/core/keyboard.ts`                                               | holds                    |          |
| swipe-to-remove                        | Swipe an item away                        | none                                                                   | reject: no surface       |          |
| swipe-to-reveal                        | Swipe to actions                          | none                                                                   | reject: no surface       |          |

### ui-components

| id                             | upstream says                   | basalt today                                                                | verdict            | web rule |
| ------------------------------ | ------------------------------- | --------------------------------------------------------------------------- | ------------------ | -------- |
| accordion                      | `<details name>` plus animation | `ui/accordion.tsx` (Base UI)                                                | holds              |          |
| app-menus                      | Menu bar                        | `ui/menu.tsx`                                                               | reject: no surface |          |
| breadcrumbs                    | `nav` plus `aria-current`       | `shell/app-breadcrumbs.tsx`                                                 | holds              |          |
| card                           | Container-aware card            | `ui/card.tsx`, `cards/`                                                     | holds              |          |
| carousel                       | Scroll-snap carousel            | none                                                                        | reject: no surface |          |
| checkbox                       | Styled native checkbox          | `ui/checkbox.tsx`                                                           | holds              |          |
| copy-button                    | Clipboard with feedback         | `content/copy-action.tsx`                                                   | holds              |          |
| dark-mode-toggle               | Override the system scheme      | `theme/theme-toggle.tsx`, `setScheme`                                       | holds              |          |
| dialog                         | Modal dialog, focus, dismissal  | `ui/dialog.tsx`                                                             | holds              |          |
| hovercard                      | Link preview card               | none; Base UI has one, basalt ships none                                    | reject: no surface |          |
| menu                           | Menu with submenus              | `ui/menu.tsx`                                                               | holds              |          |
| navbar                         | Responsive nav                  | `shell/` rail and `app-mobile-nav.tsx`                                      | holds              |          |
| navigation-drawer              | Slide-in nav                    | `ui/sheet.tsx`                                                              | holds              |          |
| persistent-app-tours           | Tethered tours                  | none                                                                        | reject: no surface |          |
| persistent-toast-notifications | Stackable toasts                | `ui/toast.tsx`, `page/toast-host.tsx`                                       | holds              |          |
| progress                       | Progress bar                    | `ui/progress.tsx`                                                           | holds              |          |
| progress-ring                  | Ring                            | none                                                                        | reject: no surface |          |
| scrollspy                      | Highlight the visible section   | `page/toc-spy.ts`                                                           | holds              |          |
| spinner                        | Busy state, reduced motion      | no Spinner; `ui/skeleton.tsx`, `motion-reduce` in `page/refresh-button.tsx` | holds              |          |
| stack-drill-down               | Full-screen drill-down          | `SplitPage` and `DetailHost` sheet                                          | holds              |          |
| tabs                           | Responsive tabs                 | `ui/tabs.tsx`, `ViewTabs`                                                   | holds              |          |
| toolbar                        | Toolbar with roving focus       | `ui/toolbar.tsx`                                                            | holds              |          |

### user-experience

| id                            | upstream says                  | basalt today                                                                    | verdict | web rule |
| ----------------------------- | ------------------------------ | ------------------------------------------------------------------------------- | ------- | -------- |
| content-first-noise-reduction | Fewer popups, compact chrome   | restraint law, one lit badge per page                                           | holds   |          |
| form-factor-adaptation        | Touch targets, fit, safe areas | `--basalt-ctl-h` on coarse, size classes, `env(safe-area-inset-*)` on the shell | holds   | ✓        |
| natural-interactions          | Hover, focus, press feedback   | `focus-ring`, Base UI states                                                    | holds   |          |

### visual-design

| id                                        | upstream says                              | basalt today                                         | verdict            | web rule |
| ----------------------------------------- | ------------------------------------------ | ---------------------------------------------------- | ------------------ | -------- |
| adapt-scrollbar-to-contrast-preferences   | Stronger scrollbars on `prefers-contrast`  | `forced-colors` blocks; none for `prefers-contrast`  | reject: need       |          |
| apply-webgl-shaders                       | HTML in WebGL                              | none                                                 | reject: no surface |          |
| browser-ui-theming                        | Style selection, scrollbar, pickers in CSS | `caret-color`, `scrollbar-color` in `styles.css`     | holds              | ✓        |
| color                                     | Contrast, schemes, forced colors           | derived palette (`tokens/derive.ts`), `color-scheme` | holds              | ✓        |
| complex-shapes                            | `clip-path`, `shape()`                     | none                                                 | reject: no surface |          |
| contrast-color                            | `contrast-color()`                         | generated `on-brand` ink (`lint:fixed-colour`)       | holds              |          |
| custom-text-decorations                   | Underline shapes                           | none                                                 | reject: no surface |          |
| customize-scrollbar-color-and-thickness   | `scrollbar-color`, `scrollbar-width`       | `styles.css`, `ui/scroll-area.tsx`                   | holds              |          |
| dark-mode                                 | `color-scheme`, `light-dark()`             | tokens switch per scheme (`lint:dark-fork`)          | holds              | ✓        |
| equal-width-text-lines                    | Poster text                                | none                                                 | reject: no surface |          |
| export-html-media-from-canvas             | `drawElement`                              | none                                                 | reject: volatile   |          |
| expose-canvas-content-to-browser-features | Canvas text access                         | charts expose `ariaLabel`                            | reject: need       |          |
| improve-text-layout-and-legibility        | `text-wrap: balance`, `pretty`             | `css/prose.css`, `PageBar`                           | holds              | ✓        |
| interactive-content-in-3d-scenes          | HTML in 3D                                 | none                                                 | reject: no surface |          |
| precise-text-alignment                    | `text-box-trim`                            | none                                                 | reject: need       |          |
| shaped-cutouts                            | Knockouts                                  | none                                                 | reject: no surface |          |
| soft-edge-content-fade                    | Mask fade at edges                         | none                                                 | reject: need       |          |
| typography                                | Sizing units, line height, wrapping        | `--vx-text-*` scale, `css/typography.css`            | holds              | ✓        |
| visual-effects                            | Layered shadows, blend modes               | `shadow-overlay` token                               | holds              |          |
| visually-stable-font-fallbacks            | `size-adjust` fallback faces               | `size-adjust` in `css/typography.css`                | holds              |          |
| visually-stable-mixed-fonts               | Metric-matched mixed fonts                 | same                                                 | holds              |          |
| visually-texture-content                  | Weathering textures                        | none; restraint law                                  | reject: no surface |          |

### wasm, webmcp, chrome-extensions

| id                                       | upstream says                       | basalt today | verdict            | web rule |
| ---------------------------------------- | ----------------------------------- | ------------ | ------------------ | -------- |
| cpp-on-the-web                           | Emscripten                          | none         | reject: no surface |          |
| agentic-forms                            | WebMCP attributes on forms          | none         | reject: volatile   |          |
| agentic-javascript-tools                 | WebMCP imperative tools             | none         | reject: volatile   |          |
| webmcp                                   | Index                               | none         | reject: volatile   |          |
| chrome-extensions (skill, 24 references) | Extension APIs and Web Store review | none         | reject: no surface |          |

## Follow-ups

- `docs/plan.yaml`: `v3-mwg-textarea-field-sizing` (the Textarea grows with its content where `field-sizing` holds, Baseline Newly since 2026-06) and `v3-mwg-progress-timeline` (`ArticleProgress` on `animation-timeline`, Baseline Newly since 2026-10). Each carries its brief under `docs/v3/issues/`.
- The dotfiles Issue reads the `✓` rows: IME-safe Enter, autofill tokens, validation timing, entry and exit into the top layer, view transitions, `content-visibility`, speculation and preload, `scheduler.yield` for a measured long task, text wrapping, scheme and colour, reduced motion.
