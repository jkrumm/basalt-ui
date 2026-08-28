# Migrating basalt-ui

`CHANGELOG.md` ships in this package and lists every release. It cannot tell you what **broke**:
semantic-release writes one line per commit, and "make the mobile bar navigate, driven by one typed
nav definition" does not say `ChartHoverSync` was deleted. This file is that half — removed and
renamed exports per minor, with the replacement.

Reconstructed from `git diff` over the published export surface across `v1.0.0..v1.19.1`, then
cross-checked against the repo's `scripts/export-surface.json` snapshot. **Every replacement below
was re-audited against the built declaration files at 1.20.0 (2026-08-22)** after round 5 caught one
row that was wrong. That pass corrected 4 table rows and 3 prose claims. Every section from 1.21.0
on was written against source, not against its commit messages — which is not a formality: one
1.23.0 commit message describes a change it did not make (see `1.23.1` § Corrections). Check
the types, not this table, if the two disagree.

**The newest section is headed `## Unreleased`, and stays that way until npm serves it.** This file
is written before `semantic-release` picks the number, so a number written here is a guess — and it
was wrong three rounds running.

**No majors, by policy.** A rename or a removal ships as a plain `feat:` on the 1.x line, so a minor
bump can require code changes. Skipping several at once is the expensive case — read every section
between your version and the target.

> Reading the CHANGELOG: minors and majors are `#` (h1), patches are `##` (h2). Grepping for
> `## [1.` finds only the patches.

**Minors with no public API delta:** 1.1.0, 1.3.0, 1.4.0, 1.5.0, 1.6.0, 1.7.0, 1.8.0, 1.9.0,
1.10.0, 1.13.0, 1.14.0, 1.16.0, 1.18.0 — and every patch. Additive-only subpaths: `./tokens.css`
at 1.3.0, `./agent-chat` at 1.10.0.

---

## Unreleased

**Nothing removed. Additive throughout, and enforcement tightened: five oxlint rules plus one guard
kind became `error`, and one new rule id shipped at `warn`.** The store half of this minor also
fixed four inference and notification defects consumers hit while porting, plus two ways a fallback
got pinned into localStorage — see § Stores below. Every level change honours the `theme-allow`
grammar unchanged; only the severity of an unwaived finding moves.

What is new, one line each — nothing here renames or removes anything:

- **`PageAside`** (`basalt-ui`) — the right-hand aside REGION a route claims, with the panel filter
  surface in its body and a mobile projection into `PageBar` row 2 (`docs/ASIDE-SPEC.md`).
- **`PanelRow`** (`basalt-ui/controls`) — the aside's inspector/facet row: label above, control
  below, `end` for a control that rides the label line. Every bound control renders one on the
  `panel` surface.
- **`SliderControl`** (`basalt-ui/controls`) — a `field.number`-bound track for a weight or a
  threshold. It always renders a `PanelRow`, so unlike the pill filters a `Section` body is a
  legitimate home for it and `basalt/bound-control-outside-home` does not police it.
- **`MultiSelectFilter.counts` / `.max`** — per-option counts (a mono number plus a proportional
  bar) and the panel facet cut-off before the `Show more` fold. Both optional; omitted is today's
  rendering.
- **`field.number({ step })`** — the declared grain, republished on the handle. `field.number`
  resolves `1` for an `int: true` field that declared none, so `NumberFilter` and `SliderControl`
  cannot answer it differently.
- **`basalt/bound-control-outside-home`** — a NEW rule id at `warn` (grace to 1.30.0): a bound
  basalt control written into a `Section` body or a page stack renders as a stray pill.
  `control-outside-home` matches raw Mantine tags only, so this half of law C1 was unguarded. Homes
  are the slot props plus the `FilterSet` / `PageAside` / `PanelRow` subtrees; the escape is
  `theme-allow bound-control-outside-home — <why>`.

### Stores — the `custom` flag, patched writes, lazy fallbacks, derived windows

**Additive, except one type that got narrower on purpose.** `field.range({ presets, fallback })`
written INLINE inside `createSearchStore({ fields })` used to infer `custom` as `boolean` — the
contextual `AnyField` return type won over the argument — so every value and search type carried a
`'custom'` preset the field itself rejects at runtime, and `RangeFilter field={…}` needed a cast or
an explicit `custom: false`. `field.range` is now three overloads: an omitted or `false` flag is
`false`, a literal `true` is `true`, a value typed `boolean` stays widened.

- **Delete the workaround, not the field.** An explicit `custom: false` still works (same
  overload); a cast on `<RangeFilter field={…} />` can go, and `RangeFilterProps<P, C>` is generic
  over the flag so a preset-only handle binds directly.
- **What can newly type-error:** code that read `'custom'` out of a range whose field never declared
  it — `if (search.range === 'custom')` on a preset-only field, or a `RangeValue<P | 'custom'>`
  annotation over one. That branch was always dead at runtime; the type just stopped pretending.
- **…and one more, in a consumer's own WRAPPER.** A prop typed `FieldHandle<RangeField<P>>` — `C`
  defaulting to `boolean` — no longer accepts a handle from a `field.range` without `custom: true`,
  because that handle's setter is now `RangeValue<P>`-typed and a setter is contravariant. Pin
  `FieldHandle<RangeField<P, false>>` for the preset-only shape, `RangeField<P, true>` for a
  picker-backed one, or make the wrapper generic over the flag
  (`<P extends string, C extends boolean>` + `FieldHandle<RangeField<P, C>>`), which is what
  `RangeFilter` does. An existing `as FieldHandle<RangeField<P>>` cast keeps compiling.

**`toWindow()` resolves derived presets.** `field.range({ window: { '3m': (now) => ({ from, to }) } })`
makes `toWindow({ preset: '3m' })` return `{ from, to }` (ISO dates, resolved at call time with the
current `Date`) while `3m` stays one preset in the URL. A preset with no resolver keeps
`{ window: preset }`, in the same field — which is what retires the last hand-rolled
`presetToParams` a consumer kept beside the store for `3m` / `6m` / `1y` / `ytd`.

**The resolved presets are gone from the return TYPE too**, which is the half that decides whether
the switch is deleted or the cast just moves: the field now carries its resolver keys (`RangeField`'s
fifth type parameter, inferred from `window`), and `toWindow` returns
`{ window: Exclude<P, W> } | { from; to }`. A `resolveWindow` whose target is
`{ window: '7d' | '30d' | '90d' | 'all' } | { from; to }` becomes a one-line delegation with no
`as`. One guard survives on a `custom: true` field: a `'custom'` preset that arrives WITHOUT dates
resolves to `{ window: 'custom' }`, so `'custom'` stays in the union by construction.

**A field setter takes an optional second argument.** `set(next, { patch })` merges extra search
params into the SAME navigate — URL lane only, for keys the store does not own (`{ patch: {
detailDate: undefined } }` clears a sibling param the page put there). The field's own params always
win over the patch, so it cannot corrupt the value being set. A local/memory-lane write has no
navigate to merge into and ignores it.

Two limits are now enforced rather than documented. A patch key **another field of the same store
owns** is refused — it would reach the URL while the store's own write path never touched the mirror,
so the next paramless visit and every `linkSearch` link resolve the OLD value: `createSearchStore`
throws in dev, and in production keeps the write and logs it once. Write that field through its own
setter instead. And a patched write **from a route that does not validate the field** persists (A1)
but drops the patch with it — there is no navigate to merge into — which now warns once per field in
dev instead of doing nothing.

**A fallback may be a thunk.** `field.*({ fallback: () => T })` (every kind — `field.number`'s codec
froze its thunk at store definition in the first cut of this minor and does not now) is resolved at
READ time and re-resolved while nothing is written, and is never persisted on its own — a write
stores what the control produced, as before. **Local and memory lanes only:** `createSearchStore` now
THROWS at definition for a thunk on a URL-lane field, because `validateSearch` would evaluate it on
every navigation and pin the result into the URL. Move the field off the URL lane (`{ url: false }`,
or `createLocalStore`) or pass a value.

**`FieldHandle` gained `clear()`, and a reset now UNSETS.** `useReset()` used to write
`entry.codec.fallback` into the mirror for every persisted field, and every control's reset called
`setValue(field.fallback)` — both of which pin a RESOLVED thunk: pressing `Reset all` over
`field.string({ fallback: () => todayIso() }, { url: false })` stored today's date, so tomorrow the
field read a value nobody chose and counted as active in `Filters (n)`. Both paths now delete the
key instead (the memory lane always did), and `clear()` is the per-field door: the persist lane
deletes its key, the memory lane drops its value, the URL lane navigates back to the fallback
params.

Nothing to change at a call site — every shipped control's reset calls it. A consumer that
hand-rolled a reset should swap `setValue(field.fallback)` for `field.clear()`; a hand-built
`FieldHandle` (a facet column, a test double) must add the member, which is the one type-error this
adds.

**`createPersistedState` notifies across instances (bug fix).** Two instances over one key — a
page's store and a widget's own state naming the same key, or a store re-exported from two modules —
kept per-instance listener sets, so a write through one left the other's components rendering the
stale value **in the same tab** while the cross-tab `storage` path worked. Subscribers are now
registered per storage key. No API change; if you were re-rendering something by hand to work around
this, delete it.

**`RangeFilter` warns once in dev** when the field declares `custom: true` and no `customPicker` was
injected: the custom window is then unreachable (no popover picker, no `Custom range…` row in the
sheet). Preset-only remains a legal configuration — the picker is injected precisely because
`@mantine/dates` may be absent — so this is a warning, not a type error.

### Controls — `NumberFilter`, the `field.number` lane

**One export added, nothing removed.** `field.number` has existed since the store landed and had no
control, so both consumers that needed one wrote around it in opposite directions: linewatch kept a
raw `SegmentedControl` over `minDuration` (a `control-outside-home` warn, law C1), and argo widened
`nights` into a string enum — which puts `'3'` in the URL and makes every downstream comparison a
parse.

```tsx
import { NumberFilter } from 'basalt-ui/controls'

// A preset set — a pill plus a radio list, the same body every enum filter renders.
<NumberFilter field={booking.field.nights} label="Nights"
  options={[{ value: 1, label: '1 night' }, { value: 7, label: 'A week' }]} />

// No `options` → a pill whose popover holds a `ctl` NumberInput; the sheet renders it full-width.
<NumberFilter field={lines.field.minDuration} label="Min duration" step={30} />
```

Three properties worth knowing before porting a call site:

- **The URL keeps a NUMBER.** `options` takes `{ value: number; label: string }`, and a numeral
  STRING there is a type error — the whole reason to stop widening a threshold into an enum.
- **The stepper applies on blur or Enter, never per keystroke.** A number is typed digit by digit, so
  a live write would navigate on `4`, `42`, `420` — three loader runs for one intended threshold,
  two of them values nobody meant. `SearchFilter` debounces; a number has an explicit commit point.
- **`min`/`max`/`int` come off the HANDLE, not the call site.** They are deliberately not props: the
  field is what validates the URL, and a second copy at the call site is a second answer to the same
  question. The number handle republishes all three (see § Stores — the number handle below), so the
  stepper stops at the field's limit and an `int` field refuses decimals outright. A TYPED value is
  clamped to those bounds when it commits, so the box reads what the store holds even when the store
  does not move — a second out-of-range `9999` against `max: 600` over a stored `600` writes nothing,
  and the readout still corrects itself to `600`. The codec's clamp stays the backstop for a value
  that never came through the box at all — a hand-typed URL, a stale deep link.

### Stores — the number handle republishes its bounds

**Three members added to `FieldHandle<NumberField>`, nothing removed.** `min`, `max` and `int` now
sit on the handle, filled from the field declaration (`NumberHandleExtras`, the shape
`RangeHandleExtras`/`toWindow` already had). A control never sees the field descriptor — only the
handle — so before this the only way one could learn its own limits was for the call site to pass
them a second time.

```ts
const nights = store.field.nights // field.number({ fallback: 2, min: 1, max: 14, int: true })
nights.min // 1        — `undefined` when the field declared none
nights.max // 14
nights.int // true     — `false`, never `undefined`, on a number handle
```

Non-number handles carry all three as `undefined`, the same way `toWindow` is `undefined` off a
range handle. That is a type-level fact, not just a runtime one, and it matters for one collision in
particular: `StringField` has its own `max`, which is NOT republished — a string handle's `max` is
`undefined`.

Nothing about the clamp changed. The codec has always clamped a number to the declared bounds on
write, and still does; the handle is a readout of that law, which is what lets `NumberFilter` bound
its stepper instead of letting the user watch the correction happen.

### `StatCard` — `unit`, `breakdown` and the delta's own format

**Four props added, nothing removed or renamed; every one defaults to today's rendering when
omitted.**
`value` is a pre-formatted `string`, so a card had exactly one text channel under the hero row
(`subtitle`) and three consumers wanting a unit AND a basis AND a split hand-rolled the card instead
— which is the fork `shadow-basalt-export` reports as a `HeroCard`.

| Prop          | Type                                                               | Renders                                                                       |
| ------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `unit`        | `string`                                                           | after the value on the hero row — muted, mono, `--vx-text-sm`                 |
| `breakdown`   | `readonly { label: string; value: string; tone?: StatCardTone }[]` | compact rows under the hero, one `controlHeightTag` line each                 |
| `deltaFormat` | `(delta: number) => string`                                        | the delta chip's label. Default unchanged: `Math.abs(delta).toFixed(1) + '%'` |
| `deltaGlyph`  | `boolean`                                                          | the chip's ▲/▼. Default `true`; a zero delta never shows one                  |

`unit` is forwarded to `WidgetHeader`, which gained the same prop, so `ChartCard` and `Section`
headers get it too. It is NOT the basis: `412` + `TSS` is the pair, and `7-day rolling` is still
`subtitle`. A thousands separator, a currency symbol or a `%` still belong in `value`.

`breakdown` draws **no hairlines** — §2.1 puts a horizontal rule between OPTION rows and nowhere
else, and `theme/divider-law.test.ts` inventories every one basalt draws. The rows separate by
weight (muted label, mono ink value) instead. Keep it to two or three: past that the card is a
table, and a table is `BasaltDataTable` in a `Section`. A row's `tone` reads the same per-scheme
`--vx-status-*` solid the card's own rail does, and omitting it is untinted, never `'good'`.

`deltaFormat` exists because **a delta is not always a percentage, and `StatCard` claimed it was**:
`delta={0.3}` on a pace or speed card rendered `▲0.3%`, a wrong unit on a KPI — worse than no chip —
so the one consumer that needed it kept the card hand-rolled and took the `shadow-basalt-export` warn
instead. `DeltaBadge` had `format` all along; neither `WidgetHeader` nor `StatCard` forwarded it. Both now do.
`ChartCard`/`Section` are unchanged: each declares its own header props and forwards them one by
one, so a delta-bearing `ChartCard` or `Section` still prints the percentage — ask if you need it
there.

