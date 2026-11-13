# Fleet token census (tokens-visual section 8)

Run 2026-11-13 on the mini against each repo's checked-out HEAD. Reproduce with `sh /path/to/run.sh` below, then group by token. Nothing in a consumer is modified.

```sh
# one line per read: <repo>\t<file>:<token>
cd ~/SourceRoot
for r in argo shutterflow rb linewatch weatherorb rollhook basalt-ui-obsidian; do
  (cd $r
   # generated sheets are skipped: a css file whose first line is "@generated basalt-ui"
   rg --no-messages -g '*.css' -g '!**/node_modules/**' -l '^/\* @generated basalt-ui' . | sort > /tmp/gen.$r
   rg --no-heading -l -g '*.{ts,tsx,astro,css,html,svg,webmanifest}' \
     -g '!**/node_modules/**' -g '!**/dist/**' -g '!docs/**' -g '!.claude/**' -g '!**/worktrees/**' -g '!target/**' \
     'VX\.[A-Za-z0-9_]+|--vx-[A-Za-z0-9-]+' . | sort | comm -23 - /tmp/gen.$r \
   | xargs rg --no-heading --with-filename -o 'VX(\.[A-Za-z0-9_]+)+|--vx-[A-Za-z0-9-]+' | sed "s/^/$r\t/")
done
```

`obsidian` is `~/SourceRoot/basalt-ui-obsidian`. Markdown is not scanned, so `AGENTS.md` and `DESIGN.md` mentions do not count. The generated sheets skipped are the `tokens:css` outputs: rollhook `apps/{dashboard,marketing}/src/styles/basalt-tokens.css`, weatherorb `apps/web/src/landing/{tokens,fonts}.css`, argo `docs/design/usage-v7/tokens.css`.

## Totals

- **1416 reads**, **156 distinct spellings** (`VX.x.y` and `--vx-x` counted apart), **119 distinct names** once a TS read and its CSS twin are one name. By repo: argo 669, shutterflow 188, rb 48, linewatch 136, weatherorb 208, rollhook 51, basalt-ui-obsidian 116.
- Dispositions (spellings): row 91, kept 23, manual 25, app-owned 17.
- **Gap to the section 8 figures (135 names, 1,297 reads, scanned 2026-11-09):** this scan finds 119 names and 1416 reads: about 15 fewer names and 119 more reads. The 11-09 script was scratch (/tmp/census/c.mjs) and was not kept, so the difference is not reproduced line by line. Known causes: it counts every spelling of a read, including a comment that names a token and the var(--vx-x, fallback) form; template prefixes (--vx-space-) and the app groups are counted as names here (17 app groups and 4 template prefixes among the 119); weatherorb moved after 11-09 (292d08aa, 11-12). What the gap does not touch: every name found is dispositioned below, and areas/tokens.json covers all 223 names of BASALT_VX_NAMES at v2.29.0, not only the ones the fleet reads.

## Disposition

Every name is one of: `row` (a row of `areas/tokens.json` has it as `from`: a rename, merge, replace, codemod or removal), `manual` (a row with `kind: manual`, a per-use decision; the four `--vx-<family>-` template prefixes are manual rows too), `kept` (a row with `kind: kept`: the name survives, its value shift is in `tokens.valueShifts`, and the row exists so `migrate` lists the read) or `app-owned` (an app group declared in `src/basalt.tokens.ts`, tokens-visual 3.8: not a package name, so no row). Coverage is checked mechanically by `packages/basalt-ui/scripts/release-migrating-tokens.test.ts`.

