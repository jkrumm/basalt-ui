# v2 audit: controls-forms (src/controls, controls-dates, forms, format, common)

Scope read: every file under the five dirs except test bodies (sampled), plus consumer usage in argo, rb, linewatch and the guard plugin rule `forms-field-key`. Paths are relative to `packages/basalt-ui/`.

State: the filter family (FilterSet and its siblings) is the strongest part of the area, with real wrapper value over bare Mantine (store binding, surface swap, census). Around it sit three layers of leftover from the 2.0 surface trim: orphaned implementations, drifted duplicates, and docs naming things that no longer exist. `format` is a good idea with a correctness bug in `money`.

Severity key: blocker = wrong output or dead wiring a consumer can hit; major = API/structure debt; minor = polish.

## Findings

### 1. [blocker] `money()` silently drops cents; its doc says the opposite

- Evidence: `src/format/number.ts:75` ("Fraction digits. Default 0 compacted, else the currency's own default (`undefined`)") vs `:84` `const fractionDigits = digits ?? (isCompact ? 1 : 0)` and `:89-90` min/max forced to it. Ran it: `money(12.5,{currency:'USD',locale:'en-US'})` -> `$13`; `money(1234.56,{currency:'EUR',locale:'de-DE'})` -> `1.235 €`.
- Wrong: a money formatter that rounds 12.50 to 13 is a data-integrity bug; the JSDoc promises Intl's currency default. The test only asserts `money(1234)` (`format/index.test.ts:16`), so it cannot see it.
- Proposal: `digits` undefined -> do not set min/max (currency default: 2 for USD/EUR, 0 for JPY). Add an explicit `digits: 0` opt-in for dashboards that want whole units. Add tests for 12.5, 1234.56, JPY.
- Breaking: yes (output changes), fix it as a bug. Consumers: argo (uses `percent`/`integer`, no `money` call found), none broken today, which is why it survived.

### 2. [blocker] Orphaned form-state wiring: FormRow/FormGroup/FormActions read a context nobody can provide

- Evidence: `src/forms/index.ts:16-18` exports only `useBasaltForm`, `inputProps`, `fieldKey`. `FormStateProvider`/`useFormState` live at `src/forms/form-state.tsx:66,92` and are deleted in `MIGRATING.md:686-687`. But `src/controls/form-layout.tsx:184,258,312` still call `useFormState()` and set `<fieldset disabled={disabled}>`. `form-state.tsx:20` doc example calls `useFormSubmit`, which no longer exists anywhere.
- Wrong: `disabled` is a constant `false`; the "disable everything while submitting" feature the file's 20-line header sells cannot be reached. The `form-layout.tsx:19` doc still advertises it.
- Proposal: pick one. (a) Delete `form-state.tsx` (+ test), `FormSection`, `FormActions`, and the `useFormState` reads; (b) if the busy-propagation is wanted, ship `FormStateProvider` and give `useBasaltForm` a `submitting` handle so it is one wiring. Given one consumer (finding 4), choose (a).
- Breaking: no (nothing public). Consumers: none.

### 3. [major] Unreachable but live code: `FormSection`, `FormActions`, `ControlGroup` public symbols, plus their tests and docs

- Evidence: `src/controls/index.ts:20` exports only `FormRow, FormGroup`. `FormSection` (`form-layout.tsx:105`), `FormActions` (`:307`), `form-state.tsx` are exported from no barrel. `ControlGroup` is deleted publicly (`MIGRATING.md:711`) but `control-group.tsx` (70 lines + 229 lines of test + CSS) survives only as an internal of `actions.tsx:25`. `form-layout.test.tsx` (298 lines) and `form-state.test.tsx` test unreachable API. `form-layout.tsx:2` doc still lists "`FormSection`, `FormRow`, `FormGroup`, `FormActions`". Friction row 47 already recorded `llms.txt` naming these (argo-friction.md:59).
- Proposal: delete FormSection/FormActions/form-state and their tests (net about -900 lines). Fold `ControlGroup` into `actions.tsx` as a private join wrapper, delete the standalone test. Add a dead-export check to `check-budgets`/`check-agent-doc-drift` (a module-level `export` reachable from no `surfaces.ts` subpath and no internal import fails).
- Breaking: no. Consumers: none.

