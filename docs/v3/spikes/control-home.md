# Spike: control-home residue after a shutterflow and argo port (S3)

S3 is refuted. Mapped to v3 names, 30 of argo's 38 controls and 26 of shutterflow's 31 residue controls keep their value in `useState` or plain props, so they would need a `control-home` waiver: far above the ceiling of 5. The rule is not the problem; the homes are: the 2.x code has no wrapper where the rule wants one.

Harness: `bun tools/spikes/control-home/run.ts` (one JSON object on stdout, exit 0 means the harness ran, not that the hypothesis held). Concept: `docs/v3/concepts/guardrails.md` section 13 S3 and `docs/v3/concepts/controls-url-state.md` section 9, both frozen. This spike records and fixes nothing in the contract.

## Question

After a shutterflow and an argo port, how many control primitives sit outside every home that the file-local `control-home` predicate accepts, and how many of those have no handle or form field to put in a home? Refuted if either app has more than 5 waivers: the homes are redesigned, not the rule.

## Method

**Predicate** (controls-url-state section 9, file-local). A JSX use of `select`, `combobox`, `segmented`, `number-field`, `slider`, `switch`, `checkbox` or `radio-group` is residue when no lexical ancestor in its file is `FormField`, `FilterSet`, `ViewTabs`, `ControlHome`, a `filterSlot.custom` render, or a component whose first parameter takes a `field`, `store`, `handle` or `fields` prop. `scan.ts` finds this with the TypeScript AST (6.0.3) and resolves a tag to a control only when it is imported from `@mantine/*` or `basalt-ui*`, so a local `Select` is not counted. A `filterSlot.custom` render whose control keeps its value in `useState` is flagged (fixture 2), as the concept says.

**The port is a name map, not a rewrite.** No file is ported. `home-map.json` maps the 2.x names to the v3 ones: `Select`, `MultiSelect`, `SegmentedControl`, `NumberInput`, `Slider`, `RangeSlider`, `Switch`, `Checkbox`, `Radio.Group` to the primitive names; the ancestors `FilterSet`, `SelectFilter`, `MultiSelectFilter`, `RangeFilter`, `NumberFilter` to `FilterSet`; `ViewTabs`; `FormRow`, `FormGroup`, `FormSection`, `SettingsRow` to `FormField`. No 2.x name maps to `ControlHome`: it is wrapper-only and new code, so an unported app has none.

**Judging a residue site.** `fits a home` iff its value already lives in a handle or form field; `waiver` iff it is `useState` or plain props. The scan reads the `value`, `checked` and `defaultValue` props and `{...spread}` attributes and follows each identifier to its declaration (one derivation hop): `getInputProps`/`inputProps(form, key)` is a form field; `store.use()`, `useXStore()`, a selector hook such as `usePhotos((s) => s.scope)` or a `.field.` access is a handle; `useState`, `useReducer`, `useRef` is state; a function parameter is props; no value prop at all is `none` (a waiver). Heuristic: a store hook it does not recognise reads as `none`, so waivers are an upper bound by a handful of sites, not by an order of magnitude (see Verdict).

**Homes by hand.** `homes.json` assigns each waiver's component to the v3 home it would take (`form-row`, `side-panel`, `aside`, `overlay`, `tool`). That is a judgment, shown in the table, and it does not enter the verdict.

**Scratch copies.** argo `apps/dashboard/src` (public) and shutterflow `apps/desktop/src` and `apps/gallery/src` (private) are copied with `rsync` into the OS temp dir, tests excluded, and deleted at the end; nothing is written to either repo. Shutterflow is reported as counts and hashed ids (`sha256` of `file:line`, 8 hex), with no path or component name.

**Fixtures** (`fixtures/*.fixture.txt`). Three go through the scan: body children, a `filterSlot.custom` closure with `useState`, a handle-bound composite. The fourth, a global spec in a card slot, is compiled with `tsc` (the API, `getPreEmitDiagnostics`) against `packages/basalt-ui/src` and must fail on its marked line only.

**Proof.** `results/run-1.json` and `results/run-2.json` are two runs; they are byte-identical.

## Measurements

From `bun tools/spikes/control-home/run.ts` (the key is in brackets).

| Number                   | argo                    | shutterflow                     |
| ------------------------ | ----------------------- | ------------------------------- |
| Files scanned [`files`]  | 167                     | 145                             |
| Controls [`controls`]    | 38                      | 48                              |
| In a home [`inHome`]     | 0                       | 17                              |
| Residue [`residue`]      | 38                      | 31                              |
| Fits a home [`fitsHome`] | 8 (6 handle, 2 form)    | 5 (3 handle, 2 form)            |
| Waivers [`waivers`]      | 30 (22 props, 8 state)  | 26 (14 props, 10 state, 2 none) |
| Files with a waiver      | 11                      | 15                              |
| Components with a waiver | 15 [`waiverComponents`] | 17 [`waiverComponents`]         |

Fixtures [`fixtures`]:

| Fixture                             | Outcome                        |
| ----------------------------------- | ------------------------------ |
| Body children [`bodyChildren`]      | flagged                        |
| `filterSlot.custom` with `useState` | flagged                        |
| Handle-bound composite              | clean                          |
| Global spec in a card slot          | `type-error` (TS2322, line 23) |