| Name as read                                  | Reads | Repos                                                                  | Disposition | Target                                                        |
| --------------------------------------------- | ----- | ---------------------------------------------------------------------- | ----------- | ------------------------------------------------------------- |
| `VX.muted`                                    | 68    | argo, basalt-ui-obsidian, linewatch, rb, shutterflow                   | row         | VX.inkMuted                                                   |
| `--vx-ink`                                    | 65    | argo, basalt-ui-obsidian, rollhook, shutterflow, weatherorb            | kept        | --vx-ink                                                      |
| `--vx-muted`                                  | 64    | argo, basalt-ui-obsidian, rollhook, shutterflow                        | row         | --vx-ink-muted                                                |
| `VX.neutral`                                  | 57    | argo, linewatch, shutterflow, weatherorb                               | row         | VX.inkMuted                                                   |
| `VX.accent`                                   | 48    | argo, basalt-ui-obsidian, linewatch, rb, shutterflow, weatherorb       | row         | VX.brand                                                      |
| `VX.status.warn`                              | 43    | argo, linewatch, shutterflow, weatherorb                               | row         | VX.warn                                                       |
| `VX.badSolid`                                 | 39    | argo, linewatch, weatherorb                                            | manual      | VX.bad                                                        |
| `--vx-accent`                                 | 36    | argo, basalt-ui-obsidian, rb, rollhook, shutterflow, weatherorb        | row         | --vx-brand                                                    |
| `VX.line`                                     | 33    | argo, linewatch, rb                                                    | kept        | VX.line                                                       |
| `--vx-surface-bg`                             | 31    | argo, basalt-ui-obsidian, rb, rollhook, shutterflow, weatherorb        | row         | --vx-canvas                                                   |
| `VX.ink2`                                     | 31    | argo, basalt-ui-obsidian, weatherorb                                   | row         | VX.ink                                                        |
| `VX.status.bad`                               | 31    | argo, linewatch, rb, shutterflow, weatherorb                           | row         | VX.bad                                                        |
| `--vx-radius-ctrl`                            | 30    | argo, basalt-ui-obsidian, rollhook, shutterflow, weatherorb            | kept        | --vx-radius-ctrl                                              |
| `--vx-space-stack-sm`                         | 30    | argo                                                                   | row         | Tailwind `gap-*` utilities                                    |
| `--vx-neutral`                                | 28    | argo, shutterflow, weatherorb                                          | row         | --vx-ink-muted                                                |
| `VX.warnSolid`                                | 27    | argo, linewatch, weatherorb                                            | manual      | VX.warn                                                       |
| `--vx-surface-subtle`                         | 26    | argo, shutterflow, weatherorb                                          | row         | --vx-canvas                                                   |
| `VX.ink`                                      | 26    | argo, basalt-ui-obsidian, linewatch, rb, shutterflow, weatherorb       | kept        | VX.ink                                                        |
| `--vx-text-sm`                                | 25    | argo, basalt-ui-obsidian                                               | kept        | --vx-text-sm                                                  |
| `VX.goodSolid`                                | 25    | argo, linewatch, weatherorb                                            | manual      | VX.good                                                       |
| `--vx-text-xs`                                | 22    | argo, basalt-ui-obsidian                                               | kept        | --vx-text-xs                                                  |
| `--vx-space-stack-md`                         | 21    | argo, rb                                                               | row         | Tailwind `gap-*` utilities                                    |
| `--vx-radius-fine`                            | 20    | argo, basalt-ui-obsidian, rollhook, weatherorb                         | row         | --vx-radius-chip                                              |
| `--vx-space-stack-xs`                         | 20    | argo, basalt-ui-obsidian                                               | row         | Tailwind `gap-*` utilities                                    |
| `VX.status.good`                              | 19    | argo, linewatch, rb, shutterflow, weatherorb                           | row         | VX.good                                                       |
| `--vx-text-micro`                             | 17    | argo, basalt-ui-obsidian                                               | kept        | --vx-text-micro                                               |
| `--vx-accent-fill`                            | 16    | argo, rollhook, shutterflow, weatherorb                                | row         | --vx-brand-fill                                               |
| `--vx-surface-border`                         | 16    | argo, basalt-ui-obsidian, rollhook, shutterflow, weatherorb            | row         | --vx-hairline                                                 |
| `VX.text.nano`                                | 15    | weatherorb                                                             | row         | VX.text.micro                                                 |
| `--vx-surface-panel`                          | 14    | argo, basalt-ui-obsidian, linewatch, rollhook, shutterflow, weatherorb | row         | --vx-card                                                     |
| `VX.warn`                                     | 13    | argo, linewatch, shutterflow, weatherorb                               | manual      | VX.warn                                                       |
| `--vx-radius-pill`                            | 12    | argo, rollhook, shutterflow                                            | row         | `rounded-full` (Tailwind)                                     |
| `--vx-surface-hairline`                       | 12    | argo, linewatch                                                        | row         | --vx-hairline                                                 |
| `VX.radiusCtrl`                               | 12    | argo, weatherorb                                                       | kept        | VX.radiusCtrl                                                 |
| `VX.text.xs`                                  | 12    | argo, linewatch, weatherorb                                            | kept        | VX.text.xs                                                    |
| `VX.faint`                                    | 11    | argo, linewatch, weatherorb                                            | row         | VX.inkFaint                                                   |
| `VX.good`                                     | 11    | argo, linewatch, shutterflow, weatherorb                               | manual      | VX.good                                                       |
| `--vx-surface-overlay`                        | 10    | shutterflow, weatherorb                                                | row         | --vx-raised                                                   |
| `VX.line2`                                    | 10    | argo, linewatch                                                        | row         | VX.inkMuted                                                   |
| `VX.surface.subtle`                           | 10    | argo, rb                                                               | row         | VX.canvas                                                     |
| `VX.text.micro`                               | 10    | argo, basalt-ui-obsidian, linewatch, shutterflow, weatherorb           | kept        | VX.text.micro                                                 |
| `--vx-space-card-inset-x`                     | 9     | argo                                                                   | row         | Tailwind spacing utilities (`p-*`, `gap-*`, `size-*`)         |
| `--vx-space-stack-lg`                         | 9     | argo, rb                                                               | row         | Tailwind `gap-*` utilities                                    |
| `VX.bad`                                      | 9     | argo, linewatch, shutterflow, weatherorb                               | manual      | VX.bad                                                        |
| `VX.divider`                                  | 9     | argo, linewatch, rb, weatherorb                                        | row         | VX.hairline                                                   |
| `VX.status.neutral`                           | 9     | argo, linewatch, shutterflow, weatherorb                               | manual      | VX.inkMuted                                                   |
| `VX.surface.border`                           | 9     | rb, weatherorb                                                         | row         | VX.hairline                                                   |
| `--vx-line`                                   | 8     | argo, linewatch                                                        | kept        | --vx-line                                                     |
| `--vx-radius-floating`                        | 8     | rollhook, shutterflow                                                  | row         | --vx-radius-inset                                             |
| `--vx-surface-elevated`                       | 8     | argo, rollhook                                                         | row         | --vx-raised                                                   |
| `--vx-radius-card`                            | 7     | basalt-ui-obsidian, rollhook, shutterflow, weatherorb                  | kept        | --vx-radius-card                                              |
| `--vx-text-md`                                | 7     | argo, basalt-ui-obsidian                                               | kept        | --vx-text-md                                                  |
| `VX.accentFill`                               | 7     | argo, weatherorb                                                       | row         | VX.brandFill                                                  |
| `VX.dashArray`                                | 7     | argo, weatherorb                                                       | row         | VX.dash                                                       |
| `VX.goodRef`                                  | 7     | argo, linewatch                                                        | manual      | alpha(var(--vx-good), .5) + VX.dash                           |
| `--vx-ink2`                                   | 6     | argo, basalt-ui-obsidian, shutterflow, weatherorb                      | row         | --vx-ink                                                      |
| `--vx-on-accent`                              | 6     | rollhook, shutterflow, weatherorb                                      | row         | --vx-on-brand                                                 |
| `--vx-space-control-gap`                      | 6     | argo                                                                   | row         | Tailwind spacing utilities (`p-*`, `gap-*`, `size-*`)         |
| `--vx-space-sticky-header-clearance`          | 6     | rb                                                                     | row         | Tailwind spacing utilities (`p-*`, `gap-*`, `size-*`)         |
| `VX.badRef`                                   | 6     | argo                                                                   | manual      | alpha(var(--vx-bad), .5) + VX.dash                            |
| `VX.status`                                   | 6     | argo, linewatch, rb                                                    | manual      | VX.good, VX.warn, VX.bad                                      |
| `VX.surface.bg`                               | 6     | rb, weatherorb                                                         | row         | VX.canvas                                                     |
| `VX.warnRef`                                  | 6     | argo, linewatch                                                        | manual      | alpha(var(--vx-warn), .5) + VX.dash                           |
| `--vx-confidence-`                            | 5     | rb                                                                     | app-owned   | declared in `src/basalt.tokens.ts` (tokens-visual 3.8)        |
| `--vx-faint`                                  | 5     | basalt-ui-obsidian, weatherorb                                         | row         | --vx-ink-faint                                                |
| `--vx-good-solid`                             | 5     | argo, basalt-ui-obsidian                                               | manual      | --vx-good                                                     |
| `--vx-prose-measure`                          | 5     | basalt-ui-obsidian, rb                                                 | row         | --vx-measure                                                  |
| `--vx-space-app-shell-inset`                  | 5     | linewatch                                                              | row         | Tailwind spacing utilities (`p-*`, `gap-*`, `size-*`)         |
| `--vx-surface-field`                          | 5     | rollhook, shutterflow                                                  | row         | --vx-card                                                     |
| `VX.radiusPill`                               | 5     | weatherorb                                                             | row         | `rounded-full` (Tailwind)                                     |
| `VX.text.sm`                                  | 5     | argo, basalt-ui-obsidian, linewatch, shutterflow, weatherorb           | kept        | VX.text.sm                                                    |
| `--vx-divider`                                | 4     | argo, basalt-ui-obsidian, shutterflow                                  | row         | --vx-hairline                                                 |
| `--vx-status-bad`                             | 4     | argo, rollhook                                                         | row         | --vx-bad                                                      |
| `--vx-status-good`                            | 4     | rollhook                                                               | row         | --vx-good                                                     |
| `--vx-surface-row-hover`                      | 4     | argo                                                                   | row         | --vx-hover                                                    |
| `--vx-surface-row-selected`                   | 4     | argo                                                                   | row         | --vx-selected                                                 |
| `--vx-text-lg`                                | 4     | argo, basalt-ui-obsidian                                               | manual      | --vx-text-base                                                |
| `VX.axis`                                     | 4     | argo                                                                   | row         | VX.inkFaint                                                   |
| `VX.status.excellent`                         | 4     | argo, weatherorb                                                       | manual      | app series `{ hue: 'forest' }`                                |
| `--vx-hillshadeAccent`                        | 3     | argo                                                                   | app-owned   | declared in `src/basalt.tokens.ts` (tokens-visual 3.8)        |
| `--vx-hillshadeHighlight`                     | 3     | argo                                                                   | app-owned   | declared in `src/basalt.tokens.ts` (tokens-visual 3.8)        |
| `--vx-hillshadeShadow`                        | 3     | argo                                                                   | app-owned   | declared in `src/basalt.tokens.ts` (tokens-visual 3.8)        |
| `--vx-hit`                                    | 3     | basalt-ui-obsidian                                                     | kept        | --vx-hit                                                      |
| `--vx-radius-tight`                           | 3     | argo, basalt-ui-obsidian                                               | row         | --vx-radius-chip                                              |
| `--vx-space-app-shell-inset-mobile`           | 3     | linewatch                                                              | row         | Tailwind spacing utilities (`p-*`, `gap-*`, `size-*`)         |
| `--vx-space-card-inset-y`                     | 3     | argo                                                                   | row         | Tailwind spacing utilities (`p-*`, `gap-*`, `size-*`)         |
| `--vx-text-xl`                                | 3     | argo, weatherorb                                                       | row         | --vx-text-lg                                                  |
| `--vx-weatherorb-`                            | 3     | weatherorb                                                             | app-owned   | declared in `src/basalt.tokens.ts` (tokens-visual 3.8)        |
| `VX.surface.panel`                            | 3     | argo, weatherorb                                                       | row         | VX.card                                                       |
| `--vx-accent-hover`                           | 2     | rb, weatherorb                                                         | row         | --vx-brand                                                    |
| `--vx-border`                                 | 2     | shutterflow                                                            | manual      | --vx-hairline                                                 |
| `--vx-shadow-overlay`                         | 2     | shutterflow                                                            | kept        | --vx-shadow-overlay                                           |
| `--vx-space-`                                 | 2     | basalt-ui-obsidian                                                     | manual      | the per-name '--vx-space-*' rows                              |
| `--vx-space-callout-inset-x`                  | 2     | basalt-ui-obsidian                                                     | row         | Tailwind spacing utilities (`p-*`, `gap-*`, `size-*`)         |
| `--vx-space-callout-inset-y`                  | 2     | basalt-ui-obsidian                                                     | row         | Tailwind spacing utilities (`p-*`, `gap-*`, `size-*`)         |
| `--vx-space-prose-article-block-gap`          | 2     | basalt-ui-obsidian                                                     | row         | Tailwind spacing utilities (`p-*`, `gap-*`, `size-*`)         |
| `--vx-status-warn`                            | 2     | rollhook                                                               | row         | --vx-warn                                                     |
| `--vx-surface-`                               | 2     | argo                                                                   | manual      | the per-name '--vx-surface-*' rows                            |
| `--vx-text-display`                           | 2     | argo, shutterflow                                                      | kept        | --vx-text-display                                             |
| `--vx-text-nano`                              | 2     | argo                                                                   | row         | --vx-text-micro                                               |
| `--vx-warn-ref`                               | 2     | linewatch                                                              | manual      | alpha(var(--vx-warn), .5) + VX.dash                           |
| `VX.dotStroke`                                | 2     | argo                                                                   | row         | VX.surface                                                    |
| `VX.goodSoft`                                 | 2     | argo                                                                   | row         | VX.good                                                       |
| `VX.grid`                                     | 2     | argo                                                                   | kept        | VX.grid                                                       |
| `VX.line2Width`                               | 2     | linewatch                                                              | row         | VX.lineWidth (one stroke weight)                              |
| `VX.onAccent`                                 | 2     | weatherorb                                                             | row         | VX.onBrand                                                    |
| `VX.shadowOverlay`                            | 2     | weatherorb                                                             | kept        | VX.shadowOverlay                                              |
| `VX.surface.elevated`                         | 2     | argo                                                                   | row         | VX.raised                                                     |
| `VX.surface.overlay`                          | 2     | weatherorb                                                             | row         | VX.raised                                                     |
| `--vx-accent-fill-hover`                      | 1     | weatherorb                                                             | manual      | color-mix(in srgb, var(--vx-brand-fill) 88%, #000) in app CSS |
| `--vx-activity-`                              | 1     | argo                                                                   | app-owned   | declared in `src/basalt.tokens.ts` (tokens-visual 3.8)        |
| `--vx-axis`                                   | 1     | rollhook                                                               | row         | --vx-ink-faint                                                |
| `--vx-bad`                                    | 1     | shutterflow                                                            | manual      | --vx-bad                                                      |
| `--vx-bad-solid`                              | 1     | basalt-ui-obsidian                                                     | manual      | --vx-bad                                                      |
| `--vx-confidence-forgotten`                   | 1     | rb                                                                     | app-owned   | declared in `src/basalt.tokens.ts` (tokens-visual 3.8)        |
| `--vx-fill-`                                  | 1     | rollhook                                                               | manual      | the per-name '--vx-fill-*' rows                               |
| `--vx-fill-violet`                            | 1     | rollhook                                                               | manual      | `--vx-chart-1..5` or defineSeries({ hue: 'violet' })          |
| `--vx-grid`                                   | 1     | rollhook                                                               | kept        | --vx-grid                                                     |
| `--vx-hillshade`                              | 1     | argo                                                                   | app-owned   | declared in `src/basalt.tokens.ts` (tokens-visual 3.8)        |
| `--vx-line2`                                  | 1     | shutterflow                                                            | row         | --vx-ink-muted                                                |
| `--vx-lp-`                                    | 1     | argo                                                                   | app-owned   | declared in `src/basalt.tokens.ts` (tokens-visual 3.8)        |
| `--vx-optimalZone`                            | 1     | argo                                                                   | app-owned   | declared in `src/basalt.tokens.ts` (tokens-visual 3.8)        |
| `--vx-payer-`                                 | 1     | argo                                                                   | app-owned   | declared in `src/basalt.tokens.ts` (tokens-visual 3.8)        |
| `--vx-rank-`                                  | 1     | argo                                                                   | app-owned   | declared in `src/basalt.tokens.ts` (tokens-visual 3.8)        |
| `--vx-routing-`                               | 1     | argo                                                                   | app-owned   | declared in `src/basalt.tokens.ts` (tokens-visual 3.8)        |
| `--vx-series-`                                | 1     | argo                                                                   | app-owned   | declared in `src/basalt.tokens.ts` (tokens-visual 3.8)        |
| `--vx-space-article-column-gap`               | 1     | rb                                                                     | row         | Tailwind spacing utilities (`p-*`, `gap-*`, `size-*`)         |
| `--vx-space-article-toc-rail-width`           | 1     | rb                                                                     | row         | Tailwind spacing utilities (`p-*`, `gap-*`, `size-*`)         |
| `--vx-space-callout-title-row-gap`            | 1     | basalt-ui-obsidian                                                     | row         | Tailwind spacing utilities (`p-*`, `gap-*`, `size-*`)         |
| `--vx-space-mobile-nav-row-height`            | 1     | basalt-ui-obsidian                                                     | row         | `min-h-row` / `--vx-row-h` and Tailwind padding               |
| `--vx-space-prose-article-h1-gap-bottom`      | 1     | basalt-ui-obsidian                                                     | row         | Tailwind spacing utilities (`p-*`, `gap-*`, `size-*`)         |
| `--vx-space-prose-article-h1-gap-top`         | 1     | basalt-ui-obsidian                                                     | row         | Tailwind spacing utilities (`p-*`, `gap-*`, `size-*`)         |
| `--vx-space-prose-article-h2-rule-gap`        | 1     | basalt-ui-obsidian                                                     | row         | Tailwind spacing utilities (`p-*`, `gap-*`, `size-*`)         |
| `--vx-space-prose-article-heading-gap-bottom` | 1     | basalt-ui-obsidian                                                     | row         | Tailwind spacing utilities (`p-*`, `gap-*`, `size-*`)         |
| `--vx-space-prose-article-heading-gap-top`    | 1     | basalt-ui-obsidian                                                     | row         | Tailwind spacing utilities (`p-*`, `gap-*`, `size-*`)         |
| `--vx-space-prose-article-paragraph-gap`      | 1     | basalt-ui-obsidian                                                     | row         | Tailwind spacing utilities (`p-*`, `gap-*`, `size-*`)         |
| `--vx-space-prose-table-cell-inset-x`         | 1     | basalt-ui-obsidian                                                     | row         | Tailwind spacing utilities (`p-*`, `gap-*`, `size-*`)         |
| `--vx-space-prose-table-cell-inset-y`         | 1     | basalt-ui-obsidian                                                     | row         | Tailwind spacing utilities (`p-*`, `gap-*`, `size-*`)         |
| `--vx-space-settings-row-gap`                 | 1     | shutterflow                                                            | row         | Tailwind spacing utilities (`p-*`, `gap-*`, `size-*`)         |
| `--vx-space-settings-row-inset-y`             | 1     | shutterflow                                                            | row         | Tailwind spacing utilities (`p-*`, `gap-*`, `size-*`)         |
| `--vx-space-touch-target`                     | 1     | basalt-ui-obsidian                                                     | row         | --vx-hit                                                      |
| `--vx-status-`                                | 1     | rollhook                                                               | manual      | the per-name '--vx-status-*' rows                             |
| `--vx-surface-panel-hover`                    | 1     | rollhook                                                               | row         | --vx-hover                                                    |
| `--vx-text-h2`                                | 1     | argo                                                                   | row         | the content ladder (`.vx-prose`, typography.css)              |
| `--vx-tooltip-bg`                             | 1     | rollhook                                                               | row         | --vx-raised                                                   |
| `--vx-tooltip-border`                         | 1     | rollhook                                                               | row         | --vx-hairline                                                 |
| `--vx-usage-`                                 | 1     | argo                                                                   | app-owned   | declared in `src/basalt.tokens.ts` (tokens-visual 3.8)        |
| `--vx-warn-solid`                             | 1     | basalt-ui-obsidian                                                     | manual      | --vx-warn                                                     |
| `--vx-weatherorb-model1`                      | 1     | weatherorb                                                             | app-owned   | declared in `src/basalt.tokens.ts` (tokens-visual 3.8)        |
| `VX.legendText`                               | 1     | linewatch                                                              | row         | VX.inkMuted                                                   |
| `VX.lineWidth`                                | 1     | linewatch                                                              | kept        | VX.lineWidth                                                  |
| `VX.radiusCard`                               | 1     | linewatch                                                              | kept        | VX.radiusCard                                                 |
| `VX.series.optimalZone`                       | 1     | argo                                                                   | app-owned   | `series`/`vars` in `src/basalt.tokens.ts`                     |
| `VX.surface.rowSelected`                      | 1     | argo                                                                   | row         | VX.selected                                                   |
| `VX.text.kpi`                                 | 1     | weatherorb                                                             | row         | VX.text.display                                               |
| `VX.text.md`                                  | 1     | shutterflow                                                            | kept        | VX.text.md                                                    |

## Rollhook

Proof run, scratch clone of `~/SourceRoot/rollhook` at HEAD (`git clone`, never modified): `basalt-ui migrate --from 2.29.0 --profile bridge --json`, run from the repo root, `apps/dashboard` and `apps/marketing`, exits 0 each. The clone holds 114 distinct `--vx-*` spellings (`rg -o -e '--vx-[a-z0-9-]+' -g '!node_modules' -g '!docs' apps packages`): 26 outside the two generated `basalt-tokens.css` sheets and 114 with them. A scripted join of that list against the rows `from` finds **114 with a row, 0 without** (the consumer audit of 11-09 counted 38 distinct `var(--vx-*)` names over this tree; the full-tree spelling list is the stricter test). The report lists 116 rows per app and 0 failures; under `--profile bridge` it selects every row whose `profiles` include `bridge`.
