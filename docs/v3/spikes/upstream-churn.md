# Spike: upstream churn (F8)

F8 passes on the rule as filed: the median primitive changes its API or anatomy 0.6 times a month in Base UI and 0.1 in base-nova, both under 1.0. The Base UI figure is bounded by one release a month, so only the base-nova series is independent evidence; the Base UI series shows a spread (combobox 0.9, meter 0.2) that prim-p8 should size to.

Harness: `bun tools/spikes/upstream-churn/run.ts [--months 10] [--as-of YYYY-MM-DD] [--offline]` (one JSON object on stdout, always exit 0). Contract: `docs/v3/ARCHITECTURE.md` section 11 F8, frozen. Run on 2026-11-10; both outputs are in `tools/spikes/upstream-churn/proof/` and are byte-identical.

## Question

Does an ejected primitive carry a merge cost? Only if upstream changes its API or anatomy more often than monthly. The 2 and 12 days of console and epos history are not evidence; upstream history is. Refuted if the median over primitives of `changePerMonth` exceeds 1.0 in either series, which raises merge support.

## Method

**Window.** 10 complete calendar months, 2026-01 to 2026-10 (`monthsCovered` 10, the rule asks for 6 or more). The run date is 2026-11-10, so the last complete month is October. Base UI has been stable since v1.0.0 (2025-12-11), so a January start gives the first release a stable baseline and leaves out the prerelease tags.

**Upstream sources.** Cloned into the OS temp dir (`basalt-upstream-churn`), found through `/research` and checked against the clones.

| Series   | Repo                                                                                             | Unit                                                                                                                                 | Range                                                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| baseUi   | `https://github.com/mui/base-ui`, parts at `packages/react/src/<part>/`                          | A stable release `vX.Y.Z` whose diff against the previous stable tag touches the part directory, test, docs and story files excluded | `v1.0.0` (`8319606c`, baseline) to `v1.9.0` (`ad7ecda5`); the 10 releases in the window are v1.1.0 (2026-01-15), v1.2.0, v1.3.0, v1.4.0, v1.4.1, v1.5.0, v1.6.0, v1.7.0 (2026-08-04), v1.8.0, v1.9.0 (2026-10-09) |
| baseNova | `https://github.com/shadcn-ui/ui`, authored files at `apps/v4/registry/bases/base/ui/<name>.tsx` | A non-merge commit on `main` that touches the primitive's file                                                                       | `ccafdaf7` (last commit before 2026-01-01) to `c0d63c33` (last commit before 2026-11-01)                                                                                                                          |

base-nova has no source file of its own: the preset is `bases/base` plus `registry/styles/style-nova.css` (`apps/v4/registry/config.ts`), and the installed `registry/base-nova/ui/<name>.tsx` is generated. The unit is therefore the authored file. The 32 commits in the window that touch `style-nova.css` change what users receive but are cosmetic by definition and sit outside the per-primitive count.

**Primitives.** The 36 modules of `docs/v3/concepts/primitives-distribution.md` section 4, mapped through its `Base UI part` column to part directories (25 modules have one; `textarea` reuses `input` through `render` and has none of its own) and by name to shadcn files (30 modules have one). A module with several sources (`dialog` = `dialog` and `alert-dialog`) counts a release or commit once when any source changed. The mapping is the `MODULES` table in `run.ts`.

**Classification.** Both by syntax tree, no model in the loop.

- baseUi, API or anatomy: the part's public declarations (exported types, interfaces, functions and constants from the documented files; hooks, contexts, stores and utils excluded; `| undefined` ignored), its JSX and `useRenderElement` tags, its `data-`, `aria-` and `role` keys, or its CSS-variable names differ between the two tags. Otherwise cosmetic, which for an unstyled library means implementation only.
- baseNova, cosmetic: the file differs from its parent only in class strings (arguments of `cn`, `cva`, `clsx`, `className` values), comments, formatting or directives. Anything else is API or anatomy, including logic.

`changePerMonth` = `anatomyChangeCount` / `monthsCovered`. `medianChangesPerMonth` is the median of that over the primitives with a source in the series (25 and 30). `medianAllChangesPerMonth` does the same for `changeCount`.

**Limits, so the numbers are read as what they are.**

- The API bucket is an upper bound on merge work. It counts additive members (Base UI v1.5.0 added `hidden` to `AccordionItemState` and `transitionStatus` to `CollapsibleRootState`), which a wrapper that spreads its props absorbs without an edit.
- Base UI cannot exceed 1.0 on this unit: 10 releases in 10 months (`releasesPerMonth` 1) cap every primitive at 1.0. The median of 0.6 is a share of releases (6 of 10), not a rate above the bar.
- The classifier was checked by hand on v1.5.0 against its release notes: 8 of the 10 flagged parts are named in the notes, the other two (accordion, collapsible) are the additive state members above, and Checkbox, Field and Number Field, named in the notes for bug fixes, came out cosmetic.
- Release dates are tag dates, not npm publish dates. Commit dates are committer dates. Merge commits are excluded. The base-nova `toast` file was created in the window (`6cd3f4c6`, 2026-07-23); the creation is reported, not counted.
- Three commits move 10 or more base-nova files at once (`66d24007` icon swap, `f31ed819` format pass, `c257f688` migration to `cn-*` classes, 29 files). `excludingBulk` in the JSON drops them.

## Measurements

`changeCount / anatomyChangeCount / changePerMonth` per primitive, 10 months. `n/a` = no source in that series.