```tsx
// A percentage, unchanged — no prop, no move.
<StatCard title="Volume" value="1,204" delta={4.2} deltaPeriod="WoW" />

// An absolute delta. The formatter gets the SIGNED number, so it may print the sign itself;
// `deltaGlyph={false}` then stops the ▼ saying the same thing twice. No `deltaLabel` prop exists —
// the function IS the escape hatch, and `delta` stays the number that drives the tone.
<StatCard title="Pace" value="5:31" unit="/km" delta={-12} deltaGlyph={false}
  deltaFormat={(s) => `${s < 0 ? '−' : '+'}0:${String(Math.abs(s)).padStart(2, '0')} /km`} />
```

### Guards — the 1.27.0 promotions, one narrowing and one new exemption

**Five plugin rules and one guard kind became `error` in the shipped preset.** Their
`PLUGIN_RULE_GRACE` / `GRACE_PERIOD_KINDS` entries are deleted, which IS the promotion (C16). A
`theme-allow` written against any of them still works unchanged; only the severity of an UNWAIVED
finding moves.

| Promoted to `error`              | Waiver, if the finding is deliberate                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| `basalt/control-size-literal`    | `theme-allow control-size-literal — <why>` above the node, or `theme-allow-file` for the file |
| `basalt/in-body-page-title`      | `theme-allow in-body-page-title — <why>` — ONE id, so it waives the guard kind's lane too     |
| `in-body-page-title` (kind)      | the same annotation; the two lanes share the id by construction                               |
| `basalt/responsive-twin`         | `theme-allow responsive-twin — <why>`; the real fix is deleting one mount                     |
| `basalt/search-literal-link`     | `theme-allow search-literal-link — <why>`; the real fix is `search: <store>.linkSearch`       |
| `basalt/use-search-from-literal` | `theme-allow use-search-from-literal — <why>`; the real fix is the param as a prop            |

The commonest in-body-title case that is NOT a defect: **a shell-less surface naming itself** — an
auth gate, an error boundary, a print view. There is no breadcrumb to carry the name, so write
`theme-allow in-body-page-title — shell-less surface`.

**`control-size-literal` also gained one exemption in the same minor, and it removes a waiver rather
than adding one: a slot owned by `ChartCard` no longer reports.** `ChartCard` lives inside the
Mantine-free chart layer, so its `actions` slot writes `data-basalt-tier` by hand and cannot mount
the tier theme at all — a `Switch` there with no `size` renders at Mantine's default, not at `ctl`.
The rule's message ("the HOME sets the tier, drop the prop") was simply false in that one slot, and
because the rule fires on the `size` ATTRIBUTE it could not tell a correct `size="ctl"` from the
`size="xs"` it exists to catch. Every other home still reports, and the owner test reads the
IMPORTED name so `ChartCard as Card` is exempt too. `hand-rolled-filter` is deliberately NOT
exempted there: a raw `Select` in `ChartCard.actions` is still a filter that should take a `field`.
A HOISTED binding is exempt only when EVERY basalt home it was handed to is `ChartCard` — one
`const acts = <Button size="xs"/>` given to both `<ChartCard actions>` and `<Section actions>` still
renders in a tiered slot, and keying the exemption on a single owner made the verdict depend on which
attribute came later in the file.

**`basalt/control-outside-home` and `raw-selection-control` did NOT promote. They are re-dated to
1.30.0, and the reason is a measurement rather than caution:** the wave-7 consumer run left 9 warns
in argo, and every one is a control inside a modal/form module whose `<Modal>` is rendered by the
PARENT route — law C1's cross-file case, which is advisory by declaration because no scan of one
file can see it. Both lanes now exempt a file whose BASENAME matches
`*-{modal,drawer,popover,panel,form}.tsx`, which is the convention those nine already follow.
Outside the convention, an overlay body declares itself:
`theme-allow-file control-outside-home — overlay`. The trade is stated plainly: a whole file goes
unscanned on a naming convention, so a `Select` that genuinely belongs in a page bar goes unreported
if it lives in `filters-panel.tsx` — the same bargain the `@mantine/form` exemption already buys,
and a smaller one than promoting a rule with 9 known false positives.

**`basalt/shadow-basalt-export` narrowed, and it stays a permanent advisory `warn`.** An ALIAS hit is
now skipped when the file imports the basalt export it renames **and REFERENCES that binding as a
value**: a `HeroCard` that composes `StatCard` is a wrapper, not a fork, and it was already following
the advice the message gives. Composition, not import — three shapes stay reported, and they are the
ones a fork actually writes: a type-only `import type { StatCard }` (or an inline `type` specifier)
feeding `ComponentProps<typeof StatCard>`, a VALUE import used only in a type position, and a dead
import left behind after the body was re-rolled. None of them render anything. A reference does not
have to be a JSX tag — `component={StatCard}` and `createElement(StatCard)` compose it too. The
provenance test reads the IMPORTED name, so `import { StatCard as Base }` counts. The name-COLLISION
half is deliberately NOT exempted the same way — a local `StatCard` beside an
`import { StatCard as Base }` kept the name AND a piece of the original, which is the fork shape this
rule most wants to see.

## 1.26.0 — the control tier, the page bar and the store

**One export removed and two deprecated — see § Stores below; two shell PROPS removed — see
§ Sidebar. Two other behaviour changes: the grace ledgers changed shape, and nine
long-stale entries (D4, `docs/archive/CONTROLS-SYNTHESIS.md`) are promoted.** C16
(`docs/CONTROLS-SPEC.md` §1) is the new law behind both: a grace entry now carries `{ since,
promote, why }` (semver strings) instead of a bare promotion-note string, and a version-gated test
fails the build once `package.json`'s version reaches an entry's `promote` while the entry is still
in the ledger — and `make release` refuses to cut a release whose COMPUTED version has reached one,
which is the half that fires before the release rather than one minor after it. That is what stops a
rule sitting at `warn` for five minors with nothing tracking the promise, which is exactly what
happened to the nine rows below.

**`PLUGIN_RULE_GRACE`** (`configs/oxlint-plugin.js`) **and `GRACE_PERIOD_KINDS`**
(`src/guard/index.ts`) no longer carry any PRE-EXISTING entry — every one either promoted to `error`
(the table below) or moved to the new, permanent `PLUGIN_RULE_ADVISORY` ledger
(`shadow-basalt-export`). Both ledgers now hold only the wave-6 control guards listed under
§ Guards — six plugin rules and two guard kinds, each `{ since: '1.26.0', promote: '1.27.0' }` —
which the C16 gate forced to promote or be deleted at 1.27.0. Five rules and one kind promoted there;
the C1 pair was re-dated to 1.30.0 against a measurement (see `## Unreleased` above). A theme-allow escape written against
any of these still works unchanged; only the SEVERITY of an unwaived finding moves from `warn` to
`error`.

