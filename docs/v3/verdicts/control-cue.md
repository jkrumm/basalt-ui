# Review: the override cue in ControlView

Owner's eye on the one taste call of the controls concept, [controls-url-state section 1 item 7 and 4.3](../concepts/controls-url-state.md). Non-blocking: nothing waits on this page, and any change is a label or one-component edit in a follow-up Issue.

The subject is `ControlView` (`packages/basalt-ui/src/controls/control-view.tsx`, [v3-ctl-4](../issues/g1/v3-ctl-4-control-view.json)) as drawn by the three homes of `ControlHome` (`control-home.tsx`, [v3-ctl-4b](../issues/g1/v3-ctl-4b-control-home.json)). Both render from layout-test fixtures, not from the playground: no playground route mounts `ControlView` yet.

## States

A card control is in exactly one state, read from `handle.useSource()`. The cue is produced by `ControlView` alone, so a page author cannot omit it.

| State       | Meaning                                                | Cue                                                                                                   |
| ----------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `own`       | A page or global control; there is nothing to inherit  | None                                                                                                  |
| `inherited` | A widget control following its global                  | None; it shows the effective value                                                                    |
| `override`  | A widget control whose `w.<id>.<field>` URL key is set | Neutral `Local` chip, title `Overrides global: <global value>`, and a reset. Text, never colour alone |

How the cue differs by home presentation (the presentation comes from the home, there is no `variant` prop):

| Home presentation | Where it is used                           | Label        | Cue                                                                     | Reset                                                  |
| ----------------- | ------------------------------------------ | ------------ | ----------------------------------------------------------------------- | ------------------------------------------------------ |
| `pill`            | page-bar, view-mode, tool, sheet pill form | Beside input | `Local` chip after the input                                            | Icon button, accessible name `Reset <label> to global` |
| `row`             | row homes, folded pills, `Filters (n)`     | Above input  | `Local` chip beside the label, plus the note line `Overrides global: x` | Text button `Use global`                               |
| `inline`          | card-header                                | None         | `Local` chip after the input                                            | Icon button, accessible name `Reset <label> to global` |

## How to view

Nothing needs a dev server. The two layout suites render every state in real Chrome; each writes its shots into a directory you name, which is outside the tree (and `.evidence/` is gitignored).

```sh
cd packages/basalt-ui
CONTROLS_VIEW_SHOTS=/tmp/cue-shots bun test tests/layout/controls-view.layout.test.ts
CONTROLS_HOME_SHOTS=/tmp/cue-shots bun test tests/layout/controls-home.layout.test.ts
```

| Shot file                         | Viewport  | Scheme |
| --------------------------------- | --------- | ------ |
| `controls-view-desktop-light.png` | 1800x1200 | light  |
| `controls-view-desktop-dark.png`  | 1800x1200 | dark   |
| `controls-view-phone-light.png`   | 390x844   | light  |
| `controls-view-phone-dark.png`    | 390x844   | dark   |
| `controls-home-desktop-light.png` | 1800x1200 | light  |
| `controls-home-desktop-dark.png`  | 1800x1200 | dark   |
| `controls-home-phone-light.png`   | 390x844   | light  |
| `controls-home-phone-dark.png`    | 390x844   | dark   |

Where each state sits in the shots (fixtures `tests/layout/fixture/controls-view-fixture.tsx` and `controls-home-fixture.tsx`):

| State     | `controls-view` probe                                       | `controls-home` probe                                       |
| --------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| own       | `cv-kinds-pill`, `-row`, `-inline`                          | `ch-<home>-8` (eight filters in each home)                  |
| inherited | `cv-pill-bound`, `cv-row-bound`, `cv-inline-bound`          | `ch-pill-bound`, `ch-row-bound`, `ch-inline-bound`          |
| override  | `cv-pill-override`, `cv-row-override`, `cv-inline-override` | `ch-pill-override`, `ch-row-override`, `ch-inline-override` |

## Evidence

From the two layout suites; `make check` runs both.

| Claim                                                                                                            | Where it is asserted                                                                             | Asserted                                               |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| The cue is text: chip reads `Local`, title `Overrides global: Last 24 hours`, reset name `Reset Range to global` | `controls-view.layout.test.ts` and `controls-home.layout.test.ts`, per presentation and viewport | At 1440, 768, 390 and 320                              |
| Reset restores the global and removes the cue                                                                    | Same suites                                                                                      | After reset: no badge, no reset, value `Last 24 hours` |
| A bound (inherited) control and an own control show no cue                                                       | Same suites, `override-badge` and `override-reset` counts                                        | 0 and 0                                                |
| No horizontal overflow, with 8 filters and with 0                                                                | Both suites                                                                                      | At 1440, 768, 390 and 320                              |
| 44 px hit floor on a coarse pointer                                                                              | Both suites                                                                                      | On 20+ elements in view, 40+ in home                   |
| axe: zero serious or critical                                                                                    | Both suites, light and dark, plus a pill popover open in home                                    | Zero violations                                        |

These are the assertions as they stand in the tests, not a run made for this page; re-run the commands above to see them live.

## Open questions

Each default is what ships today. Every flip is an edit to one file, in a follow-up Issue; none touches the URL contract or the reset behaviour.

| #   | Question               | Default                                                                                        | If you pick the alternative                                                                                                                                                           | Single file that changes                                                                                                             |
| --- | ---------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Label text of the chip | `Local`, neutral lozenge, with the title `Overrides global: <value>`                           | `Overridden`, `Custom` or `This card`: a string edit. A longer word widens the chip in the `inline` card-header, where width is scarcest                                              | `packages/basalt-ui/src/core/messages/controls.ts` (`controls.local`; `home.ts` repeats the key as `home.local` and is kept in step) |
| 2   | Reset wording          | `Use global` as text on a row; icon with the name `Reset <label> to global` on pill and inline | `Reset` or `Back to global`: a string edit. Making the icon a text button on pill and inline costs about the chip's width again on a phone, so the layout cases would need a re-check | `packages/basalt-ui/src/core/messages/controls.ts` (`controls.useGlobal`, `controls.resetToGlobal`)                                  |
| 3   | Cue placement          | After the input in pill and inline; beside the label, with a note line, in row                 | Chip before the input in every presentation: a markup move, no new state. Keeps the cue first in reading order, but pushes the input right in the narrow inline home                  | `packages/basalt-ui/src/controls/control-view.tsx` (the `badge` element's position)                                                  |

## Verdict