### 4. [major] FormRow: the documented usage produces an unlabelled input; argo's only call site is broken the same way

- Evidence: `form-layout.tsx:193` renders `<label htmlFor?>` only when the caller passes `htmlFor`; its own examples (`:170-172`, `:176`) omit it. Its doc admits "Mantine generates one per input, so pass the SAME id" (`:149-152`), which a caller cannot do for a Mantine input without also passing `id`. argo `apps/dashboard/src/features/m365-explorer/explorer-page.tsx:584-617` uses `<FormRow label="Label">` around a `Stack` of a `Select` and a `TextInput`, no `htmlFor`: label names nothing; both controls are unnamed to AT. Only 1 consumer file in 6 apps uses FormRow/FormGroup at all.
- Wrong: the primitive's whole job is the label-control association, and the default path breaks WCAG 1.3.1/4.1.2. `error` double-render is a second documented footgun (`:139-144`).
- Proposal: reimplement `FormRow` on Mantine's `Input.Wrapper` (label/description/error/required/id all native, `inputWrapperOrder`) laid out in the row grid, with children taking `id` from Wrapper context, or a render prop `children: (a: {id: string; error: ReactNode}) => ReactNode`. Single `error` ownership is then structural. If that is not worth it for one consumer, delete FormRow/FormGroup too and point forms at `SettingsRow` + Mantine inputs (adopt-or-delete).
- Breaking: yes. Consumers: argo explorer-page.

### 5. [major] Four near-identical relative-time implementations, three of them in basalt itself

- Evidence: `src/format/date.ts:68-81` (`relativeTime`), `src/agent/chat/relative-time.ts:11,52` (own `Intl.RelativeTimeFormat('en')` + own `'just now'`; `date.ts:61` says `format` was "seeded from" it, i.e. it was never replaced), `src/controls/sync-button.tsx:58-67` (`formatAge`: `Nm ago`, `Nh ago`, `Nd ago`, exported), `src/commands/notifications/center.tsx:41-45` (a fourth `just now/m ago/h ago`). Consumers: argo has 10 `relativeTime` imports, so the public one is adopted.
- Wrong: three vocabularies for the same phrase (`3 hours ago` vs `3h ago`), two with no locale. The `format` module's own "one implementation" claim (`format/index.ts:1-6`) is false inside the package.
- Proposal: add `relativeTime(value, { style: 'long' | 'short' | 'narrow', now, locale })` mapping to `Intl.RelativeTimeFormat`'s `style` (gives `3 hr. ago` / `3h ago`), delete the other three, keep `useRelativeAge` in SyncButton as a thin subscriber. Make `now` injectable so the three call sites are testable.
- Breaking: no for consumers (`formatAge`/`AGE_REFRESH_MS` are not on the barrel). Consumers: argo/rb/linewatch indirectly via the shell.

### 6. [major] `format` has no default-locale story and consumers re-pin `en-US` in a dozen places

- Evidence: `format/shared.ts:17-19` `locale` defaults to `undefined` = runtime locale. Consumer workarounds: rb `apps/web/src/lib/format.ts:3-13` ("the mini's Chrome reports de-DE ... 1112 renders as 1.112"), argo `strength-tracker/components/workout-form.tsx:36-43`, argo `lib/fill-sources.ts:75`, argo `walking-pad/formatters.ts:50`, linewatch `web/src/lib/format.ts:107-115` (own `makeClockFormat`/`makeDateTimeFormat`), rb `journal/page.tsx:26`, `stats/page.tsx:40`, `ingest/page.tsx:608-609`. About 40 raw `Intl.*`/`toLocale*String` calls remain across argo/rb/linewatch for date/time/number-with-unit.
- Wrong: formatters default to the exact behaviour every consumer fought (locale from the browser: hydration mismatches under SSR, German thousands separators on an English app). The date half of the module is too thin (`weekday`, `relativeTime`, `durationClock` only) so consumers reach for raw Intl.
- Proposal: (1) app-wide default via `BasaltProvider locale="en-US"` (or `defineFormat({ locale, timeZone })` once at module load) that every formatter reads, per-call `locale` stays an override. Default to `'en-US'`, not `undefined`, since "English app" is the repo-wide contract. (2) Add `date`, `time`, `dateTime` (with `timeZone`) and `duration` (unit-aware: `1h 05m`) so rb/linewatch/argo local formatters delete. (3) Add a `basalt/raw-intl` or `no-tolocale` oxlint rule pointing at `basalt-ui/format`.
- Breaking: no for existing calls (default changes only for apps that relied on host locale; none do). Consumers: argo, rb, linewatch.