| Rule / kind (promoted)                 | What now errors                                                                                                                                                  | Escape hatch                                                                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `basalt/hand-rolled-plot`              | An unwaived chart-assembly node (`AxisLeftNumeric`, `AxisRightNumeric`, `AxisBottomDate`, `HoverOverlay`, `Crosshair`) outside a file composing `CartesianChart` | `theme-allow hand-rolled-plot — <why>` per node, or `theme-allow-file hand-rolled-plot — <why>` for a declared exception                    |
| `basalt/chart-legend-literal`          | A hand-written array literal passed to `ChartLegend`'s `items`                                                                                                   | Derive the legend from `series` (`deriveLegend`, or let `ChartFrame`/`CartesianChart` do it), or `theme-allow chart-legend-literal — <why>` |
| `basalt/hand-rolled-shell`             | A hand-rolled app-shell assembly node instead of `BasaltShell`                                                                                                   | `theme-allow hand-rolled-shell — <why>`, or `theme-allow-file` for the whole file                                                           |
| `theme-allow-unscoped` (guard kind)    | A bare `// theme-allow` with no rule id                                                                                                                          | Name the kind(s): `theme-allow <kind> — <why>`                                                                                              |
| `surface-shadow-override` (guard kind) | A hand-composed `boxShadow` reaching a `--vx-*` token                                                                                                            | Use the shipped shadow tokens, or waive with a reason                                                                                       |
| `css-raw-surface` (guard kind)         | A raw surface color in kebab CSS (`.module.css`)                                                                                                                 | Same remedy as the JS/TSX form — a `--vx-*` var, or waive                                                                                   |
| `inline-font-size` (guard kind)        | A hardcoded numeric font size in an inline `style` object                                                                                                        | `VX.text.*` / `--vx-text-*`, or waive                                                                                                       |
| `hidden-inline-style` (guard kind)     | A style object defined once and spread into `style={...}` (evades the guard's inline-object scan)                                                                | Inline the object at the call site, or waive                                                                                                |

**`basalt/shadow-basalt-export` is unaffected** — it moves ledgers (`PLUGIN_RULE_GRACE` →
`PLUGIN_RULE_ADVISORY`), not severity. It stays `warn` in the shipped preset, permanently, and is
never subject to the C16 gate: see "Lint and guard rules that tightened" below for why.

Consumers who never overrode `basalt.severity` for any of the eight kinds/rules above and never
waived them see these findings for the first time as `error`; measure against the shipped preset
before upgrading if that's a concern (`basalt-ui check-theme --audit-allows`, `oxlint .`).

### Composers — WidgetHeader-backed renames (docs/CONTROLS-SPEC.md §2.2)

`StatCard`, `ChartCard`, `Section` (new), `SettingsSection`/`DangerZone` and `BasaltDataTable` now
each compose the wave-1 `WidgetHeader` primitive for their title row instead of hand-rolling one —
several props renamed or were added to line up with it.

| Component                        | Removed / renamed                                          | Replacement                                                                                                                                                                                                                                                                              |
| -------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StatCard`                       | `label`                                                    | `title`                                                                                                                                                                                                                                                                                  |
| `StatCard`                       | `menu`                                                     | `actions` (wrapped in `CtlSlot`)                                                                                                                                                                                                                                                         |
| `StatCard`                       | —                                                          | adds `icon`, `info`, `subtitle` (forwarded to the composed `WidgetHeader` — the info glyph beside the title, the muted unit line under the hero row), `sparklinePlacement?: 'bleed' \| 'right'` (default `'bleed'`, collapses to it below `sm`)                                          |
| `ChartCard`                      | `tooltip`                                                  | `info`                                                                                                                                                                                                                                                                                   |
| `ChartCard`                      | `extra`                                                    | `actions` (carries `data-basalt-tier="widget"`, no `CtlSlot` — `./charts` stays Mantine-free)                                                                                                                                                                                            |
| `ChartCard`                      | `title: string` (required)                                 | `title?: string` — the header now renders only when title/info/value/actions/icon/count is set                                                                                                                                                                                           |
| `ChartCard`                      | —                                                          | adds `icon`, `value`, `delta`, `deltaPeriod`, `count`                                                                                                                                                                                                                                    |
| `SettingsSection` / `DangerZone` | `description`                                              | `subtitle`                                                                                                                                                                                                                                                                               |
| `SettingsSection` / `DangerZone` | —                                                          | adds `actions` (wrapped in `CtlSlot`)                                                                                                                                                                                                                                                    |
| `BasaltDataTable`                | `toolbarActions`                                           | `actions?: ReactNode` — the toolbar (search + facets + `actions`) is now wrapped in `CtlSlot`. Typed `ReactNode`, not `BarAction[]` — a table toolbar is not a `PageBar`/`Section`, and `ActionGroup`'s shell-extras semantics (primary/secondary, mobile folding) must not leak into it |
| `BasaltDataTable`                | fixed `w={220/200/180/110}` on toolbar/pagination controls | removed — the controls size by content                                                                                                                                                                                                                                                   |
| `BasaltDataTable`                | —                                                          | adds `title`, `icon`, `subtitle` — when `title` is set, renders `WidgetHeader tier="widget"` above the toolbar, `count` always `table.getRowCount()` (C11)                                                                                                                               |
| `BasaltDataTable`                | `facets` rendered as raw `Select`/`MultiSelect`            | rendered as `EnumFilter`/`MultiSelectFilter` pills inside a `FilterSet` (`docs/CONTROLS-SPEC.md` §3) — a synthetic `"All"` option stands in for a single-select facet's cleared state, since a closed enum field has no member for "unset"                                               |

New export: **`Section`** (`.`, Mantine-coupled) — `WidgetHeaderProps` minus `tier`, plus `tabs?`,
`collapsible?`, `persistKey?`, `defaultOpen?`, `summary?`, `id?`, `children`. No `variant`, no
border/background — one shaded container level per page belongs to the cards inside a `Section`, not
to `Section` itself. Fold state persists at `basalt:section:<persistKey>` via `createPersistedState`
when `persistKey` is given, else local `useState`; the header stays drawn when collapsed, only the
body unmounts. `defaultOpen` (default `true`) picks the state a FIRST visit lands on and is outranked
by a persisted value, so a section the reader closed stays closed. `summary` renders under the header
and survives a collapse — a folded section still states its headline figures, which is what makes
folding it a real option rather than a way to lose the numbers.

### Homes — `PageBar` replaces the page-action portal

**Three exports removed with no deprecation window, one prop retyped, three tokens and one CSS
class deleted.** `PageActions` gave a page a `ReactNode` slot in the header and nothing else: no
second row, no overflow policy, no mobile projection. Every consumer then hand-rolled the rest —
a sticky filter row measured into a `--lw-header-h`, a horizontally scrolling action strip, a
responsive twin under `visibleFrom`/`hiddenFrom`. `PageBar` is that whole shape, typed
(`docs/CONTROLS-SPEC.md` §2.1).

| Removed / changed                                                                                  | Replacement                                                                                                |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `PageActions`                                                                                      | `<PageBar actions={{ primary, secondary }} sync={…} tabs={…} filters={…} filtersEnd={…} />`                |
| `PageActionsOutlet`                                                                                | none — the outlet is internal to `BasaltShell` now                                                         |
| `PageHeaderProvider`                                                                               | none — the provider is internal to `BasaltShell` now                                                       |
| `BasaltShellProps.globalActions: ReactNode`                                                        | `GlobalAction[]` — `{ key, node, mobile?: 'bar' \| 'more' \| 'hidden' }`; the first two default to `'bar'` |
| tokens `appShellHeaderMobileHeight`, `appHeaderMobileActionsHeight`, `stickyHeaderClearanceMobile` | `appShellHeaderHeight` / `stickyHeaderClearance` — one value at every viewport                             |
| vars `--vx-space-app-header-mobile-actions-height`, `--vx-space-sticky-header-clearance-mobile`    | `--vx-space-sticky-header-clearance`                                                                       |
| CSS `.pageActions` (`shell/app-header.module.css`) and its `nowrap` override                       | none — the portal target no longer scrolls; overflow folds into `ActionGroup`'s `More`/kebab               |

What changes at runtime even if you only rename:

- **The app-shell header is 48px on a phone too.** It used to wrap to two rows (97px) and reserve
  the second one on every route, empty or not (law C14). A page-level filter/tab row now renders
  in the page FLOW, sticky under the header, so a route with no filters is 49px shorter on mobile.
- **The header never scrolls sideways.** Actions past three fold into a `More` menu on desktop and
  into one kebab below `sm` — computed from `BarAction[]`, which is why the slot had to become data
  (law C7). There is exactly ONE kebab per header, and `PageBar`'s ROW 1 owns it: the shell's
  `mobile: 'more'` global actions land there, and so do `filtersEnd`'s items (row 2 shows those on
  desktop only — below `sm` row 2 is tabs + the first pill + `Filters (n)`, per spec §2.1). A route
  with no `PageBar` row-1 actions gets the kebab from the shell instead. An `ActionGroup` you mount
  yourself — in a `Section` or `ChartCard` `actions` slot — never inherits the global rows.
- **`--basalt-page-bar-h` is published on `documentElement`** (ResizeObserver where available,
  `height > 0` guard)
  whenever a row 2 renders, and removed when it unmounts. It is written in the LAYOUT phase, so it
  exists at the first paint — a cold load of `/page#anchor` lands below the bar rather than under
  it. A `100dvh` body becomes
  `calc(100dvh - var(--app-shell-header-height) - var(--basalt-page-bar-h, 0px))` — delete any
  hand-rolled measure-and-publish effect and any hardcoded header-height fallback.
- **A shell-less app reads `title`/`icon`.** Inside a `BasaltShell` the breadcrumb names the page
  and both are ignored; outside one they lead row 1, and the whole bar sticks at `top: 0`.
- **`className` lands on the bar ROOT in both forms** — the shell-less
  `[data-basalt-page-bar="standalone"]`, or row 2's sticky wrapper `[data-basalt-page-bar="shell"]`.
  It is the seam for the two things only the consumer's own layout knows: bleeding the sticky bar
  across a container's gutters, and a hairline under it. Scope that CSS through the class; a global
  `[data-basalt-page-bar]` rule reaches every page in the app, including the ones wanting neither.

`ActionGroup`, `OverflowMenu` and `SyncButton` ship on the new `basalt-ui/controls` subpath; only
the TYPES a `PageBar`/`BasaltShell` prop mentions (`BarAction`, `ActionGroupProps`, `GlobalAction`)
are re-exported from the root.

### Stores — `createSearchStore` replaces the enum-only pair

`createSearchParamStore` and `createMultiSearchParamStore` still work: both are now `@deprecated`
thin wrappers over `createSearchStore`, returning the same four members
(`validateSearch`, `useStore`, `readStored`, `linkSearch`) with the same signatures and reading the
same single-value localStorage envelope. **They are removed in 1.29.0.**

| Removed / deprecated                                       | Replacement                                                                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `createSearchParamStore({ key, param, values, fallback })` | `createSearchStore({ key, fields: { <param>: field.enum(values, fallback) } })` — `@deprecated`, removed 1.29.0  |
| `createMultiSearchParamStore({ key, param, values })`      | `createSearchStore({ key, fields: { <param>: field.multi(values, fallback) } })` — `@deprecated`, removed 1.29.0 |
| `<store>.useStore()`                                       | `<store>.field.<name>.use()` — reads the URL FIRST, then the mirror; writes both lanes                           |
| `useOnlineStatus` (`.` and `./state`)                      | `useConnectivity()` (`.`, auto-mounted by `BasaltProvider`) — **removed, not deprecated** (A12)                  |
| `createSearchSchemaStore`                                  | never shipped; `createSearchStore` is what those "planned" paragraphs were waiting for                           |

New on `./router-tanstack`: `createSearchStore`, `field` (`enum` / `multi` / `range` / `number` /
`boolean` / `string`), and the `FieldHandle` / `AnyField` / `FieldValue` / `RangeValue` / lane types.
New on `./state` (router-free, same field vocabulary): `createLocalStore`, `field`, those same types.
`FieldHandle` is what every 1.26.0 control takes instead of `value`/`onChange`
(`docs/CONTROLS-SPEC.md` §3–§4).

Three things to know when you migrate a real store:

- **A deep link now wins over the mirror.** `?range=7d` reads back `7d` even when localStorage says
  `30d`. The old `useStore` read localStorage, so a shared link opened on the wrong window — the bug
  three consumers shipped (A8). If you were compensating for that by hand, delete the compensation.
- **The storage layout changed for the NEW factory only.** `createSearchStore` keeps one entry per
  STORE (`basalt:<key>` = `{ fieldName: value }`); the old factories kept one bare value per param.
  A store migrated from a wrapper to `createSearchStore` therefore ignores whatever the browser
  already had for that key and starts on its fallback once. The wrappers themselves keep the old
  layout byte-for-byte, so an un-migrated consumer sees no reset — including a stored EMPTY multi
  selection, which still reads back as empty: "an empty array means absent" is a URL rule in the
  deprecated store, never a storage rule, so a deliberately cleared filter stays cleared.
- **A write from outside the owning route persists only** — it no longer needs a hand-rolled
  `navigate` beside it, and it no longer silently writes a param the route does not validate.
  `validateSearch` picks the persisted value up on the next visit (A1). The one combination with
  nowhere to go — a `persist: false` field written from a route that does not validate it — warns
  once per field in dev rather than dropping the write silently.

**Every navigate a store issues carries `resetScroll: false`** — a field write and `useReset`
alike. A filter lives halfway down a page as often as it lives in the bar, and the router treats a
same-route search write as a navigation, so the default scrolled the reader back to the top on every
change. Delete any `resetScroll: false` you were passing beside a hand-rolled `navigate`.

Lanes are declared once per field: `{ url: false }` is the local-only lane (per-chart selects, a
compact toggle — or use `createLocalStore`), `{ persist: false }` the URL-only lane (pagination, a
deliberately unpersisted threshold), `{ history: 'push' }` opts one field into a history entry.
**`{ url: false, persist: false }` is the IN-MEMORY lane** rather than the one combination that
dropped its write: shared across every mount of that store for the session, gone on reload, never
written to or read from localStorage. It behaves identically in both factories — `createSearchStore`
counts such a field in `useActiveCount()` and clears it in `useReset()`, and it never appears in
`useValues()`/`validateSearch`, which are the URL lane by definition. In a `createLocalStore` the
`url` flag is ignored, so `{ persist: false }` alone lands there. The dev warning about a write with
nowhere to go now fires only for its remaining real case: a `{ persist: false }` field that IS on the
URL lane, written from a route that does not validate the param. `createLocalStore` also carries **`labels()`**,
chainable and identical to `createSearchStore`'s, so `SelectFilter`/`ViewTabs` read option labels off
a local store too.
A `field.range` keeps THREE URL params (preset + `from` + `to`, renamable via `params`), so existing
deep links and loaders keep their shape, and `field.<name>.toWindow(v)` replaces a hand-rolled
`presetToParams`.

### Sidebar — `sidebarBlocks` replaces the two `ReactNode` extras

**Two props removed with no deprecation window, and two widened.** `sidebarNavExtra` and
`mobileNav.moreExtra` were the same gap solved twice and badly: the first rendered on desktop only
and vanished in the collapsed rail, the second was one anonymous row at the bottom of the More
surface, and neither could be projected because basalt could not see inside a `ReactNode`. Every
consumer that wanted an "Awaiting action" list therefore wrote it twice, once per prop, and got no
rail badge either way. `SidebarBlock[]` is that whole shape as data (law C13,
`docs/CONTROLS-SPEC.md` §2.3).

| Removed / changed                  | Replacement                                                                                                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BasaltShellProps.sidebarNavExtra` | `sidebarBlocks={[{ kind: 'custom', key, node }]}` — same DOM position (last child of the nav scroll region), same CSS-only hiding in the rail, still desktop-only                      |
| `AppSidebarProps.navExtra`         | `blocks={[{ kind: 'custom', key, node }]}`                                                                                                                                             |
| `MobileNavConfig.moreExtra`        | `sidebarBlocks={[{ kind: 'list', key, label, items }]}` — one More-sheet row (`Awaiting action · 3`) opening a nested sheet of its items, instead of one unlabelled row of raw content |
| `useNav(NAV, { moreExtra })`       | drop the option; declare the block on `BasaltShell`                                                                                                                                    |
| `BasaltShellProps.brand`           | widened to `BrandConfig & { menu?: AccountMenuItem[] }` — additive; `menu` makes the brand row a `Name ▾` workspace switcher                                                           |
| `BasaltShellProps.search`          | widened to `SidebarSearchConfig & { actions?: SidebarSearchActions }` — additive; one or two icon-only buttons right of the ⌘K row                                                     |

What changes at runtime even if you declare no blocks at all:

- **Nav-section folds are now PERSISTED**, at `basalt:sidebar-section:<label-slug>` (e.g.
  `basalt:sidebar-section:tools`). They were a `useState` keyed by label, so every reload re-opened
  a section the user had closed. `defaultCollapsed` is now the SEED for that key rather than a value
  that overrides the user on every mount. Block folds live at `basalt:sidebar-block:<key>`; both are
  the standard `createPersistedState` envelope (`{ v: 1, value: boolean }`), readable with
  `readPersistedValue` from `basalt-ui/state`. A "Show more" toggle is deliberately NOT persisted.
- **`settingsMenuItems` renders FLAT at three entries or fewer** — one link row each, instead of a
  gear "Settings" menu you had to open to see two rows. Four or more keeps the menu. `brand.version`
  rides the flat rows as a faint label and the dropdown as a `Menu.Label`, as before. New
  `BasaltShellProps.settingsMenu?: 'auto' | 'flat' | 'menu'` (`AppSidebarProps` too, default
  `'auto'` = that count rule) forces the form: pass `'menu'` when the three rows are CONTROLS rather
  than destinations — a theme radio group and a devtools switch read as a widget pile flat, and the
  count cannot tell them from three links.
- **The footer is one wrapper deeper.** `settingsMenuItems` without `account` used to render its
  `Group` as the footer element itself; both now sit inside one footer `Stack` alongside any
  `placement: 'bottom'` block. No visual change — relevant only to a stylesheet reaching in by
  structure.
- **`useNav` now marks exactly one destination `active`** — the deepest matching route wins, instead
  of every prefix-matching row (a parent AND its child) reading active at once. A parent on the
  winner's path gets the new `SidebarItem.ancestor` instead: never active, never `aria-current`, only
  a `data-ancestor` hook for CSS. A consumer that styled off two simultaneously-active rows will now
  see one.

New types on `.`: `SidebarBlock`, `SidebarListBlock`, `SidebarProgressBlock`, `SidebarCustomBlock`,
`SidebarBlockItem`, `SidebarBlockTone`, `SidebarSearchActions`. `SidebarItem` gained `ancestor?:
boolean`.

### `DeltaBadge` — plain-element DOM, same props

Nothing removed or renamed — a DOM contract change only, ahead of `WidgetHeader`
(`docs/CONTROLS-SPEC.md` §2.2) composing it Mantine-free.

| Component    | What changed                                                                            | Why it matters                                                                                       |
| ------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `DeltaBadge` | Renders a plain `<span>`, no `mantine-Badge-root`/`mantine-Badge-label` classes anymore | Same props, tone and format API — but a selector or snapshot keyed on Mantine's Badge classes breaks |

### Controls — `ArticleFilterBar` replaced by store-bound controls

Two new subpaths, `basalt-ui/controls` and `basalt-ui/controls-dates`, and ONE removal. The removed
component was controlled (`value`/`onChange`, its own `visibleFrom`/`hiddenFrom` twin); its
replacements take a `FieldHandle` and own the URL write, the localStorage mirror and the responsive
swap themselves (`docs/CONTROLS-SPEC.md` §3, laws C2/C9).

| Removed                 | Replacement                                                           | Import                                                       |
| ----------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| `ArticleFilterBar`      | `FilterSet` + `ViewTabs` (category axis) + `MultiSelectFilter` (tags) | `basalt-ui/controls`, and unchanged from `basalt-ui/content` |
| `ArticleFilterBarProps` | `FilterSetProps` / `ViewTabsProps` / `MultiSelectFilterProps`         | same                                                         |

All three replacements are re-exported from `basalt-ui/content` as well, so a content-only consumer
changes the component names and the props, not the import path.

Porting one call site:

```tsx
// before — the page owned the state, the labels and the mobile swap
const [category, setCategory] = useState('all')
<ArticleFilterBar categories={CATEGORIES} category={category} onCategoryChange={setCategory}
                  tags={ARTICLE_TAGS} selectedTags={tags} onTagsChange={setTags} />

// after — one store, two controls, no useState and no responsive branch
const articles = createSearchStore({
  key: 'articles',
  fields: { category: field.enum(CATEGORY_VALUES, 'all'), tags: field.multi(ARTICLE_TAGS, []) },
}).labels({ category: CATEGORY_LABELS })

<ViewTabs field={articles.field.category} />
<FilterSet>
  <MultiSelectFilter field={articles.field.tags} label="All tags" />
</FilterSet>
```

New on `basalt-ui/controls`: `FilterSet`, `RangeFilter`, `CompareFilter`, `SelectFilter`,
`MultiSelectFilter`, `SearchFilter`, `ToggleFilter`, `ViewTabs`, `COMPARE_VALUES`, and the
action/sync family. New on `basalt-ui/controls-dates`: `DateRangePicker`.

**`SyncButton`'s `scope` now decides the SHAPE, not only where you mount it.** `scope: 'global'`
renders icon-only at every viewport (an `ActionIcon` with the spinning glyph, age and error in the
tooltip, `label` as the accessible name) — the shell header shares 48px with the breadcrumb and
`PageBar` row 1, and a labelled button there is what pushes a page's own actions into the kebab.
`scope: 'page'` is unchanged on desktop (labelled, age inline) and drops to icon-only below `sm`,
which is what `docs/CONTROLS-SPEC.md` §3 always specified. One mount either way, CSS-only swap (law
C9). Consequence to know: the accessible name is now `aria-label` in BOTH forms, so a test asserting
the name as `Sync 2m ago` (the age used to land in it) now reads `Sync`. Nothing to change at a call
site.

**`SelectFilter` and `MultiSelectFilter` take `options?: readonly FilterOption[]`** — a runtime
catalogue (`{ value, label, disabled? }`) that OVERRIDES `field.options` whole rather than merging,
so a value the catalogue has dropped loses its row. It is what a label carrying live data needs
(`EUR · 1.08`), and on `SelectFilter` it also opens a second field shape: a `FieldHandle<StringField>`
is legal WITH `options` — an id set no enum can close over, a project picker fed from a query — and
a type error without it. `FilterOption` is new on `basalt-ui/controls`. Additive; nothing to change.

**`FilterSet` renders the mobile `Filters (n)` pill only when a child is actually folded.** With
every child inside the `inline` budget (one filter at the default `inline: 1`) the sheet would hold a
copy of what is already on screen, so neither the trigger nor the drawer mounts. Nothing to change —
but a mobile test asserting the pill exists on a one-filter page now has to fold something
(`inline={0}`) or drop the assertion. `RangeFilter.label` (default `'Range'`) names the sheet heading
and the preset track's aria name; the pill itself still reads the VALUE.

**`data-numeric` is now a package-wide law, not a per-component rule.** `basalt-ui/styles.css`
declares `[data-numeric] { font-family: var(--basalt-font-mono); font-variant-numeric: tabular-nums }`
inside `@layer basalt`, so the attribute works on ANY element — `<Text data-numeric>`, a table cell,
a count tag — and not only on a `SegmentedControl`, where it was previously a module-scoped rule that
made the attribute look broken everywhere else. Nothing to change: adding the attribute is opt-in,
and the two module rules that also set a component `font-size` still apply on top. This retires the
per-consumer `theme-allow` + inline `fontFamily`/`fontSize` hack for numeric labels.

**`@mantine/dates` is a new OPTIONAL peer, and only `basalt-ui/controls-dates` needs it.**
`basalt-ui/controls` resolves and renders without it — proven from the packed tarball by
`scripts/pack-test.sh`. Pass the picker into `RangeFilter` rather than importing it from a shared
module:

```tsx
import { DateRangePicker } from 'basalt-ui/controls-dates'
;<RangeFilter field={analytics.field.range} customPicker={DateRangePicker} />
```

A consumer that uses `DateRangePicker` installs `@mantine/dates` and imports
`@mantine/dates/styles.layer.css` with the other Mantine layer bundles, before `basalt-ui/styles.css`.

### Guards — the control rules (docs/CONTROLS-SPEC.md §6)

**Nothing removed. Eight new oxlint rules and two new guard kinds. `Ships` below is the level as of
THIS minor** — eight land `error`, and the C1 pair (`control-outside-home` and its text lane) is the
only grace left, re-dated to 1.30.0 on a measurement (see § Guards — the promotions).\*\* Every one honours `theme-allow <id> — <why>` on the
node and `theme-allow-file <id> — <why>` on the file, the same grammar as the rest.

| Rule / kind                          | Fires on                                                                                                                                                                                                                                                                                                           | Ships         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| `basalt/hand-rolled-filter`          | A raw Mantine `Select`/`SegmentedControl`/… handed to a TIERED home slot (`actions`/`filters`/`tabs`/`sync`/`filtersEnd` on `PageBar`/`Section`/`WidgetHeader`/`ChartCard`/`StatCard`/`BasaltDataTable`/`SettingsSection`/`FilterSet`)                                                                             | error         |
| `basalt/page-bar-budget`             | A second `PageBar` in the SAME returned tree, >4 `actions.secondary`, >3 `Section` actions, a second filled `Button`/`ActionIcon` in one slot (outside an overlay)                                                                                                                                                 | error         |
| `basalt/control-outside-home`        | The same raw control with no home at all — exempt under a settings row / overlay / composer, in an `@mantine/form` file, in a file that DEFINES a basalt control (and imports no `basalt-ui`), or in a file basenamed `*-{modal,drawer,popover,panel,form}.tsx` / `<Subject>{Modal,Drawer,Popover,Panel,Form}.tsx` | warn → 1.30.0 |
| `basalt/control-size-literal`        | `size`/`w`/`fullWidth`/`visibleFrom`/`hiddenFrom` on anything inside a home slot (the slot sets the tier)                                                                                                                                                                                                          | **error**     |
| `basalt/in-body-page-title`          | `<Title order={1\|2}>` outside prose/overlay context and outside a `content/` path                                                                                                                                                                                                                                 | **error**     |
| `basalt/responsive-twin`             | The same control mounted twice, one `visibleFrom="X"` and one `hiddenFrom="X"`                                                                                                                                                                                                                                     | **error**     |
| `basalt/search-literal-link`         | A `search:` object literal in a `linkOptions()` inside `defineNav()`/`navGroup()`                                                                                                                                                                                                                                  | **error**     |
| `basalt/use-search-from-literal`     | `useSearch({ from: '<route>' })`                                                                                                                                                                                                                                                                                   | **error**     |
| `in-body-page-title` (guard kind)    | The text lane of the same law — SAME id, so one annotation waives both lanes                                                                                                                                                                                                                                       | **error**     |
| `raw-selection-control` (guard kind) | The text lane of `control-outside-home`, approximated by a 12-line host-tag window, plus the same overlay-basename exemption                                                                                                                                                                                       | warn → 1.30.0 |

**A `SettingsRow`'s `control` is not a tiered slot, so nothing in this table fires inside one.**
It is law C1's third home — the form row — and a form keeps Mantine's `md` tier
(`controlHeight` 42, unchanged). A raw `Select`/`Switch`/`Button` bound to a setting is correct
there, and its `size` prop is what holds the row at the form tier, so neither `hand-rolled-filter`
nor `control-size-literal` reaches into it; `control-outside-home` treats a settings row as a home
and stays silent as well. Consumer settings pages need no change.

**Three scoping facts, because each one is a rule NOT firing on code you already have.** The home
tag must resolve to a component imported from `basalt-ui` (or a basalt subpath) — your own
`Section`, `PageBar` or `StatCard` is not a tiered home, and nothing in this table reads it as one;
the one accepted gap is basalt's `Section` re-exported through your own barrel, which the rules
cannot see. An OVERLAY colocated in a slot (`Modal`, `Drawer`, `Popover.Dropdown`, `Menu.Dropdown`,
`SettingsRow`) is exempt — a `New` button beside the `<Modal>` it opens is how both are written, and
the overlay's own controls are not in the bar. And `control-size-literal` only reaches what the
slot's theme actually re-tiers: the raw filters, the basalt controls, and Mantine's
`Button`/`ActionIcon`/`Input`/`TextInput`/`Select`/`MultiSelect`/`SegmentedControl`/`NativeSelect` —
an icon's `size`, a count `Badge`, a `Loader`, an `Avatar` or a `Modal size="lg"` never report.

**Two existing rules widened, neither with a new id.** `basalt/raw-scroll-container` now also fires
on `overflowX: 'auto' \| 'scroll'` and on `<ScrollArea scrollbars="x">` **inside a home SLOT**
(`actions`/`filters`/`tabs`/`sync`/`filtersEnd`) — law C7, overflow folds into a `More` menu or a
`Filters (n)` sheet rather than scrolling sideways. A home's BODY is out of scope: a wide table, a
pinned-column grid or a horizontally scrolling code block in a `Section`/`ChartCard` is page
content, not a sideways-scrolling row of controls, and outside a slot `overflowX` is still not
policed at all.
oxlint severities are per rule ID, not per branch, so this widening inherits the rule's existing
`error` level with no grace runway of its own — the honest limitation, and the reason it is scoped to
homes rather than shipped repo-wide. `basalt/shadow-basalt-export` gains a rename table
(`PageHeader`/`FilterBar` → `PageBar`, `WindowSelector`/`RangeSelector`/`DateFilter` →
`RangeFilter`, `PageSection`/`SectionTitle`/`SectionHeading` → `Section`, `ViewSwitch`/`ViewToggle`
→ `ViewTabs`, `RefreshButton`/`SyncControl`/`SyncStatusButton` → `SyncButton`, `HeroCard`/`HeroStats`
→ `StatCard`), so a fork that RENAMED the export is visible too. It stays a permanent advisory
`warn`.

**`profile: 'tokens-only'` now disables 19 kinds, not 17** — both new kinds are Mantine-coupled.

**`SURFACES` gains `pluginRules`** (`src/surfaces.ts`, internal — not a published subpath): every
doctrine surface names the oxlint rules that enforce it, every registered rule maps to exactly one
surface, every guard KIND maps to at least one, and `basalt-ui check-coverage` asserts all three —
so a generated coverage header can neither over- nor under-report its lane. `check-coverage` also
takes `--write` / `--check` for the generated `<!-- basalt:coverage -->` header of each
`agent/rules/*.md` file; a rule file with no block yet is reported, not failed.

### Controls — the pill reads the VALUE, and four defaults moved

**A filter pill's TEXT is now always the selected option's label, at the field's default value too.**
It used to fall back to the filter's NAME while `field.isDefault(value)` held, which is how a bar
could read `Compare` over a field holding `'previous'` while the popover showed `Previous period`
selected. `label` is the popover/sheet heading and the accessible name; it is never printed on the
pill. Affects `SelectFilter`, `CompareFilter` and every control built on the shared enum body;
`RangeFilter` already read its value, and `MultiSelectFilter` keeps its own law (the group label
while the selection is empty or complete, `N <noun>` otherwise).

**Nothing to change at a call site.** What changes is the string a test or a screenshot sees: a
`SelectFilter field={currency} label="Currency"` at fallback `USD` now reads `USD`, not `Currency`.
If a bar reads badly at rest, the fix is the OPTION label (`store.labels()`), not the filter's name.

| Component / prop                                  | Was                                         | Now                                                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CompareFilter` option labels                     | the raw values until `store.labels()`       | `No comparison` / `Previous period` / `Same period last year`, exported as `COMPARE_LABELS`. A label a consumer set (`label !== value`) still wins.                      |
| `BasaltDataTable` → `withTableBorder`             | `true`                                      | `false`. Pass `true` for a table that needs a frame. The head rule and the between-row rules are untouched; the LAST row's rule is now dropped (it was an outer border). |
| `BasaltDataTable` single-select facet's "all" row | `All`                                       | `Any <facet.label lowercased>` — the pill now reads it, and three facets all reading `All` said nothing.                                                                 |
| `ViewTabs` phone `Select` (past 3 options)        | greedy (216px measured, truncating a title) | capped at 9rem                                                                                                                                                           |

**New: `ControlGroup`** (`basalt-ui/controls`) — joins adjacent controls that act on ONE thing
(`‹ Today ›`, `− 1 +`) into a single box: no gap, one shared hairline per pair, radius on the outer
ends only. `gap?: 'none' | 'tight'`. `BarActionItem` gains `group?: true`, and a run of adjacent
`group: true` actions in an `ActionGroup` renders as one `ControlGroup`; a joined member that ships an
`icon` renders ICON-ONLY with its label demoted to the accessible name. `ActionGroup` also joins
adjacent ICON-ONLY entries on the mobile bar with no flag. `basalt/shadow-basalt-export` now names
`ButtonGroup` / `ButtonRow` / `JoinedButtons` as renamed forks of it.

### The `ctl` tier now covers Radio, Checkbox and Switch

All three defaulted to Mantine's `sm` — a 20px indicator beside the tier's 13.5px option label — in
every filter popover and in the mobile sheet. They are now in `CTL_THEME` (with their `.Group`s) and
`cssVariablesResolver` declares their `-ctl` vars: 16px indicator, 18×30 switch.

**One consequence worth knowing.** Mantine resolves a Radio's size as `props.size ? props.size :
ctx.size`, and a theme `defaultProps.size` is indistinguishable from an explicit prop to that check
— so inside a `<CtlSlot>` (any home's slot) a `<Radio.Group size="lg">` no longer sizes its children;
they stay `ctl`. A group that genuinely needs another size belongs in a BODY, which no slot wraps.

`basalt/control-size-literal` widened to cover the six new tags, so a `size` on a Radio/Checkbox/
Switch inside a home slot now reports. It is still `warn` on its 1.26.0 → 1.27.0 runway (it has never
shipped at any level, so widening it restarts nothing).

### Icons — one box, no call-site geometry

Every `icon` prop in the framework (`BarAction`, the filter pills and their trailing affordance,
`WidgetHeader`/`StatCard`, `SyncButton`, sidebar-block rows, the overflow fold's own glyphs) now
renders through ONE internal slot: a fixed `--vx-space-icon-size` (16px default) square that restates
the glyph's `width`/`height` at 100% and takes it off the text baseline. **No API change** — but a
consumer's `<svg width="24">` that used to set a control's row height now renders at 16px, and an
`<svg>` with no `width`/`viewBox` at all no longer paints at 300×150. Per-tier sizes come from the
box var (`WidgetHeader` sets 14px at `tier="widget"`), never from a prop.

### Mobile nav — at most ONE slot is active

A slot's activeness now reads exactly the destinations it COVERS. It used to roll up over `children`
unconditionally while an item slot covered only its own key, so at `/dashboard/sessions` the
`Dashboard` tab lit through the rollup and the `More` tab lit for `Sessions` sitting in its overflow
— two `aria-current="page"` tabs at once. A SECTION tab still lights for a nested destination (it
covers its whole tree); an ITEM tab with children no longer does, and the overflow slot that can
actually reach the open route lights instead.

`useNav`'s anchors now pass `activeOptions: { exact: true }` to TanStack's `Link`. A `Link` spreads
`{ 'data-status': 'active', 'aria-current': 'page' }` last — after `activeProps` and after every
caller prop — so its own fuzzy match could not be overridden from outside and re-created the very
double-highlight `useNav`'s resolver exists to prevent. basalt's own law is unchanged: an item whose
exact route is never visited still lights on a descendant route.

### Layout — two collisions and a gap

- **The app header**: exactly one side of row 1 is elastic, and it is the breadcrumb (the side whose
  content can ellipsize). The control side is `flex: 0 0 auto` with no `min-width: 0` below it. Both
  sides were shrinkable, and at 390px the sync button overflowed 30px INTO the page title, because a
  `justify-content: flex-end` flex container overflows towards its start.
- **`WidgetHeader`'s hero row**: the value → `DeltaBadge` gap is the 8px rhythm step
  (`--vx-space-stack-sm`), not 4px, and the badge is centred on the value rather than baseline-aligned
  to it.
- **`WidgetHeader`'s title row** wraps below `sm`, so an `actions` slot too wide to sit beside the
  title takes its own line instead of squeezing the heading to an ellipsis. A 30px kebab still fits
  and still sits on the row. **Its metric row wraps too**: in a 2-up card grid at 390px
  `$1294.9k ▲18.9%` rendered as `$129… ▲18.9%`, and truncating the number to protect the delta about
  that number is the wrong way round. A short value still keeps its badge on the line.
- **`StatCard`'s `actions` slot is the 24px tier now, not 30px.** `CtlSlot` gained `tier?: 'ctl' |
'widget'` (default `'ctl'`, so no existing call site changes), and `StatCard` mounts its header slot
  at `'widget'` — the `size="icon"` step `--vx-space-control-height-widget` has always named as
  "`WidgetHeader tier="widget"` actions". A raw `ActionIcon` there rendered at the 30px `ctl` tier
  inside a 28px header row and grew it to 30, so a KPI card WITH a kebab sat 2px below the card
  beside it and every number in it with it. A consumer passing `<ActionIcon size="ctl">` explicitly
  still gets 30px — and its card is 2px taller than its neighbours again, which is now visible rather
  than accidental. The slot's `data-basalt-tier` marker reads `widget` there, the same value
  `ChartCard` already writes by hand.
- **The breadcrumb's ANCESTOR crumbs are hidden below `sm`** — only the page crumb renders. At 390px
  the elastic side truncated `Overview / Dashboard` to `O… / D…`: two ellipses and a separator in
  place of the one word that says where the reader is. CSS-only (law C9), so no flash and no hook.
  `AppBreadcrumbs` gained one wrapper element around those crumbs; its props are unchanged.

### Cursor — the shared cursor now partitions by x-domain kind, automatically

Nothing removed. `CursorState` gained one field.

| Component     | What changed                     | Why it matters                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CursorState` | gains `kind: DomainKind \| null` | No consumer action needed. The shared cursor now classifies each chart's x-domain (`'time' \| 'linear' \| 'band'`, derived from its own keys) and a broadcast whose kind differs from a chart's own is invisible to it — a categorical chart can no longer be mistaken for a time chart. `ChartCursorScope` is no longer required to keep a categorical chart from following a time chart; it still isolates two charts that share the same domain kind but are semantically unrelated. |

## 1.24.0 — `QueryState`, table body chrome, four false greens

**Nothing removed or renamed. Twelve new runtime exports on `.`/`./query`, plus table props.** Every
API entry is additive; the behaviour changes are in the guard and the CLI, listed after them.

### `QueryState` — the branch precedence, shipped as a component

`QueryState`, `LoadingState`, `ErrorState` (+ `QueryStateProps`, `QueryStateLike`,
`QueryStateVariant`, `QueryEmptyCopy`, `LoadingStateProps`, `ErrorStateProps`) on the root barrel,
beside `EmptyState`. `toErrorMessage` and `errorStatus` on `basalt-ui/query`.

basalt owned both ends of this file — `EmptyState` and `toErrorMessage` — and nothing in between, so
a consumer wrote the four-way switch and got it wrong in the direction the shape suggested:
image-share's library rendered `No images` on a **500** and a share detail rendered
`Share not found` on a dropped connection, until 204 hand-rolled lines stopped it. Open since round
4, re-reported in round 6.

- **A component, not a hook** — the product IS the precedence, and a hook returns the same four-way
  switch to every call site.
- **It lives under `src/dashboard/`, not `src/query/`**: `check-dist-layering.mjs` asserts
  `dist/query/index.js` reaches no `@mantine/*`, and this renders Mantine. `query` is typed as a
  five-field structural subset (`QueryStateLike`), so basalt couples to no query-library version and
  a hand-composed object is legal. The subset gives up the compiler, so the shape is asserted at
  **runtime**: a missing `isError` throws naming the field, because a missing `isError` is precisely
  the "500 renders _No images_" bug.
- `errorTitle` / `errorFallback` / `errorAction` apply to the no-cached-data error branch only; the
  error-with-cached-data branch renders a fixed section banner above `children`.
- **`EmptyState.description` is now optional.** Five argo features wrapped the component solely
  because a compact panel had to invent a second sentence. Existing calls are unaffected.
- `toErrorMessage(err, fallback?)` and `errorStatus(err)` had two live bugs the port found: an
  opaque envelope rendered the literal `"{}"`, and `toErrorMessage(undefined)` returned the
  `undefined` VALUE despite a `string` return type. Both fixed; a status is folded into the fallback
  when the body decodes to nothing readable. Split into `src/query/error-message.ts` so the
  dashboard decodes without importing the peer.

**Port result:** image-share, all 10 call sites plus a standalone `ErrorState`, **by changing one
import line each** — no renames, no prop changes, no casts. Total 2467 → 2221; code-only 2056 →
1882, **−174**; `query-state.tsx` 204 → 0.

### `BasaltDataTable` body chrome — and the honest number

New: `maxHeight`, `minWidth`, `stickyHeader`, `stickyHeaderOffset`, `verticalSpacing`,
`horizontalSpacing`, `withRowBorders`, `withTableBorder`, per-column `meta.align` and
`meta.numeral`; `striped` widens from `boolean` to `boolean | 'odd' | 'even'`. `withTableBorder`
defaults to `true` in basalt, overriding Mantine's `false`; every other one is a conditional
pass-through, so omitting it keeps Mantine's default.

**Porting argo's three tables onto them made them 341 → 370–379 lines. 29–38 LONGER.** argo named these
props as the reason the tables stayed hand-rolled, and adding them shortened nothing: column defs
cost more than JSX rows when every cell is bespoke — eight accessor blocks at 4–6 lines each against
an eight-`<Table.Td>` row at ~3. **The ask was mis-specified.** Adopt them for what they buy —
the `type="native"` footgun, alignment stated once instead of on both `th` and `td` six times in one
file, and sorting/filtering/pagination no longer consumer-owned — not for a line count. This is the
counterexample to the band kinds, and the reason the port-before-shipping rule earns its keep.

- `maxHeight` (or `minWidth`) renders **`Table.ScrollContainer type="native"`**, and
  `agent/rules/basalt-data.md` now prescribes that same node for a bespoke table — so the blessed
  lane and the escape cannot contradict, and `type="scrollarea"`, which breaks a sticky `thead`, is
  unreachable through the props. (The prop's JSDoc claimed the docs already sanctioned it; they had
  never named `Table.ScrollContainer` at all.)
- `meta.align` is a `ColumnMeta` module augmentation: a typo'd key is a tsc error, a wrong value
  throws naming the column. `meta.numeral` is read only as `!== false` — an opt-OUT of the
  mono-numeral cell style, never an opt-in.
- **Not shipped, known:** `emptyState` renders inside a `<td colSpan>` so the header row survives an
  empty table — there is no `emptyState="replace"` mode. No per-column `enableSorting` of basalt's
  own; TanStack's `ColumnDef.enableSorting` still reaches `getCanSort()` and works.

### Four false greens

1. **`check-theme` fabricated a config on the ascend path and passed silently.** From a package with
   no `basalt` key it invented `roots: ["src"]` and reported the invention back under the name
   `basalt.roots`. In `basalt-ui-obsidian`, run from `apps/demo`, that scanned **22 of 44** guarded
   files and made `--audit-allows` report **0 live waivers in a repo carrying 1** — exit 0, no note.
   The audit exists so `0 dead` cannot read as `0 dead anywhere`, and it could be made to say zero
   by standing in the wrong directory. `resolveProjectDir` now ascends to the nearest ancestor
   carrying a basalt project, bounded by the repo root, and announces it in the sentence descend
   already used. **No `.git` above cwd means no ascend**, so a standalone consumer keeps the
   built-in defaults exactly as before. After: 44 files, the real 1.
2. **`tokens:css --check` stopped verifying the regeneration command.** 1.23.1 blanked all of line 2
   so a version bump would stop forcing a no-op commit — but line 2 also carries the exact
   invocation line 1 tells the reader to regenerate with. Rewriting `--only core` to `--only all` in
   that line **passed clean**. Only the version token is neutralized now; a line that does not parse
   as a provenance line is compared verbatim, so a deleted or reworded header fails. The success
   message also **parses** the versions instead of asserting them — it used to claim the file "still
   names an older basalt-ui" without reading it, so `0.0.1-nonsense` earned the same sentence.
3. **`doctor`'s icons check was unreachable from the only directory where `doctor` exits 0.** On a
   monorepo the root run omitted it with no `⊘ SKIPPED` line — the exact failure mode `SKIPPED` was
   introduced to eliminate — while the app-package run failed on artefacts of standing in a
   non-install package. It resolves the app package off `basalt.roots` now. No `basaltAppPlugin(`
   anywhere and no `public/` is a pass that says so; a plugin call with no `public/` beside it is a
   `⊘ SKIPPED`, which exits non-zero on its own.
4. **`SCANNABLE_EXT` gained `.astro`, `.jsx` and `.vue`.** rollhook's marketing site is Astro and its
   two `.astro` templates are its entire markup layer — unguarded, while `check-theme` reported a
   clean 4-file scan. It scans 6 now.

**Behaviour change to name: `sync` ascends too.** It shares the resolver, so from a sub-package it
relocates to the parent install and refreshes it — announced — rather than refusing. It still cannot
scaffold a second consumer: the refusal is keyed on the RESOLVED project and runs before the
`basalt.roots` backfill.

### Guard changes the widening exposed

- **`raw-hex` no longer matches inside an HTML numeric character reference.** `&#123;` — the escaped
  brace a template writes to show a literal `${…}` in prose — read as the hex colour `#123`. The
  hole was in the KIND, not the extension: the same string produced the same findings in `.html`,
  `.tsx`, `.css` and `.vue`, so `.astro` only walked into it first. The fix is precise, not blanket:
  `HEX` rejects a full reference (`&#`, digits, `;`), so **`color: red&#fff` still flags** and
  nothing is exempted by file type. Every neighbouring raw-text kind was checked and structurally
  cannot share the blind spot — a character reference contains no `(`, and the rest anchor on a
  property name, `var(`, or a JSX `=`.
- **A fourth guard syntax, `sfc`, for `.astro`/`.vue`.** They used to fall through to the `ts`
  dialect, so `<!-- … -->` was never stripped: a `theme-allow` written in an HTML comment waived
  nothing and a colour inside a commented-out block still reported. `sfc` strips both regions —
  markup first, so an HTML comment holding an unterminated `/*` cannot open one that runs to EOF —
  and keeps the **full 25-kind set**. A `markup` classification would have dropped 22 of them: an
  `.astro` template is JSX-shaped and a `.vue` `<script setup>` is real TS. `.jsx` needs no branch.
  Both the scan and `--audit-allows` now share one `stripGuardComments`, so they cannot disagree
  about what a comment is.
- **Two limits, asserted rather than left ambiguous, both false-negative-only:** `css-raw-surface`
  does not fire inside a `<style>` fence, and stripping is region-blind, so a `<!--` inside a script
  string over-strips.
- **A known non-fix, deliberate:** an all-hex URL fragment or SVG reference (`href="#cafe"`,
  `fill="url(#abcdef)"`) still reports. It is text-indistinguishable from a colour, so a fix would
  cost real findings; `theme-allow` is the escape.
- **The widening ships at `error` with no `GRACE_PERIOD_KINDS` entry, and that table cannot express
  it.** The table is keyed per KIND; widening `SCANNABLE_EXT` widens the file set for all 25 at
  once. An entry for `raw-hex` — the kind that actually fired — would demote basalt's most
  load-bearing kind to `warn` across every `.tsx` and `.css` in all seven consumers to buy runway on
  a file type one consumer has. Measured: rollhook's marketing site scans 6 files with 0 findings,
  and no other consumer holds a single `.astro`, `.vue` or `.jsx` file, so grace would have covered
  zero incumbent violations.

## 1.25.0 — `manualPagination` imposes a contract

**Nothing removed or renamed — a behaviour change, additive props only.** `manualPagination` made
`data` one server page but left every other client-side control armed: sorting reordered that page
under a header chevron while "Showing 1–25 of 412" presented it as a sort of all 412 — a plausible,
wrong answer with nothing on screen to give it away. argo found it on 1.24.0 and worked around it
with an explicit `enableSorting={false}`.

Adopting `manualPagination` now imposes a contract, checked from props at render:

| With `manualPagination`   | Resolve it with                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------ |
| the pagination bar itself | `enablePagination` (without it `manualPagination` is inert) + `rowCount`/`pageCount` |
| sorting                   | the new `manualSorting` + sort in `onSortingChange`, or `enableSorting={false}`      |
| `enableGlobalFilter`      | the new `manualFiltering` + filter in `onGlobalFilterChange`                         |
| `facets`                  | `manualFiltering` + the new `onColumnFiltersChange`                                  |

Unresolved, it **throws in dev** naming every breach at once; a production bundle degrades instead —
no sort headers, no filter controls, no "of N" it cannot stand behind, plus one `console.error`. A
bare `<BasaltDataTable data columns />` (no `manualPagination`) is byte-identical — no opt-out
needed for a client-side table.

Sibling defect fixed with it: the empty-state branch keyed off `data.length`, so a search or page
index matching nothing left `data` non-empty and rendered a `<tbody>` with no rows AND no message.
It now keys off the rendered row model.

## 1.23.1 — the band-state throw, the tag gate, a CLI that answers

**One type widened, nothing removed or renamed.** `BandStripSeries.formatValue` is now
`(d: T) => string | null`. `null` renders an em dash — an absent READING — which `''` never could:
`''` is a state whose label is the whole row. Every existing `(d) => string` still typechecks.

**A typo'd `BandSpan.state` no longer renders as absence.** A state naming no `series` entry used to
be skipped, so the band was simply not drawn — and on a measured/not-measured strip a missing band
is a claim about the data, not an "unknown". A misspelling asserted a reading nobody took, in a mark
indistinguishable from a real one.

| Key comes off                                                 | Dev                                      | Production                                                               |
| ------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| the DATUM — `BandSpan.state`, `marker.state`                  | throws, naming the key and the valid set | a dashed neutral outline band + an `Unknown state` / `<key>` tooltip row |
| a PROP — `absentState`, `MirroredBars`' `up.key` / `down.key` | throws                                   | throws                                                                   |

The split is the whole design. `state` comes off data, so a feed that grows a state basalt has never
seen must degrade rather than take a dashboard down — while a typo, which is the same input, still
fails loudly wherever it is being written. The dashed neutral outline belongs to no legend entry and
no state fill, so it cannot read as data. Pane keys are props, never data-driven, so `assertPaneKey`
throws in every environment: an unresolvable `up.key` used to hide the pane AND its axis, which
reads as "that half measured zero" — the one thing `MirroredBars` exists to keep apart from absence.

**`chart-missing-aria-label` and `unframed-chart` are gated on where the tag came from.** Both key
on a JSX tag NAME, so a consumer's own 235-line `MirroredBars` — sharing nothing with the shipped
kind but the name — was told to pass an `ariaLabel` prop it does not accept, by a rule that presents
as a correctness finding. A tag is now skipped only when the file DEFINES a component of that name
and does not also import it from `basalt-ui`. Deliberately one-directional: a tag imported from
basalt-ui, one imported from a consumer barrel that re-exports it, and one the scan cannot attribute
at all still all fire. Verified old-vs-new over **945 source files across six repos: 0 findings
lost, 0 gained.**

**CLI: `--version` exists, and no subcommand fails open on a flag.** `--version` / `-v` / `version`
print one bare greppable line and exit 0, resolved BEFORE dispatch so it can never run a command to
answer "which basalt-ui is this". Six consumer reports reached for it in one round; all six fell
back to `info --json`.

The larger fix sits underneath it. **Every subcommand validates its flags** and exits 1 naming the
one it does not accept — `doctor --json` used to run doctor and exit **0**, and `check-theme
--audit-allow` scanned and reported success. An unknown COMMAND now says so above the usage block
instead of dumping help and letting the dump read like a choice.

- **`doctor` reads `basaltAppPlugin({ icons })`** out of the consumer's vite config instead of
  hardcoding six filenames, so adopting 1.23.0's icons array stops producing a warning to generate
  five files you deliberately lack. A named array is checked against itself (an icon missing from
  `public/` still warns); an unparseable or absent config falls back to the six-filename check. It
  can only narrow, never blind.
- **`doctor` and `sync` share one sentence about a parent install** (`parentInstallAdvice`). Run
  from a package whose install is above it, `doctor` now names the parent and says `basalt-ui init`
  is NOT the fix. Following its old advice literally scaffolded the second consumer that 1.22.0
  exists to prevent.
- **Every seeded invocation resolves the local bin** (`basaltBinCommand`, overridable via
  `BASALT_BIN`): the `lint` script, the CI steps, the `.claude` PreToolUse hook and doctor's own
  advice all render `./node_modules/.bin/basalt-ui`. `bunx` does not re-resolve a package it has
  cached — that is what made a round-7 report file a P0 against a 1.20.0 cache while believing it
  was on 1.22.0, and the seed was shipping `bunx` into consumer CI in ten places.
  `configs/lefthook.yml`'s `${BASALT_BIN:-bunx --no-install basalt-ui}` default is unchanged and
  deliberate: `--no-install` fails loudly instead of downloading a stranger.
- **`tokens:css --check` blanks the provenance line (line 2) before comparing**, so a version bump
  alone no longer forces a no-op commit in a tokens-only consumer, where the gate is byte-equality.
  A stale provenance line is now a note on an otherwise-passing check. The `@generated` header is
  still emitted byte-identical — the line stays, it just stops gating. **Superseded at 1.26.0:
  blanking the WHOLE line also stopped gating the regeneration command it carries. Only the version
  token is neutralized now.**

### Corrections to the record

- **All six round-8 reports said `basalt-ui --version` "exits 0 printing usage". It exited 1, to
  stderr** — the dispatcher's `default:` branch has always been `console.error(USAGE); return 1`.
  The real fail-open was an unknown FLAG, which no report tested, and the misdiagnosis was relayed
  verbatim into the fix brief. Report the symptom you measured, not the one you inferred from it.
- **`cb4e5b7`'s message is wrong** (`b9b99a6` on `origin/feat/round-7-band-kinds` is the same commit
  pre-merge), and it is on `master` where it cannot be rewritten. It claims it taught
  `unframed-chart` the two new kinds; it widened `CHART_ENTRY_POINT_TAG`, which only
  `chart-missing-aria-label` reads. `unframed-chart` keys on `<ChartLegend items={[` and carries no
  kind list at all — there was never an asymmetric pair to fix.
- **Open question, not a plan.** The import gate does not make `CHART_ENTRY_POINT_TAG` or the oxlint
  plugin's `CHART_TAGS` redundant: that list still answers _which_ tags owe an `ariaLabel`. The gate
  only converts a kind missing from the list from a false positive into an under-report. Collapsing
  the two lists is a separate, larger change and has not been made.

## 1.23.0 — two band kinds, an x-tick seam, CLI resolution

**No export removed or renamed; six new runtime exports and nine new types.** Nothing you wrote
changed. Every entry is additive, and the batch runs the other way from the last three: those made
the guard stricter, this one makes the framework more expressive.

**Two chart kinds `CartesianChart` structurally could not host.** It renders `AxisLeftNumeric`
unconditionally and builds x as `scalePoint` — positions, no widths. `BandStrip` has no y dimension
to axis; `MirroredBars` has two, and needs band widths. Both compose `ChartFrame` directly and
declare themselves with `theme-allow-file hand-rolled-plot`, alongside `DualPanel`.

| New on `basalt-ui/charts`                                                | Note                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BandStrip` (+ `BandStripProps`, `BandStripSeries`, `BandSpan`)          | 1-D categorical bands. `getBand(d) => { state, fill?, absentFraction?, marker? }`; `series` IS the state set, so a strip cannot name a state it does not draw. `cursorResolution` defaults `'leading'`                                                    |
| `MirroredBars` (+ `MirroredBarsProps`, `MirroredBarPane`)                | two bar panes, one x scale, one baseline, independent domains. `up`/`down` take `{ key, max?, autoMaxFloor?, ticks?, format }`; plus `upFraction` (the up pane's share of the band height, where the baseline sits), `getAbsentFraction`, `getBarOpacity` |
| `foldBands` (+ `BandFold`, `BandTooltipConfig`, `BandTooltipRowContext`) | the width-driven fold both kinds run, exported so a consumer can test their `merge` against the real grouping                                                                                                                                             |
| `HatchPattern`, `hatchFill`, `hatchSizeFor`                              | the absence fill                                                                                                                                                                                                                                          |

The shared choreography lives in an internal `useBandPlot` — **not exported**, deliberately: it is
the kinds' contract with each other, not a public seam.

**`MirroredBars` reverses a recorded decision, and the recorded reason for it was wrong.** The old
entry in `docs/CHARTS-SPEC.md` read _"no two-bar-pane kind with independent per-pane scales"_, with
_"a second consumer asks"_ as its trigger. That trigger never fired. Round 4 framed the blocker as
independent SCALES; `DualPanel` already had `topYDomain`/`bottomYDomain`, so that was never it. The
real blockers are that `DualPanel`'s top pane is a LINE pane and its bottom takes one SIGNED
`getBar` over a symmetric domain. A decision recorded against the wrong blocker outlives its own
refutation.

**`xTickValues?: (keys, xMax) => readonly string[]` on `CartesianChart`**, forwarded by `Bars`,
`MultiLine`, `StackedArea`, `ZonedLine` and both band kinds. It resolves AHEAD of `xTicks`, which is
unchanged and still works; omit both and ticks are chosen to fit (`smartTicks`), exactly as before.
Reach for it on a dense time axis: the tick choosers append the final key unconditionally, so a
COUNT that does not land on the last index paints two labels on top of each other at the right edge
— at every count, not at an unlucky one. On the consumer that reported it, the local tick helper
went 200 → 170 lines; it shrinks, it does not disappear. (The promise was 160. The 10-line miss is
docblock — the port's own JSDoc grew, because the helper stopped being a fallback and became the one
seam every chart on the page passes through.)

**`basaltAppPlugin`'s `icons` takes an array now.**

```ts
icons?: false | { dir?: string } | readonly BasaltAppIcon[]
// BasaltAppIcon = { src, sizes?, type?, purpose?, rel? }
icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }]
```

Every entry becomes a manifest icon; an entry reaches the head only when it names a `rel` (`'icon' |
'shortcut icon' | 'apple-touch-icon' | 'mask-icon'`) — which is what lets an app whose `index.html`
already links its favicon take the generated manifest without a duplicate tag. An empty array reads
as `false`, i.e. no `icons` member rather than an empty one. `{ dir }` and the default are
byte-identical to before. **If you kept a hand-written `manifest.webmanifest` because the plugin
could not name your icon, you can delete it now** — with its permanent `theme-allow-file` — the
generated manifest reproduces it member for member, plus an `id` a hand-written copy usually lacks.

**CLI: a repo root with no `workspaces` field was invisible to everything.** With the install one
level down and nothing declaring it, `check-theme` printed "no off-palette colors" having scanned
**zero files** and `doctor` inferred `tokens-only` for a full Mantine consumer. `resolveProjectDir`
now falls back to a bounded two-level layout scan when there is nothing declared to read; a declared
`workspaces` still wins, and 2+ candidates stays ambiguous. `BASALT_CWD` is honoured by all three
commands now, not two.

- **`sync` is profile-aware.** A `"basalt": { "profile": "tokens-only" }` consumer has no scaffold
  to reconcile, so `sync` prints `n/a` and exits 0 — `sync --check` is now wirable into a
  tokens-only repo's CI. It used to refuse and prescribe `basalt-ui init`, the one command that
  would have written a competing install.
- **`DESIGN.md` version rot is healed, not re-stamped.** The stamp was never a constant: `DESIGN.md`
  is a **seed**, written once and never reconciled, so the same line read 1.0.0 / 1.9.0 / 1.21.0 /
  1.22.0 under one install. Reported as four doc bugs over three rounds; it was one. The template
  names no version and `sync` rewrites openers already written.

**The `theme-allow` shape grid is enumerated, not collected.** The reported fifth hole was three:
the closer-alone-on-its-line shape that got reported, a `MAX_COMMENT_BLOCK_LINES = 8` budget
truncating the walk inside a ~12-line docblock (not a JSX shape at all), and the plugin requiring
the annotation's comment to be the LAST one above the node — so a reason wrapped onto a second `//`,
a shape argo writes, reported under oxlint while the guard waived it. The grid now runs the four
axes that vary (comment style × token position × where the closer falls × what follows), pinned row
for row in `src/guard/check-source.test.ts` (37 supported + 8 asserted-unsupported) and
`configs/oxlint-plugin.test.ts` (32 + 8; the guard's extra five rows are CSS/HTML/JSON dialects
oxlint never sees). Zero disagreements, down from five — **and no waiver tally moved in any of the
seven consumer repos.**

Asserting the unsupported cells is the point: it stops "unsupported" and "silently broken" reading
the same. What does NOT waive, in both halves:

| Shape                                                                                                            | Why                                                                                       |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| a blank line between annotation and code — after `//`, after `{/* */}`, or after a `{/*` whose closer sits alone | a blank line is how you say "this comment is not about the next statement"                |
| the token mid-sentence in a line comment, a docblock gutter, or a JSX expression comment                         | prose that MENTIONS the token is not an annotation — the reason it must START its comment |
| the token inside a string literal                                                                                | same                                                                                      |
| above a multi-line OPENING tag, with the finding on a later attribute line                                       | a waiver reaches the first line below its comment, not an arbitrary line further down     |

**Corrected consumer findings.** _"`sync` scaffolds 19–20 files into a consumer root"_ **did not
reproduce** — those runs used a stale `bunx` cache of 1.20.0, and `bunx` does not re-resolve a
package it already has. Check an upgrade against the local bin. Round 6's _"`doctor` exits 0 on hard
failures"_ was a pipe artifact (`$?` read after `| tail`) and was already withdrawn.

## 1.22.0 — the toolchain stops overclaiming

**No export removed or renamed; four added.** Nothing you wrote changed. Every entry below is a
check that reported an answer it had not earned, so a green CI on 1.21.0 was, for several of them,
green over an empty set.

**`sync` refuses where it used to scaffold.** Run from a sub-package that depends on basalt-ui but
holds no `.basalt/manifest.json` — `apps/dashboard`, `apps/web` — it printed `0 updated, 20
recreated`, wrote a second `basalt` key, and stood up a complete competing install beside the real
one at the repo root. argo and rb both reverted it by hand. It now resolves its project exactly as
`check-theme` and `doctor` do, and **exits 1** when the resolved project has no manifest, naming the
install it found above instead. The refusal runs before the `basalt.roots` backfill, which was half
the damage. Two ways to unblock it:

```bash
cd <the package holding .basalt/manifest.json> && ./node_modules/.bin/basalt-ui sync
BASALT_CWD=<that package> ./node_modules/.bin/basalt-ui sync   # or from anywhere
```

The summary line gained a `created` counter. **`recreated` now means what it always claimed** — the
ledger placed that file once and it went missing. Twenty first-time writes were never that.

**`--audit-allows` judges plugin-rule annotations.** They used to print "not a check-theme kind" and
drop out of the exit-1 gate, so the gate covered an empty set wherever the waivers were plugin
rules: argo's whole tally was `0 live, 0 dead, 8 outside reach`, and 11 of linewatch's 14 went the
same way. Each is now probed by re-running oxlint over that one file with the annotation
neutralized. Judged now: argo 8 of 8, linewatch 14 of 14, basalt's own tree 23 of 23.

**It requires oxlint to be reachable.** The probe writes one neutralized sibling file and re-runs
oxlint over it (oxlint has no stdin mode), removing it in a `finally`. Where oxlint cannot run, the
annotation is reported as **"cannot judge"**, never as dead. The report now also prints the scope it
audited — `0 dead` over `basalt.roots` was reading as `0 dead anywhere`.

**`doctor`'s `lefthook-preset` check asks a different question.** It tested whether the config text
contained the `extends` string. It now asks whether the gate EXISTS, via `lefthook dump`, which
resolves `extends`, `include` and per-command `root:`. linewatch wires all three jobs with
`root: 'web/'` precisely because `extends` merges commands _without_ their working directory — it
was correctly configured, got warned, and the old advice would have broken it. Three outcomes: a
broken `extends` target is still a hard fail, a provably absent gate is a warn, and where
`lefthook dump` could not run you get an advisory warning naming what it could not see.

**`basalt/shadow-basalt-export` narrowed twice.** It now gates on `isBasaltScopedFile` like every
other rule in the file, and needs a component-SHAPED declaration — a function, an arrow, a
`memo`/`forwardRef` wrapper, or a class extending one. It had been firing on a `SlugTracker` class
in a React-free package carrying no basalt-ui dependency, telling it to import from basalt-ui. The
stated limit is unchanged: exact-name-only, a tripwire, not coverage.

**`basaltAppPlugin({ icons: false })` now omits the manifest's `icons` member too.** It skipped the
head `<link>` icons and emitted the two PNG manifest entries anyway, so `{ manifest: true, icons:
false }` shipped an installable app pointing at two 404s. The manifest is now **honest** about
icons — it is not yet **sufficient**. If you went hybrid over the 404s, dropping the hand-written
half here costs you every icon unless your `public/` matches basalt's six filenames: at this
release `icons` was still `false | { dir?: string }` over those six, so an app whose icon is
`favicon.svg` could pick between a manifest naming two PNGs it never builds and a manifest with no
`icons` member at all. The array form that fixes it is in `## 1.26.0`. The option's JSDoc said
"skips the head `<link>` icons"; it now says what the option does.

**Two `theme-allow` comment shapes were silently broken and now work.** Plainly: this is the fourth
hole found in this one contract in three rounds. A thirteen-shape matrix — every shape a consumer
had been SEEN to write — is pinned in both halves, `src/guard/check-source.test.ts` and
`configs/oxlint-plugin.test.ts`. **The claim that followed it here, that the two parsers could
therefore no longer disagree, was false when it was written**: a list of collected anecdotes cannot
close a contract. Three more holes were open at this release. See `## 1.26.0`.

| Shape                                         | What it did                                                                                                                | Now                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `/** theme-allow <id> — <why> */` on one line | waived under oxlint, reported under `check-theme`                                                                          | both halves honour it                   |
| `{/*` + token on the next line + `*/}`        | comment-stripping left a bare `}`, so the line read as CODE and the annotation was classified trailing — scoped to a brace | scoped to the node below it, as written |

**linewatch writes that wrapped shape for every hand-composed chart axis**, so any _guard_ kind
annotated that way was silently unwaivable. It only appeared to work because the rules it names
(`hand-rolled-plot`) live in the oxlint plugin, whose placement test is comment-node-based and never
saw the brace.

**New, additive — `./guard` gains four runtime exports**, the reader half of the audit:

| Export                                       | Note                                                                                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `findAllowAnnotations(text, relPath, cfg)`   | every annotation as written, ids split into `guardKinds` / `pluginRules` / `unknownRules`. Shares `collectAllowAnnotations` with `checkSource`, so it cannot list a line the scan does not honour |
| `neutralizeAllowAnnotation(text, line, cfg)` | one annotation rewritten to the token below, every other left intact — the probe half of an audit                                                                                                 |
| `NEUTRALIZED_ALLOW_TOKEN`                    | so a guard probe and an oxlint probe neutralize identically                                                                                                                                       |
| `PLUGIN_RULE_IDS`                            | the ids only oxlint can judge                                                                                                                                                                     |

The `AllowAnnotationSite` type ships alongside them.

**Known gaps, reported and not fixed:** `--audit-allows` says nothing about `basalt.exempt` — a
whole file removed from the scan, the broadest exception the config surface has — and its
`scoped to …` line does not distinguish `theme-allow` from `theme-allow-file`.

## 1.21.0 — the `theme-allow` grammar

**No export removed or renamed.** One break, and it is in the escape hatch itself: **file scope must
now be spelled `theme-allow-file`.** At 1.20.0 an annotation that named a rule and gave a reason —
the exact shape the rule's own message asks for — was promoted to a whole-file declaration, which is
why per-node scoping never actually shipped. The two forms are now distinct:

```text
theme-allow                                  → this node/line, EVERY rule   (reports theme-allow-unscoped)
theme-allow <id>[, <id>…] [— <why>]          → this node/line, those rules
theme-allow-file <id>[, <id>…] — <why>       → the WHOLE FILE, those rules; a bare one waives NOTHING
"basalt:theme-allow[-file]": "<id>… — <why>" → the same two, for JSON / .webmanifest
```

**The migration is one word per file declaration.** Measured across the consumer sweep: linewatch
0 → 11 findings, argo 0 → 6, rb 0 → 0 — all `warn`, so **no build changes colour**.

```diff
-// theme-allow hand-rolled-plot — two panes over one x scale
+// theme-allow-file hand-rolled-plot — two panes over one x scale
```

**An annotation must now START its comment** — after `//`, `/*`, `<!--`, a block-comment gutter `*`,
or nothing but whitespace. Both parsers used a bare substring search, so a comment that merely
_mentioned_ the token parsed as the legacy blanket form and switched every rule off on the line
below. linewatch documented its own waivers in a docblock and thereby disarmed the file — a false
NEGATIVE, and the reason this ships as a break rather than a grace period. Every annotation anyone
actually writes still qualifies; a sentence about the escape hatch no longer waives anything.