| Primitive    | baseUi       | baseNova    |
| ------------ | ------------ | ----------- |
| accordion    | 10 / 4 / 0.4 | 5 / 2 / 0.2 |
| alert        | n/a          | 4 / 1 / 0.1 |
| badge        | n/a          | 4 / 2 / 0.2 |
| button       | 7 / 2 / 0.2  | 4 / 1 / 0.1 |
| card         | n/a          | 2 / 1 / 0.1 |
| checkbox     | 10 / 5 / 0.5 | 2 / 2 / 0.2 |
| collapsible  | 10 / 4 / 0.4 | 0 / 0 / 0   |
| combobox     | 10 / 9 / 0.9 | 5 / 2 / 0.2 |
| date-picker  | n/a          | 8 / 4 / 0.4 |
| dialog       | 10 / 8 / 0.8 | 3 / 2 / 0.2 |
| field        | 10 / 6 / 0.6 | 4 / 1 / 0.1 |
| input        | 6 / 3 / 0.3  | 2 / 1 / 0.1 |
| kbd          | n/a          | 1 / 1 / 0.1 |
| menu         | 10 / 8 / 0.8 | 8 / 3 / 0.3 |
| meter        | 9 / 2 / 0.2  | n/a         |
| number-field | 10 / 7 / 0.7 | n/a         |
| popover      | 10 / 7 / 0.7 | 4 / 1 / 0.1 |
| progress     | 8 / 4 / 0.4  | 1 / 1 / 0.1 |
| radio-group  | 10 / 7 / 0.7 | 3 / 3 / 0.3 |
| scroll-area  | 10 / 6 / 0.6 | 2 / 1 / 0.1 |
| segmented    | 9 / 4 / 0.4  | 4 / 2 / 0.2 |
| select       | 10 / 8 / 0.8 | 6 / 4 / 0.4 |
| separator    | 6 / 3 / 0.3  | 3 / 1 / 0.1 |
| sheet        | 9 / 7 / 0.7  | 6 / 3 / 0.3 |
| skeleton     | n/a          | 3 / 3 / 0.3 |
| slider       | 10 / 8 / 0.8 | 3 / 3 / 0.3 |
| switch       | 10 / 5 / 0.5 | 1 / 1 / 0.1 |
| table        | n/a          | 2 / 1 / 0.1 |
| tabs         | 10 / 7 / 0.7 | 4 / 1 / 0.1 |
| textarea     | n/a          | 2 / 1 / 0.1 |
| toast        | 10 / 7 / 0.7 | 1 / 1 / 0.1 |
| toolbar      | 10 / 5 / 0.5 | n/a         |
| tooltip      | 10 / 8 / 0.8 | 4 / 2 / 0.2 |

| Series                         | Primitives | `medianChangesPerMonth` | `medianAllChangesPerMonth` | Max `changePerMonth`      |
| ------------------------------ | ---------- | ----------------------- | -------------------------- | ------------------------- |
| baseUi                         | 25         | 0.6                     | 1.0                        | 0.9 (combobox)            |
| baseNova                       | 30         | 0.1                     | 0.3                        | 0.4 (select, date-picker) |
| baseNova, bulk commits dropped | 30         | 0.0                     | 0.15                       | 0.2                       |

Base UI releases by number of the 25 primitives with an API or anatomy change: v1.1.0 13, v1.2.0 21, v1.3.0 24 (the `Foo.State` namespace types became flat `FooState` names), v1.4.0 13, v1.4.1 1, v1.5.0 10, v1.6.0 12, v1.7.0 15, v1.8.0 11, v1.9.0 24. base-nova: 101 primitive-file changes in 10 months across 30 files, 13 distinct API or anatomy commits besides the bulk ones.

## Verdict

F8: PASS

Verdict: F8: PASS

By the rule: 0.6 and 0.1 are both under 1.0. The rule is weak on the Base UI side (one release a month caps it at 1.0), so the pass there is structural. What the numbers support is narrower than "no merge cost": base-nova source moves about once in 10 months per primitive and cosmetic work lives in `style-nova.css`, while a typical Base UI primitive changes its surface in 6 of 10 releases and the heavy ones (combobox, dialog, select, menu, tooltip, slider) in 8 or 9.

## Then

`prim-p8` reads the JSON. This spike names the consequences and builds nothing.

- Do not raise merge support on this evidence. Eject keeps the plan of section 6 as written.
- Size the sync matrix to Base UI minors, not to base-nova. Ejected files wrap Base UI parts, and those parts move on its monthly cadence; ceilings per primitive come from the baseUi column, not from the 0.1 median.
- Treat the twelve primitives at 0.7 or higher in the baseUi column (combobox, dialog, select, menu, tooltip, slider, number-field, radio-group, popover, sheet, tabs, toast) as the ones where an ejected copy is likely to be a minor behind; the rest rarely are.
- Do not read the Base UI median as a rate. If prim-p8 needs one, rerun the harness at commit level instead of release level; that is a different unit and a new spike.

## Affects

- `docs/v3/ARCHITECTURE.md` section 11, row F8: resolved by this spike. Frozen here; the owner of the row records the outcome.
- `docs/v3/concepts/primitives-distribution.md` section 6 (sync) and `prim-p8-sync-matrix`, which consume `proof/run-1.json` and the per-primitive rates.
- No change to ceilings, section 4 or the primitive count.