### 7. [major] `relativeTime` boundary and locale defects

- Evidence: `format/date.ts:78` hardcoded English `'just now'` even for `locale: 'de'` (ran: `relativeTime(now-30_000,{locale:'de'})` -> `just now`); `:79` picks the unit by the unrounded value then rounds, so 59.98 min yields `60 minutes ago` (ran) instead of `1 hour ago`; a future 30s stamp also reads `just now`; no `numeric: 'always'` option.
- Proposal: use `Intl.RelativeTimeFormat`'s `numeric:'auto'` for the sub-minute case (`format(0,'second')` -> `now`), round first then promote unit (`while rounded >= next threshold`), and expose `numeric` option.
- Breaking: no. Consumers: argo (10 call sites).

### 8. [major] `RangeFilter` forks the format module and the dev-warning module

- Evidence: `range-filter.tsx:256-263` private `new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' })` instead of `format/shared.ts#dateFormat`; `:52-72` a private `noPickerWarned` Set + `console.warn('[basalt-ui] ...')` instead of `common/validate.ts#reportOnce`. The two prefixes disagree: `[basalt-ui]` here vs `BASALT_PREFIX = '[basalt]'` (`common/errors.ts:13`); it also bypasses `process.env` constant-fold discipline by re-reading it.
- Proposal: route both through `format` (`date(value, {month:'short', day:'numeric', timeZone:'UTC'})` once finding 6 lands) and `reportOnce(component, missingLayer/ignoredProp-style message)`. Add an `oxlint` no-console allowlist of exactly `common/validate.ts`.
- Breaking: no. Consumers: none.

### 9. [major] `forms`: the two-call idiom + a 100-line fixable lint rule is the wrong abstraction; the layer is ~1 consumer

- Evidence: `forms/field.ts:86-134` (`inputProps`/`fieldKey` are renames of `getInputProps`/`key`); the ONLY consumer is argo `lib/auth-gate.tsx:4,32,58-59`; argo `warden/issues-section.tsx:311,338` uses bare `useForm` + `form.getInputProps` in the same repo, unguarded. The footgun has a dedicated oxlint rule `configs/oxlint-plugin.js:3238-3345` (`basalt/forms-field-key`, with autofix and import editing), a rule file bullet, and 40 lines of file-header prose (`field.ts:1-17`) explaining why `key` could not be bundled.
- Wrong: the package invented an API whose failure mode (forgetting the key silently breaks `reset()`) needs a lint rule, and then did not make it exclusive: nothing forbids `useForm` from `@mantine/form`.
- Proposal: collapse to one call that cannot be misused: `<Field of={form} name="email" as={TextInput} label="Email" />` (or `form.Field`-style bound component from `useBasaltForm`), `key` set internally, `error: ReactNode` typed once, boolean fields via `as={Switch}` auto `type:'checkbox'`. Delete `fieldKey`, `inputProps`, the lint rule and its tests. Add `basalt/no-raw-useform` (import `useForm` from `@mantine/form` outside `forms/`). Alternative if a component is rejected: keep `useBasaltForm` only (its real value is `schema` + `mode:'uncontrolled'`) and document Mantine's own idiom.
- Breaking: yes. Consumers: argo auth-gate (1 file), argo issues-section would be pulled onto it.

### 10. [major] `useBasaltForm` cannot compose with cross-field validation and duplicates `mode`

- Evidence: `forms/create-form.ts:12-20` `Omit<UseFormInput<Values>, 'validate'>` removes `validate` but re-adds `mode` that `UseFormInput` already declares (redundant, and the Omit hides a legitimate `validate` merge); `schema` is `StandardSchemaV1<unknown, Values>` and `schemaResolver(..., { sync: true })` (`:54`) throws at validate-time for an async Standard Schema; no `validateInputOnBlur`/`clearInputErrorOnChange` basalt default.
- Proposal: keep `validate` alongside `schema` (schema first, then `validate` overlays cross-field messages); detect a Promise from the standard schema and throw a named error (`reportOnce`) at construction; drop the redundant `mode` redeclaration.
- Breaking: no. Consumers: argo auth-gate.