**A comment-only annotation now reaches the first CODE line below it**, walking through the rest of
its own comment block. Before, a reason that wrapped onto a second line, or a docblock's `*/`,
absorbed the waiver and the natural shape silently waived nothing — argo hit that three times in one
upgrade. A blank line still ends the block.

**`.json` / `.webmanifest` finally have a waiver.** They have been scanned since 1.20.0 and cannot
hold a comment, so their findings were unwaivable and the printed remedy prescribed something
impossible; both consumers fell back to a blanket `exemptRules`. Use a member key — but for a
manifest, `basaltAppPlugin` is the first remedy, since a hand-copied hex drifts from the palette:

```json
{ "basalt:theme-allow-file": "raw-hex — a PWA manifest theme_color must be a literal hex" }
```

**Two API-shaped fixes worth acting on:**

| Change                                                                     | What to do                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createSearchParamStore` / `createMultiSearchParamStore` gain `linkSearch` | replace every nav link's `search: { <param>: '<literal>' }` with `search: <store>.linkSearch`, passed BY REFERENCE. A module-scope literal pins the fallback on every click — argo's reader had ZERO call sites, so "remember my window" had never worked |
| `BasaltShell` collapse moves to `createPersistedState`                     | the key is now `basalt:<storageKey>` holding `{ v, value }`; read it with `readPersistedValue(storageKey, 1)`. A one-time migration adopts the raw pre-1.21.0 value, so the sidebar does not re-expand on upgrade                                         |

**New, additive:**

| Surface                                              | Note                                                                                                                                                                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-theme --audit-allows`                         | every waiver and every `exemptRules` entry with what it still suppresses, proved by re-running the guard with that one occurrence neutralized. Exits 1 on a dead waiver — wire it into CI                                                     |
| `basalt.exemptRules` takes paths, globs and a reason | relative paths and directory prefixes (`public/site.webmanifest`, `src/agent`), globs (`*` stops at `/`, `**` does not, a slash-free glob also matches the basename), and `{ paths, reason }`. Entries that suppress nothing are now reported |
| `doctor` → `lefthook-preset`                         | hard-fails a broken `extends` target. lefthook merges a missing target into ZERO commands and exits 0, so a stale path leaves a repo with no pre-commit gate and a clean `lefthook dump`. `sync` reports the same seam                        |
| `basaltAppPlugin({ colorScheme })`                   | `'dark'` (default) / `'light'` / `'auto'` / `false`. Set it to whatever the app passes as `defaultColorScheme` — before this, a light-scheme consumer got dark native controls permanently                                                    |
| `VX.text.nano` (10px) + `VX.text.display` (30px)     | the two rungs `inline-font-size` could previously only be waived for. A 20px rung was rejected: 21/20 = 1.05 is below the ladder's 1.06×–1.17× band, so `h2` is the remedy                                                                    |
| `sync` backfills `basalt.roots`                      | only `init` wrote it, so every existing consumer sat on the undeclared `src` default while `guard-scan` passed. A declared value is never overwritten                                                                                         |
| `basalt/shadow-basalt-export` reads all nine barrels | the charts layer included. Still exact-name-only — a **tripwire, not coverage**                                                                                                                                                               |