**Waivers by the home they would take** (hand assignment, `homes.json`).

| Home       | argo (file: lines)                                                                                                                                                                                                                         | n   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- |
| form-row   | `finance/components/bulk-modal.tsx`: 81; `strength-tracker/components/edit-workout-modal.tsx`: 94; `strength-tracker/components/gym-settings-modal.tsx`: 221, 330, 339, 402, 466, 475; `strength-tracker/components/workout-form.tsx`: 520 | 9   |
| overlay    | `body-composition/components/goal-popover.tsx`: 43; `strength-tracker/components/weight-popover.tsx`: 285, 338, 345                                                                                                                        | 4   |
| side-panel | `astro-window/components/map-settings-panel.tsx`: 194, 225, 268, 303, 311, 335, 341, 347, 392, 453, 509, 550                                                                                                                               | 12  |
| tool       | `astro-window/charts/sky-panorama.tsx`: 535; `astro-window/components/site-map.tsx`: 1004; `finance/components/pickers.tsx`: 26, 57; `strength-tracker/components/timer-card.tsx`: 219                                                     | 5   |

(argo paths are under `apps/dashboard/src/features/`.)

| Home       | shutterflow (hashed site ids)                                                                                                                              | n   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| aside      | `00ac3fe3`, `2a58ee0d`, `67de6b34`, `6ad7a7fe`, `81111da7`, `fc568655`                                                                                     | 6   |
| form-row   | `08496d74`, `40ffdcf0`, `4677a34e`, `57bb62d3`, `7ec60750`, `8628b67f`, `876de97f`, `aa5f8a0c`, `c593cb86`, `e5e8a696`, `eaea3854`, `eece72e0`, `f341d0e0` | 13  |
| overlay    | `bb2ebf4b`                                                                                                                                                 | 1   |
| side-panel | `0a789a2b`, `33cf6a21`, `4725ac22`, `cddeb222`                                                                                                             | 4   |
| tool       | `52e1e7cf`, `f3c8694d`                                                                                                                                     | 2   |

**Reading the numbers.**

- The 17 shutterflow controls already in a home sit under 2.x `FormRow`/`FormGroup`/`FilterSet`; argo has none because it hand-places Mantine controls in modals, popovers and a map panel.
- The residue is not mostly forms. `form-row` is 9 of argo's 30 and 13 of shutterflow's 26; panel, aside, overlay and tool controls are the other 21 and 13. Porting every form to `useFormDraft` would still leave both apps above 5.
- The waivers cluster: 15 components in argo and 17 in shutterflow hold all of them (one component, `MapLayerSections`, holds 9). A wrapper per component, not per control, is the cost of a redesign.
- shutterflow's own lint carries 6 `oxlint-disable` today; the scan finds 26 sites because it counts every control, not every disabled block. The two do not compare one to one. They agree on the direction, and the concept's open reading (do `ControlHome` wrappers retire the 6?) is answered below.

## Verdict

S3: REFUTED

Verdict: REFUTED

By the rule: argo has 30 waivers and shutterflow 26, against a ceiling of 5 per app. The heuristic overstates waivers by the `none` cases (2 in shutterflow, 0 in argo) and by any store hook it misreads as state; to fall to 5, 25 of argo's 30 would have to be misjudged. The refutation stands without it.

What the predicate does not see is the cause: a `ControlHome` wrapper is a lexical home, so wrapping the 15 argo and 17 shutterflow components in `<ControlHome home=…>` clears every site without a waiver. But the wrapper hosts controls whose value is `useState`, so it moves the ownerless value, not the problem. The ceiling counts waivers; this port needs 32 wrappers of new code that the codemod cannot write (no 2.x name maps to `ControlHome`, and the home choice per component is a judgment).

## Then

- Redesign the homes before ctl-8 writes the rule. Two options, the orchestrator's call: (a) make `ControlHome` carry panel-local state itself, `<ControlHome home="side-panel" state={…}>`, so a `useState` value is a home's, not a waiver; (b) accept the wrapper as the migration step and have the codemod insert `ControlHome` per component by file role (modal/dialog to `form-row` or `overlay`, `*Panel`/`*Sidebar` to `side-panel`/`aside`, the rest `tool`), with a count in `lint --stats`. (b) matches the concept's "wrapper-only" text; (a) changes `ControlHomeProps`, which is frozen.
- Re-run with the rule shaped to the chosen home: `bun tools/spikes/control-home/run.ts`; the verdict flips to PASS when both apps are at 5 or fewer. The scan's `fixtures` are the specification for ctl-8's `RuleTester` cases.
- Do not weaken the rule. `control-home` stays not file-waivable; the 22-file wholesale exemption in shutterflow is the failure mode it exists to prevent.

## Affects

- `docs/v3/concepts/guardrails.md` section 13 (S3 refuted) and section 8 (waiver counts); the `app` profile rows that say shutterflow homes are "U until S3": the orchestrator's.
- `docs/v3/concepts/controls-url-state.md` section 9 (predicate, ceiling) and section 5 (`ControlHomeProps`, if option (a)): the orchestrator's.
- ctl-8 (`src/lint`): blocked on the home decision; the fixtures in `tools/spikes/control-home/fixtures/` carry over.
- The shutterflow and argo ports: the 32 wrappers are a cost line of the migration, not an edge of the contract.