### 11. [major] `useTrackFits`: ~130 lines of JS measurement to decide track vs `Select`, against law C9 and SSR

- Evidence: `controls/panel-row.tsx:230-352` (two layout effects, ResizeObserver on parent and root, speculative remount, a `.mantine-SegmentedControl-label` class selector at `:179` coupling to Mantine internals, `getComputedStyle` per ancestor at `:148`). Used by `PanelChoice` (`:371`) and `ViewTabs` phone form (`view-tabs.tsx:94`). `view-tabs.tsx:96` and `panel-row.tsx:374` build `dataKey` from option VALUES only, so a runtime catalogue whose labels change (`EUR · 1.08`) never re-measures.
- Wrong: the server paints the track, the client may swap to a `Select` before paint (a mismatch on hydration), and the track's `min-width: max-content` clipping is worked around in JS instead of fixed in CSS. Complex enough to be the single likeliest place for an unreproducible layout bug.
- Proposal: decide by data not pixels: `fitsTrack = options.length <= 3 && totalLabelChars <= LIMIT` (character budget, no measurement), or render the Select always in `panel`/`sheet` (a 300px column rarely benefits from a segmented track) and keep the track for `ViewTabs` desktop only. Delete `useTrackFits`, `measureMounted`, `layoutParent` (-130 lines). Include labels in any key that remains.
- Breaking: no (visual only). Consumers: argo/linewatch/rb ViewTabs on phones.

### 12. [major] Three hand-rolled fold/measure engines; the shared core has one client

- Evidence: `common/use-measured-widths.ts:1-91` documents itself as "the measured-fold core every fold planner shares", but its only non-test importer is `table/data-table-state.ts:17`. `controls/actions.tsx:563` (`useMeasuredFold`, own ResizeObserver) and `controls/filter-set.tsx:173-217` (`useOverflowFit`, own ResizeObserver, own width cache) re-implement it. FilterSet observes the slots present when the effect ran (`:208-210`; deps `[rowRef, count, canObserve]`) and caches widths by INDEX (`:175,187`), so replacing one filter with another of the same count keeps stale widths and unobserved slots.
- Proposal: move FilterSet and `useMeasuredFold` onto `useMeasuredWidths` (keyed by `slot.dataset.filterKey` from the child key, `signature` = joined keys). Delete 2 observers. Cap `FOLD_PILL_WIDTH = 52` (`filter-set.tsx:45`) by measuring the fold pill once.
- Breaking: no. Consumers: argo/linewatch/rb `FilterSet`.

### 13. [major] `BarActionItem` allows contradictory states and `SlotActions` reintroduces children