Also: `check-theme`'s `inline-spacing` no longer reads a unitless number in a plain options bag as
CSS (`fitBounds({ padding: 48 })` stops reporting); the shipped `oxfmt` pre-commit job drops back to
`*.{ts,tsx,js,jsx,css}` and gains `--no-error-on-unmatched-pattern`; `tokens:css` emits `0.1` rather
than `0.10`, so a committed sheet stops failing prettier — re-run the command to pick it up.

**The lefthook preset overrides YOU, not the other way round.** An `extends` target wins on a
colliding key: declare `pre-commit.commands.oxfmt.run` (or `glob:`) in your own file and **yours**
is the one silently discarded. Only keys the preset does not define merge in. The guard job runs
`${BASALT_BIN:-bunx --no-install basalt-ui}`; that shell default is the sanctioned seam, set via
`env:`, which does merge.

## 1.20.0 — enforcement

**No export removed or renamed.** The whole delta is that things which used to pass now report. If
your build goes red on this upgrade, that is the release working. Every new **kind** and **rule**
lands `warn` — but two other changes in this release do fail a build: `basalt/raw-size-literal`
promotes to `error`, and the widened markup scan reads `index.html` / `.webmanifest`, where a raw
hex is an `error`-severity colour kind. Two consumers exited 1 on exactly that.

