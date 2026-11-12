# Review: StatCard and the dense table

Owner's eye on the rendered exemplar, [tokens-visual S1](../concepts/tokens-visual.md#8-proof). Non-blocking: the section 8 defaults for DPO 5a-5e were taken on 2026-11-09 ([DIRECTION section 8](../DIRECTION.md)), nothing waits on this page, and any change is a token-table edit in a follow-up Issue.

The subjects are the two playground exemplar routes: `/cards` (`apps/playground/src/routes/cards.tsx`, the StatCard and its states) and `/table` (`apps/playground/src/routes/table.tsx`, the dense table). Both render from playground fixtures.

## Shots

Four shot sets, two routes each: light and dark, at 1800x1200 (desktop) and 390x844 (phone). The eight files land in `.evidence/v3-shots/`, which is gitignored; reproduce them with:

```sh
bun --filter basalt-ui build   # once on a fresh checkout: the playground resolves basalt-ui/vite from dist
bun --filter @basalt-ui/playground build && bun apps/playground/scripts/shots.ts /cards /table
```

| Set | Scheme | Viewport  | `/cards`                      | `/table`                      |
| --- | ------ | --------- | ----------------------------- | ----------------------------- |
| 1   | light  | 1800x1200 | `cards--light--1800x1200.png` | `table--light--1800x1200.png` |
| 2   | light  | 390x844   | `cards--light--390x844.png`   | `table--light--390x844.png`   |
| 3   | dark   | 1800x1200 | `cards--dark--1800x1200.png`  | `table--dark--1800x1200.png`  |
| 4   | dark   | 390x844   | `cards--dark--390x844.png`    | `table--dark--390x844.png`    |

## Defaults

The accepted value per decision and where it lives. To change one, edit the named token in `packages/basalt-ui/src/tokens/`; `tokens.css` and the Tailwind bridge regenerate from it.

| #   | Decision                | Accepted value                                                                                                                                                                                              | Token and source                                                                                                                                                                                                                                                                                                                                                | Alternative if rejected                                      |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 5a  | Accent                  | **Overridden by owner review 2026-11-11:** the 2.x seed `#0077bd` at the 2.x vibrancy (fill `#4374a6`, the 2.x accent fill)                                                                                 | `--vx-brand-fill` / `--vx-brand`, from `deriveTokens` at `DEFAULT_DERIVE_CONFIG` via `DEFAULT_DERIVE_V3_CONFIG` in `derive.ts`                                                                                                                                                                                                                                  | Was B `#2e75b1`, vibrancy +1                                 |
| 5b  | Primary, checked        | Ink-inverted: action is ink, blue is data                                                                                                                                                                   | `--color-primary` and `--color-primary-foreground` alias `ink` and `canvas` (`COLOR_ALIASES` in `table.ts`)                                                                                                                                                                                                                                                     | Blue, legal only on canvas and inset (2.61:1 on a dark card) |
| 5c  | Dark card, inset, radii | **Neutral overridden by owner review 2026-11-11:** zinc, the 2.x surface stops (dark card = 2.x `subtle`, T20.9); **flush overridden 2026-11-11:** a 4 px gutter around a concentric inset, radii 14/10/8/5 | `--vx-canvas`/`inset`/`card`/`raised` = 2.x `bg`/`field`/`subtle`/`elevated` (`SURFACE_FROM_2X` in `derive.ts`), the light card the 2.x `panel` since Issue 863 (1.07:1 on the canvas, as the console); warmth is the opt-in `neutral: 'stone'`; `--vx-radius-card` 14px, `--vx-radius-inset` 10px, `--vx-radius-ctrl` 8px, `--vx-radius-chip` 5px (`table.ts`) | Was the warm ramp at hue 70, T19 dark card                   |
| 5d  | Delta, desktop input    | Tinted delta badge; 13 px desktop input, 16 px on the coarse pointer only                                                                                                                                   | `--vx-tint-pct` (12% light, 16% dark) feeding the `--color-*-tint` roles that `DeltaBadge` paints (`ui/badge.tsx`); `--vx-text-sm` 0.8125rem (text scale in `table.ts`); coarse floor `pointer-coarse:text-base` in `ui/input.tsx`                                                                                                                              | Text-only delta; 16 px everywhere                            |
| 5e  | Fonts, radius knob      | Nunito Sans body, Hubot Sans headings, JetBrains Mono carried; no radius knob                                                                                                                               | `--vx-font-sans`, `--vx-font-head`, `--vx-font-mono` (`table.ts`); the four radius rows above                                                                                                                                                                                                                                                                   | A crisper grotesque; additive `tokens:css --radius`          |

## Owner review

2026-11-11, on the `/cards` shot: "very weird card implementations ... you checked with how factory console has those cards now?" The verdict is the factory console's `StatCard` anatomy (`software-factory/apps/console/src/components/kit/stat-card.tsx`), with the four cards at the top of `docs/v3/inspo/herdr-paste-1794228224613846000.png` as the target. Issue 819 re-cut the card to it; the contract (`src/cards/contract.ts`) did not change.

| Finding                                                          | Now                                                                                                                                                                                                                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three full-width stripes (tinted band, flush inset, tinted band) | One shell. Header and footer sit on it; the inset is one surface step down inside a 4 px gutter, its radius concentric (`--card-gutter` = `radius-card` 14 minus `radius-inset` 10). DPO 5c: the gutter replaces flush |
| Delta text barely visible in light                               | A 24 px pill (`rounded-full`), tone ink on the tone tint, a bold up-right, down-right or minus arrow. Measured 4.58 to 7.91:1 in both schemes (`ui/badge.contrast.test.ts`)                                            |
| Chunky grey bars, no axis labels                                 | The fixture draws thin bars, the latest in the accent fill, over a start, middle, now label row in the 16 px the chart box reserves                                                                                    |
| Small footer labels and values                                   | Muted label, semibold `text-md` value, the pair spread across the width                                                                                                                                                |
| No menu button; a handset icon for Shipped                       | A 32 px icon tile, a semibold `text-md` title and the menu button on the right; the fixture passes `menu` and a merge icon                                                                                             |
| Loading skeleton is one grey block                               | The skeleton draws the figure and pill, the sub line, the plot and its label row, at the ready rows' heights                                                                                                           |

The light pill was faint for a second reason, outside the card: the playground still mounts the 2.x provider, whose runtime `:root` style renders after `tokens.css` and redefines shared names (`--vx-good` as an 18 % tint, `--vx-radius-card` as 10px). `/cards` now re-asserts the v3 sheet while it is mounted (`apps/playground/src/demo/v3-tokens.ts`); a v3 app with one token sheet never meets this.