- Evidence: `controls/actions.tsx:33-58`: `onClick?`, `link?`, `Anchor?` are independent optionals (neither, or both `onClick` and `link`, type-checks; `Anchor` without `link` is meaningless); `kind?: undefined` is a discriminant that is optional on one arm; `group?: true` and `mobile?:` per item duplicate what `PageBarActions` position already encodes. `isBarActionList` (`:876-889`) is a heuristic ("object with string `key` and not a React element") and treats `[]` and mixed arrays by convention. `SlotActions = BarAction[] | ReactNode` (`:863`) lets a form or Section take raw children, while the shipped rule says "Actions are typed data (BarAction[]), never children" (`agent/rules/basalt-controls.md`).
- Proposal: make the item a union `{ kind:'button', onClick } | { kind:'link', to/link, Anchor? } | { kind:'menu' } | { kind:'node' }` (discriminant required), derive mobile placement from position + one `mobile` on the node arm, replace the `isBarActionList` heuristic by a required array type (drop the ReactNode arm; `FormActions`'s only reason for it is deleted by finding 3).
- Breaking: yes (MIGRATING row: `kind` now required; codemod trivial). Consumers: argo, rb PageBar/Section actions.

### 14. [major] Prop shape drift across the filter family

- Evidence: `label`: required on Select/Multi/Number/Toggle (`select-filter.tsx:52`, `multi-select-filter.tsx:45`, `number-filter.tsx:~70`, `toggle-filter.tsx:26`), optional with silent defaults on Range `'Range'` (`range-filter.tsx:124`), Search `'Search'` (`search-filter.tsx:43`), ViewTabs `'View'` (`view-tabs.tsx:71`). `clearable`: Select and Number have it (`select-filter.tsx:55`, `number-filter.tsx:84`), MultiSelect always clears (`multi-select-filter.tsx:157`, no prop), Range/Toggle/Search none. `icon`: absent from Search/ViewTabs. Option shape: four spellings, `FilterOption` (`select-filter.tsx:45`, has `disabled`), `NumberFilterOption` (`number-filter.tsx:~55`), `ViewTabsOption` (`view-tabs.tsx:44`, has `only`), `PanelChoiceOption` (`panel-row.tsx:127`), plus the store's `FieldOption`. `MultiSelectFilter.noun` and `max` are filter-specific boolean-ish knobs with defaults computed from the label.
- Proposal: one `FilterBase = { label?: string, icon?, clearable? }` where `label` defaults to the store field's declared label (`store.labels()` already knows names) and is required only when the field carries none; one `Option` type (`{value,label,disabled?}`) shared by Select/Multi/Number/PanelChoice; `ViewTabsOption.only` extends it. Make `clearable` consistent (default true on Multi, available everywhere there is a non-default value).
- Breaking: mostly additive; Multi default behaviour unchanged. Consumers: all.

### 15. [major] Every filter repeats the same ~25-line boilerplate; the abstraction is missing

- Evidence: seven copies of `assertRequiredProps(<Name>, props, ['field'], { field: 'bind it to a store field (...)' })` (`select-filter.tsx:89`, `toggle-filter.tsx:33`, `multi-select-filter.tsx:80`, `search-filter.tsx:40`, `number-filter.tsx:~106`, `range-filter.tsx:117`, `view-tabs.tsx:68`); the surface branch `if (surface === 'sheet' || 'panel') return <PanelRow ...>` with `{...(className !== undefined && { className })}{...(style !== undefined && { style })}` repeated in 6 files (the `exactOptionalPropertyTypes` spread tax), `useFilterRegistration(!field.isDefault(value), () => field.clear())` in 6, and `const inSheet = ...; const inPanel = ...` in 5.
- Proposal: a `FilterShell` internal: `<FilterShell field label icon surface={{pill: (…), panel: (…)}} />` that owns assert, registration, naming (`useControlName`), PanelRow wrapper, className/style forwarding. Each filter shrinks to its body. And an `asField(name, props)` assertion helper. Also declare `className?: string | undefined` once in `BasaltProps` (already) and let the shell spread it.
- Breaking: no. Net-negative by roughly 250 lines.

### 16. [major] Stale docs and guard names reference things that do not exist

- Evidence: `CompareFilter` appears in `filter-set.tsx:28` (the JSDoc example), `enum-filter.tsx:2`, `number-filter.tsx:153`, `controls.router.test.tsx`, and `guard/index.ts:783` (regex alternation); it is exported nowhere. `SliderControl` is cited as a live example at `panel-row.tsx:18` and in `guard/index.ts:778`, `theme/index.ts:1430`, `state/fields.ts:146,450` (no such component). `number.ts:6-9` documents `compact`/`deltaPct` public names that are not in `format/index.ts`. `date.ts:1-3` header cites `clock`, `duration` (not exported; only `durationClock`). `common/index.ts:3` claims pieces are re-exported from the root barrel; the root re-exports only `scrollParentOf, useCoarsePointer, Tone` (`src/index.ts:24`).
- Proposal: grep-clean these; extend `check-agent-doc-drift.ts` to resolve every `Identifier` in a JSDoc `@example` / backticked PascalCase against the actual export graph for `src/**` doc comments (it covers docs and rules already).
- Breaking: no.

### 17. [major] `common/` is not common: chart messages, a dashboard type, a half-dead barrel

- Evidence: `common/errors.ts:~75-105` `plotBelowFloor` and `legendSlotContention` are chart-only (1 importer each, 0 tests); `ignoredProp` has 1 importer. `common/props.ts:63` `export type { WidgetHeaderTier as Tier } from '../dashboard/widget-header'` makes the "Mantine-free, layer-bottom" module depend on `dashboard` (type-only, but `boundary.test.ts` cannot see a type edge into the Mantine half). `common/index.ts` re-exports 9 groups while only `scrollParentOf`, `useCoarsePointer`, `Tone` leave the package; `reportOnce` and `useMediaQuery` are used but not in the barrel; `toErrorMessage`/`errorStatus` live in `errors.ts` yet are exported elsewhere (not from `common/index`).
- Proposal: move chart messages next to `charts/`, define `Tier` in `common/props.ts` and let `dashboard/widget-header` import it (direction fix), trim the barrel to what the rest of `src` imports, and rename `errors.ts` to `messages.ts` after splitting the transport-decoding half (`toErrorMessage`, `errorStatus`) into `common/error-message.ts`.
- Breaking: no.

### 18. [minor] `SearchFilter` loses the pending query on Enter/blur/unmount

- Evidence: `search-filter.tsx:107-112` only `useDebouncedCallback`; Mantine cancels it on unmount. Typing then navigating, pressing Enter, or blurring within 200ms writes nothing. `useDebouncedField` has no `flush`. No `type="search"`/`enterKeyHint="search"`, no clear affordance on the pill form.
- Proposal: commit immediately on Enter and blur (`commit.flush()`), flush on unmount, set `type="search"`, add a clear button (`rightSection`) when non-empty.
- Breaking: no.

### 19. [minor] `ToggleFilter` double-names its Switch and has no `disabled`

- Evidence: `toggle-filter.tsx:52-58` `<Switch id aria-label={label}>` plus `PanelRow htmlFor={id}` -> label announced twice/conflict; `FilterPill` has `pressed` but the pill form has no disabled/loading. No filter takes `disabled`, so a read-only view must unmount.
- Proposal: drop `aria-label` (the `htmlFor` label already names it); add `disabled?: boolean` once in `FilterBase` (finding 14).
- Breaking: no.

### 20. [minor] `RangeFilter` internals: cast, duplicated picker JSX, ineligible `custom` guard at runtime

- Evidence: `range-filter.tsx:129` `props as unknown as RangeFilterBase<P, boolean> & {...}` re-declares the prop type already on `props`; the Picker block is duplicated verbatim for panel (`:204-211`) and pill (`:231-238`); `warnCustomWithoutPicker` is a dev-warn for a state the type could rule out: `customPicker` should be required when the field is `custom: true` (`RangeField<P, true>` is already generic over C, finding the "legal preset-only" case is `custom:false`). RangeCustomPickerProps (`:79`) is needed to write a custom picker (docs invite it) but is not exported from `controls/index.ts`.
- Proposal: overloads on `C`: `RangeFilterProps<P, true>` requires `customPicker`, `<P,false>` forbids it; extract `<CustomPicker>` internal; export `RangeCustomPickerProps` (or fold `DateRangePicker` default in via the controls-dates subpath re-export).
- Breaking: type-level tightening only. Consumers: argo (passes `DateRangePicker`), linewatch (no custom).

### 21. [minor] `DateRangePicker` is a bare passthrough with no knobs

- Evidence: `controls-dates/date-range-picker.tsx:30-49`: no `minDate`/`maxDate`/`locale`/`numberOfColumns`/`excludeDate`; `value.from ?? null` accepts malformed strings silently; the subpath exists for 49 lines. A date-bounded analytics range (no future dates) cannot be expressed.
- Proposal: accept `{ minDate?, maxDate?, excludeDate?, locale? }` via `RangeFilter` `customPickerProps`, or let the field declare `max: 'today'` so the picker needs no props. If neither, justify the subpath as packaging-only in `surfaces.ts` and keep it.
- Breaking: no.

### 22. [minor] `km` and `kcal` are not locale-aware and the `kcal` unit string is wrong

- Evidence: `format/measure.ts:15` `toFixed(digits)` (always `.`), `:29` `"1.24 k cal"` (a seeded display string; the unit is `kcal`, "k cal" reads as thousand-calories) and tested as such (`format/index.test.ts:87`); `format/number.ts` `integer(-0.4)` -> `-0` (ran).
- Proposal: build on `Intl.NumberFormat` with `style:'unit', unit:'kilometer'` for `km`; for kcal use `compact` + `kcal` and a stable format (`1.24k kcal` or whole numbers); normalise `-0`.
- Breaking: yes (strings change). Consumers: argo walking-pad/garmin (`km`/`kcal` 5 imports).

### 23. [minor] Public/internal aliasing in `format`: two names per function, stale `fmt*` ones

- Evidence: `format/number.ts:67-68,96-97,105-106` `export const percent = fmtPercent`, `money = fmtCurrency`, `integer = fmtInt`; the file header (`:6-9`) says `fmt*` are "internal since 2.0 and delegated to by the public names". `fmtCompact` (the one the chart axes need) has no public name at all, though a dashboard needs a compact count (consumers hand-roll it with `toLocaleString`, argo `walking-pad/charts/sparkline-grid-chart.tsx:66`).
- Proposal: rename implementations to the public names (`percent`, `money`, `integer`, add public `compact`), keep a one-line `fmtX` import alias in charts only if needed, else delete. `LocaleOption.locale?: string` (`shared.ts:18`) should be `string | undefined` for exactOptionalPropertyTypes callers passing a possibly-undefined.
- Breaking: additive.

### 24. [minor] `format` cache keys stringify options on every call

- Evidence: `format/shared.ts:32,46` `JSON.stringify(options)` per `numberFormat()` call; the header (`:21-25`) justifies the cache by "one label per tick per frame". The key work costs about what constructing a small formatter costs.
- Proposal: build the formatter once per formatter-per-locale (module-level `Map<locale, Intl.NumberFormat>` per named style: percent0, int, compactK) and key by `locale` only; options-driven callers (`digits`) get a small keyed cache on a tuple string without JSON.
- Breaking: no.

### 25. [minor] Misplaced helpers in `filter-sheet.tsx`

- Evidence: `controls/filter-sheet.tsx:87` `CheckGlyph` and `:123` `useControlName` live in the Drawer module; `multi-select-filter.tsx:35`, `enum-filter.tsx:36`, six filters import the hook from a file named for a mobile sheet. Glyphs exist in `glyphs.tsx` and `sync-button.tsx:~108` (`RefreshGlyph`) and `search-filter.tsx:130` (`SearchIcon`), three inline SVG sources next to the shared `glyphs.tsx`.
- Proposal: `useControlName` -> `filter-context.tsx`/`control-name.ts`; `CheckGlyph`, `SearchIcon`, `RefreshGlyph` -> `glyphs.tsx`.
- Breaking: no.

### 26. [minor] Tests: breadth is high, but several suites pin deleted or internal surface

- Evidence: `form-layout.test.tsx` (298) and `form-state.test.tsx` (87) test unreachable exports (findings 2-3); `controls.router.test.tsx` is 1279 lines in one file; `peer-boundary.test.ts:1-40` hand-parses sources with regexes that skip type-only imports (works, but `pack-test.sh` already proves the same, and the file's own header says so); `format/index.test.ts` asserts the buggy `'1.24 k cal'` and cannot see finding 1/7. No test for `FilterSet` slot-key reuse (finding 12), none for async schema in `useBasaltForm`, none for `DateRangePicker` half-range (`date-range-picker.test.tsx` is 30 lines).
- Proposal: delete tests with their code; split the router test per control; add contract tests listed in findings 1, 7, 10, 12, 18.
- Breaking: no.

### 27. [minor] `EnumFilter`'s `ChoiceHandle` adapter allocates a fake handle per render

- Evidence: `number-filter.tsx:~157-175` builds `choice` (closures + `String(value)` projection) every render to adapt a number field to a string-typed `ChoiceHandle`; `enum-filter.tsx:46` types `fallback`/`options` structurally, so a hand-built handle can lie. `EnumFilter` then re-derives `isDefault` through `field.isDefault(Number(v))`.
- Proposal: make `EnumFilter` generic over a `Codec<T>` (`toKey`, `fromKey`) and pass the real field handle: `NumberFilter options` becomes `EnumFilter codec={numberKeyCodec}` with no adapter object. Removes the "plain object method as hook" comment-defended contortion.
- Breaking: no.
