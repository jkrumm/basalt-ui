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

| #   | Decision                | Accepted value                                                                | Token and source                                                                                                                                                                                                                   | Alternative if rejected                                      |
| --- | ----------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 5a  | Accent                  | `#2e75b1`, vibrancy +1 step (config `0`, the shipped centre)                  | `--vx-brand-fill` / `--vx-brand`, seeded by `DEFAULT_DERIVE_V3_CONFIG.accent` in `derive.ts`                                                                                                                                       | A steel `#4374a6` or C `#0076bf`                             |
| 5b  | Primary, checked        | Ink-inverted: action is ink, blue is data                                     | `--color-primary` and `--color-primary-foreground` alias `ink` and `canvas` (`COLOR_ALIASES` in `table.ts`)                                                                                                                        | Blue, legal only on canvas and inset (2.76:1 on a dark card) |
| 5c  | Dark card, inset, radii | T19 dark card, flush inset, radii 14/10/8/5                                   | `--vx-card` via `SURFACE_TONE_V3.dark.card = 19` (`derive.ts`); `--vx-radius-card` 14px, `--vx-radius-inset` 10px, `--vx-radius-ctrl` 8px, `--vx-radius-chip` 5px (`table.ts`)                                                     | T18.5 with fill `#357ab6`, a 4 px gutter, or other radii     |
| 5d  | Delta, desktop input    | Tinted delta badge; 13 px desktop input, 16 px on the coarse pointer only     | `--vx-tint-pct` (12% light, 16% dark) feeding the `--color-*-tint` roles that `DeltaBadge` paints (`ui/badge.tsx`); `--vx-text-sm` 0.8125rem (text scale in `table.ts`); coarse floor `pointer-coarse:text-base` in `ui/input.tsx` | Text-only delta; 16 px everywhere                            |
| 5e  | Fonts, radius knob      | Nunito Sans body, Hubot Sans headings, JetBrains Mono carried; no radius knob | `--vx-font-sans`, `--vx-font-head`, `--vx-font-mono` (`table.ts`); the four radius rows above                                                                                                                                      | A crisper grotesque; additive `tokens:css --radius`          |

## Owner review