| Change                                                           | What you'll see                                                                                                 | What to do                                                                                |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `basalt/raw-size-literal` `warn` → **`error`**                   | CSS-length strings on `size`/`fz`/`fontSize` now fail lint                                                      | use a token (`size="sm"`); `warn` since 1.7.0, zero violations across all seven consumers |
| Five new guard kinds (`warn`)                                    | `theme-allow-unscoped`, `surface-shadow-override`, `css-raw-surface`, `inline-font-size`, `hidden-inline-style` | see below; promotion is tracked in `GRACE_PERIOD_KINDS`                                   |
| Two new oxlint rules (`warn`)                                    | `basalt/shadow-basalt-export`, `basalt/hand-rolled-shell`                                                       | import the shipped component instead of the fork                                          |
| `basalt/hand-rolled-plot`, `basalt/chart-legend-literal` widened | more sites report; both stay `warn`                                                                             | a widened rule does not promote in the minor that widens it                               |
| `doctor` `SKIPPED` exits non-zero, + 3 new hard checks           | doctor goes red where it was green                                                                              | that is the finding — see below                                                           |

**`theme-allow` has a new contract, and one comment shape stops waiving.** A bare `theme-allow`
still waives every kind, but now reports `theme-allow-unscoped`. Rescope it — and spell the id
right, because a word in the id slot that names no rule now waives NOTHING rather than degrading to
the blanket form:

```diff
-// theme-allow
+// theme-allow raw-surface — third-party widget needs a literal corner
```

**The break: a reason with no separator introducing it.** `// theme-allow legacy vendor asset` used
to waive the line; it now waives nothing and the un-suppressed finding reports at its own severity
(`error` for `raw-hex`). The first word after the token is read as a rule id, and an id that names
no rule fails closed — that is the whole point, since the alternative is one mistyped character
silently widening a scoped waiver into a blanket one. No annotation in any of the seven consumer
repos writes that shape; every one of them introduces its reason with `—`, `–`, `-` or `:`. Add a
separator, or an id:

```diff
-// theme-allow legacy vendor asset
+// theme-allow raw-hex — legacy vendor asset
```

Prose AFTER a resolved id is safe and needs no separator —
`// theme-allow raw-surface sub-scale legend corner` waives `raw-surface` and reports nothing. Only
a comma keeps the id list open past the first id.

Two placements that used to fail now work, both matching what the oxlint plugin always did: a
comment-ONLY line directly above the reported line (the only form JSX can express — the reported
line is usually a multi-line opening tag or a `{expr}` child), and in CSS a trailing annotation
reaching back over the declaration it terminates, which is what survives the shipped `oxfmt`
reflowing a long `background-color` so the hex lands above the comment.

**`basalt/hand-rolled-plot` waivers must now be written deliberately.** Every assembly node is
reported individually, and a waiver is no longer picked up off whatever comment happened to sit on
the file's first assembly node — it needs a written declaration naming the rule and giving a reason,
anywhere in the file: `// theme-allow hand-rolled-plot — two panes over one x scale`.

**But the waiver is still whole-file, and per-node scoping is not expressible at 1.20.0.** Naming
the rule AND giving a reason is what `hasFileDeclaration` matches, at any line — so a comment
intended for one node silences the file. Dropping the reason keeps it node-scoped in the oxlint
plugin, but then `check-theme` reports `theme-allow-unscoped ("no reason")`. The two halves of the
contract intersect at exactly one legal shape and that shape is whole-file. Write the declaration in
the component's docblock, where it reads as the file-level decision it is. **Fixed in 1.21.0** —
see that section; the declaration moves to `theme-allow-file`.

**`doctor` will go red.** `SKIPPED` is a third outcome beside pass/warn/fail and exits non-zero on
its own — "All checks passed" is only printable when every check RAN. Three new hard checks:
`basalt-resolves` (walks cwd → ancestors → workspace packages), `guard-scan` (would `check-theme`
cover more than zero files?), `oxlint-preset` (does `.oxlintrc.json` really extend the shipped
preset? JSONC is parsed, not rejected — `init` keeps an existing config, so one repo ran five minors
with the whole lint half off).

**New, additive:**

| Surface                                                          | Note                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `basalt.profile: 'tokens-only'` / `--tokens-only`                | disables the 19 kinds whose remedy is a Mantine component, prop or the React theme factory. `check-theme` requires it DECLARED; `doctor` infers it, because its profile only changes advice, never enforcement                                                                                                                                                                                                                               |
| `basalt.include: [...]`                                          | scan a named file outside `roots` — and the only route to a `.json`, which is never blanket-scanned                                                                                                                                                                                                                                                                                                                                          |
| `basalt.roots` + a `lint:basalt` script                          | written by `init` from the real layout; `init` on an existing app is a lint-debt event, not a no-op                                                                                                                                                                                                                                                                                                                                          |
| `tokens:css --check`, `--selector-class <c>` (+ `--light-class`) | drift gate; the Tailwind `<html class="dark">` convention. There is no `scheme: { class }` API — the class form is CLI-only                                                                                                                                                                                                                                                                                                                  |
| `fonts:css [--out] [--check]`                                    | the shipped `--basalt-font-*` stacks as plain CSS, read out of `styles.css` — the only route to basalt's typefaces without the Mantine-coupled `styles.css`                                                                                                                                                                                                                                                                                  |
| `__APP_VERSION__` ambient declaration                            | ships via `src/register.ts`, re-exported by the root barrel: delete your hand-written ambient block. A subpath-only consumer does not get it                                                                                                                                                                                                                                                                                                 |
| `BASALT_CWD`                                                     | `check-theme`/`doctor` honour it, and relocate to the single workspace package carrying a basalt config when invoked from a root that has none                                                                                                                                                                                                                                                                                               |
| `@generated basalt-ui` header                                    | `tokens:css`/`fonts:css` output carries it on line 1, the version + invocation line on line 2, and `check-theme`, in a `.css` file with that exact header, skips the LINES that are basalt custom properties, selectors, `}` or self-closing comments — this is what fixed 116 violations reported inside the stylesheet `tokens:css` had just written. Committed output emitted by 1.19.1 has no header: re-run the command to get the skip |

`check-theme` also resolves `.html` / `.webmanifest` / `.json` as markup (colour kinds only), and
each root's PARENT now contributes its `index.html` and `public/` tree.

## 1.19.0 — nav

| Removed / renamed                                                 | Replacement                                                                                                                      | Note                                                                                                                                                        |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NavLinkRenderer` (type)                                          | `defineNav` + `{...useNav(NAV)}` (`basalt-ui/router-tanstack`), or `SidebarItem.Anchor`                                          | basalt now paints every nav pixel                                                                                                                           |
| `BasaltShellProps.renderNavLink`, `AppSidebarProps.renderNavLink` | same                                                                                                                             |                                                                                                                                                             |
| `BreadcrumbLinkRenderer` (type)                                   | `AppBreadcrumbs.parentAnchor`                                                                                                    |                                                                                                                                                             |
| `BasaltShellProps.renderBreadcrumbLink`                           | same                                                                                                                             |                                                                                                                                                             |
| `BasaltShellProps.sidebarFooterExtra`                             | `mobileNav.moreExtra`                                                                                                            | its only host was the mobile drawer; it rendered nowhere on desktop                                                                                         |
| `AppSidebarProps.footerExtra`, `AppSidebarProps.onClose`          | —                                                                                                                                | the full-height mobile sidebar drawer is deleted                                                                                                            |
| `MobileNavItem` (type)                                            | `MobileNavSlot`                                                                                                                  |                                                                                                                                                             |
| `MobileNavSection` (type)                                         | `MobileNavGroup`                                                                                                                 |                                                                                                                                                             |
| `MobileNavLinkRenderer` (type)                                    | `MobileNavModel`                                                                                                                 |                                                                                                                                                             |
| `SidebarSection.mobileTab`                                        | `SidebarSection.mobile?: false \| NavSectionMobile` — an OBJECT (`{ tab: true, label?, icon? }`), or `false` to hide the section | `'tab' \| 'more' \| 'hidden'` is `SidebarItem.mobile` (`NavMobilePlacement`, `true` ≡ `'tab'`, `false` ≡ `'hidden'`) — a different prop on a different type |

A consumer with no router needs no migration — `href` + `onClick` still work.

**Expect new type errors, and read them.** `renderNavLink` took `to` as an opaque value, which is
why consumers reached for `to={target.to as never}`. `defineNav` types it, so a destination missing
a required `search` now fails to compile — in one repo that surfaced two nav links that had been
shipping without required params. Fix with a click-time thunk (`search: () => Schema.parse({})`),
never `search: true`.

## 1.17.0 — behaviour only, no export removed

| Changed                                              | Effect                                                       | Opt out                          |
| ---------------------------------------------------- | ------------------------------------------------------------ | -------------------------------- |
| `resolveAxisDomain` clamps before padding, not after | the axis top moves on any chart with an `autoMaxFloor`       | lower the floor, or pin `domain` |
| `ChartFrame` `role="img"` → `role="group"`           | `role="img"` pruned the keyboard slider out of the a11y tree | —                                |

## 1.15.0 — chart layer rebuilt

The largest delta in the 1.x line. No shims were shipped.

| Removed / renamed                                                                                                                                                    | Replacement                                                                                                                                                | Note                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ChartHoverSync`, `ChartHoverSyncProps`                                                                                                                              | `globalCursorStore` / `createCursorStore` / `useChartCursor` / `useCursorState` — **no provider**                                                          | `ChartCursorScope` now _isolates_ a subtree; it is the inverse of the old provider, not a rename                                                                                                                                             |
| `HoverContext`, `HoverCtx`, `useHoverSync`, `DEFAULT_NO_OP_SET_HOVER`                                                                                                | `useChartCursor`, `useCursorState`, `CursorState`, `CursorStore`                                                                                           | context → `useSyncExternalStore`                                                                                                                                                                                                             |
| `ResponsiveChart`, `ResponsiveChartProps`                                                                                                                            | `CartesianChart` / `CartesianChartProps` (+ `autoMargin`, `PlotContext`, `PlotRect`)                                                                       | now mandatory for every single-plot cartesian chart, enforced by `basalt/hand-rolled-plot`                                                                                                                                                   |
| `ChartTooltip` (tip-based), `useChartTooltip`, `useTooltipStyles`                                                                                                    | `ChartTooltipFloat` + the `tooltip: CartesianTooltipConfig` prop                                                                                           | portal / flip / clamp done once                                                                                                                                                                                                              |
| `BarsAxisConfig`                                                                                                                                                     | `AxisConfig` + `resolveAxisDomain`                                                                                                                         |                                                                                                                                                                                                                                              |
| `ZonedLineTooltipLabel`                                                                                                                                              | `tooltip` config on the kind                                                                                                                               |                                                                                                                                                                                                                                              |
| `ZonedLine`/`MultiLine`: `yDomain`, `yAutoPad`, `yAutoMaxFloor`, `yAutoMinCeil`, `numTicksY`, `formatYTick`                                                          | one `y?: AxisConfig<T>`                                                                                                                                    | `y` is **optional** where `yDomain` was required                                                                                                                                                                                             |
| `ZonedLine`/`MultiLine`: `tooltipLabel`, `renderExtraTooltipRows`                                                                                                    | `tooltip.label`, `tooltip.extraRows` (`CartesianTooltipConfig`)                                                                                            | there is no `appendRows`; the field is `extraRows`                                                                                                                                                                                           |
| `ZonedLine`/`MultiLine`: `formatValue`                                                                                                                               | **`y.format`** — or per-series `ChartSeries.formatValue` for one row                                                                                       | `CartesianTooltipConfig` has no value formatter: the axis format IS the tooltip value format                                                                                                                                                 |
| `ZonedLine`/`MultiLine`: `numTicksX`                                                                                                                                 | `xTicks`                                                                                                                                                   | `xZones` added alongside                                                                                                                                                                                                                     |
| `Bars`: `formatValue`, `hideBarTooltipRows`, `leftAxis`, `rightAxis`, `marginLeft`, `numTicksX`, `tooltipLabel`, `renderExtraTooltipRows`, `renderPrefixTooltipRows` | `y` / `y2` (`AxisConfig`), `xTicks`, `tooltip.{label,extraRows,prependRows}`, per-bar `BarsBar.formatValue` / `.tooltip`, measured `autoMargin` + `margin` | passing `y2` is what makes a chart dual-axis. `chartMargin({ rightAxis })` is **not** removed — it is still exported from `basalt-ui` and `basalt-ui/charts`; it is simply no longer needed, since the right gutter follows from measurement |
| `StackedArea`: `formatValue`, `numTicksX`, `numTicksY`, `yAutoMaxFloor`, `yLabel`                                                                                    | `y` (incl. `y.format`), `xTicks`; per-series `ChartSeries.formatValue`                                                                                     | `StackedAreaProps` has **no** `tooltip` prop — its tooltip is entirely derived from `series`                                                                                                                                                 |
| `Heatmap.width`                                                                                                                                                      | measures itself; takes `height` / `aspectRatio` / `fill`                                                                                                   |                                                                                                                                                                                                                                              |

## 1.12.0 — agent-chat, behaviour only

| Changed                                                                    | Effect                                                                                                                                              |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `streaming` no longer selects the image allowlist                          | **security-relevant.** Model output must now pass `contentTrust="untrusted"`; leaving it unset silently reopens prompt-injection image exfiltration |
| consumer `rehypePlugins` output is now sanitized, `clobberPrefix` is empty | a consumer injecting non-default elements must pass a matching `sanitizeSchema`                                                                     |

## 1.11.0 — agent parts

Semver-breaking in a minor; the commit body says so.

| Removed / renamed                                        | Replacement                                                                                           | Note                                                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `ToolCallPart` flat `{ type, toolName, input, output? }` | `ToolCallPart` as a 7-arm union discriminated on `state` (`input-streaming` … `output-error`)         | mirrors the AI SDK v7 lifecycle                                                             |
| the error field named `error`                            | `errorText`                                                                                           | the SDK union has no `error`                                                                |
| flattened approval fields                                | nested `approval: ToolApproval`, carried verbatim                                                     | flattening dropped `isAutomatic` / `signature`                                              |
| —                                                        | every `AgentPart` now extends `PartBase` with a **required `id`**; `withPartIds` mints them on drafts | a 1.10-shaped part rehydrated from localStorage no longer throws, but id-less parts collide |
| `ToolChip` threw `assertNever` on an unknown state       | now falls back instead of throwing                                                                    |                                                                                             |

## 1.0.0 — the Mantine pivot

| Removed / renamed                                                                             | Replacement                                                               | Note                                                                             |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `./css` subpath (877 lines: 307 custom props, 19 utilities, a reset, the Tailwind entrypoint) | `basalt-ui tokens:css` / `basalt-ui/tokens.css` — **but only from 1.3.0** | between 1.0.0 and 1.2.x the only CSS door was `styles.css` + `buildPaletteCss()` |
| `./starlight` subpath                                                                         | —                                                                         | no replacement                                                                   |
| the OKLCH foundation palette, ShadCN/Tremor/Starlight doctrine                                | the three-tier `--vx-*` system                                            | see `docs/FRAMEWORK-FREE.md` for the token-only route                            |

Names that have no 1.x equivalent: the `--chart-blue-1..8` sequential ramp (1.x is categorical
`--vx-fill-*` only), the default font stacks as a token (they live in `styles.css`), `purple` as a
text color, `black`, `blue-400`/`green-400`.

**The typefaces changed at 1.0, not just their delivery.** 0.4.2 shipped Instrument Sans; 1.x ships
Nunito Sans (body) + Hubot Sans (condensed headings), mono unchanged at JetBrains Mono. `fonts:css`
emits the 1.x stacks — for a 0.4.2 migrant that is a **rebrand**, not a restoration. It also emits
`--basalt-font-head-stretch: 88%`, tuned for Hubot Sans specifically; pointed at another face it
silently condenses it.

## 1.0.1 — CLI binary renamed

`basalt` → **`basalt-ui`**. Never `bunx basalt`.

---

## Lint and guard rules that tightened

Two independent mechanisms, each with its own ledger — read the ledger, not this table, for what is
in grace TODAY. `GuardKind` severities (`basalt-ui check-theme`) default to `error` and are
downgraded only by `GRACE_PERIOD_KINDS` (`src/guard/index.ts`). `basalt/*` oxlint rule severities
live in `configs/oxlint.json`, and since 1.20.0 their grace is tracked by `PLUGIN_RULE_GRACE`, a
named export beside the plugin — a test asserts it against the shipped preset in both directions, so
deleting an entry forces the level flip in the same commit.

| Rule                                   | Landed           | Became `error`                                                                              |
| -------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| `mantine-shade-index` (guard kind)     | 1.7.0 as `warn`  | **1.11.0**                                                                                  |
| `basalt/raw-scroll-container`          | ≤1.2.0 as `off`  | `warn` 1.10.0 → **`error` 1.13.0**                                                          |
| `basalt/ai-sdk-major`                  | 1.10.0 as `warn` | **1.13.0**                                                                                  |
| `basalt/agent-no-raw-usechat`          | 1.10.0 as `warn` | **1.13.0**                                                                                  |
| `basalt/agent-resume-guard`            | 1.10.0 as `warn` | **1.13.0**                                                                                  |
| `basalt/raw-size-literal`              | 1.7.0 as `warn`  | **1.20.0**                                                                                  |
| `basalt/hand-rolled-plot`              | 1.21.0 as `warn` | **1.26.0** (grace had restarted at the 1.21.0 widening)                                     |
| `basalt/chart-legend-literal`          | 1.20.0 as `warn` | **1.26.0**                                                                                  |
| `basalt/shadow-basalt-export`          | 1.20.0 as `warn` | ADVISORY — permanent `warn`, see below, never subject to the C16 gate                       |
| `basalt/hand-rolled-shell`             | 1.20.0 as `warn` | **1.26.0**                                                                                  |
| `theme-allow-unscoped` (guard kind)    | 1.20.0 as `warn` | **1.26.0**                                                                                  |
| `surface-shadow-override` (guard kind) | 1.20.0 as `warn` | **1.26.0**                                                                                  |
| `css-raw-surface` (guard kind)         | 1.20.0 as `warn` | **1.26.0**                                                                                  |
| `inline-font-size` (guard kind)        | 1.20.0 as `warn` | **1.26.0**                                                                                  |
| `hidden-inline-style` (guard kind)     | 1.20.0 as `warn` | **1.26.0**                                                                                  |
| `basalt/control-size-literal`          | 1.26.0 as `warn` | **1.27.0**                                                                                  |
| `basalt/in-body-page-title`            | 1.26.0 as `warn` | **1.27.0**                                                                                  |
| `in-body-page-title` (guard kind)      | 1.26.0 as `warn` | **1.27.0** — same id as the rule above, so one waiver covers both                           |
| `basalt/responsive-twin`               | 1.26.0 as `warn` | **1.27.0**                                                                                  |
| `basalt/search-literal-link`           | 1.26.0 as `warn` | **1.27.0**                                                                                  |
| `basalt/use-search-from-literal`       | 1.26.0 as `warn` | **1.27.0**                                                                                  |
| `basalt/control-outside-home`          | 1.26.0 as `warn` | still `warn`, `promote: '1.30.0'` — re-dated on 9 measured cross-file overlay warns in argo |
| `raw-selection-control` (guard kind)   | 1.26.0 as `warn` | still `warn`, `promote: '1.30.0'` — the text lane of the row above                          |

`card-with-border`, `inline-display`, `raw-html-layout`, `raw-form-control`, `raw-font-family` and
the other original guard kinds have been `error` since before 1.2.0 — they never had a grace minor.
Guard findings only gained a severity field at all in 1.4.0; before that every finding was fatal.

**Both ledgers changed shape at 1.26.0 (C16, `docs/CONTROLS-SPEC.md` §1).** An entry
used to be a bare promotion-note string with no expiry a machine could check — which is exactly how
the nine rows above sat at `warn` for five minors although the doctrine below says "one minor". Both
`PLUGIN_RULE_GRACE` (`configs/oxlint-plugin.js`) and `GRACE_PERIOD_KINDS` (`src/guard/index.ts`) now
hold `{ since, promote, why }` (semver strings), and a version-gated test fails the build once
`package.json`'s version reaches an entry's `promote` while the entry is still there — see
"1.26.0" above for the full change. `shadow-basalt-export` moved to a sibling ledger,
`PLUGIN_RULE_ADVISORY`, which the gate never checks: it was already documented as a possible
permanent `warn`, and the version-gate doctrine only fits an entry that has an honest promotion
date.

**Rule-id rename at 1.1.0:** `basalt/import-boundary` split into `basalt/visx-boundary`,
`basalt/visx-tooltip` and `basalt/token-layer-boundary` (the last is repo-local and deliberately not
in the shipped preset). A config still naming `import-boundary` after 1.1.0 disables nothing.

## Deprecated, not yet removed

The 32 camelCase `--vx-*` aliases deprecated in 1.5.0 are **still emitted at 1.21.0**.
`buildPaletteCss({ legacyAliases: false })` / `tokens:css --no-legacy-aliases` opts out now; a later
minor flips the default.

## Not verified

- Props declared inline on a component (`function X({ a }: { a: string })`) rather than on an
  exported type are outside the diff method used here. Spot checks on the shell and charts modules
  found none, but the negative is unproven.
- The 0.4.2 `./css` line counts in the 1.0.0 table (877 lines / 307 custom props / 19 utilities) come
  from the removal commit, not from a re-read of the 0.4.2 tarball.

`AppBreadcrumbs.parentAnchor` was listed here through 1.20.0 and is now verified: it is declared on
the shipped `dist/shell/app-breadcrumbs.d.ts` (`parentAnchor?: NavAnchor`, with `parentHref` as the
no-router fallback). The type is inline on the component rather than an exported `AppBreadcrumbsProps`,
which is why the export-surface diff never saw it.
