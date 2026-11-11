# Spike: S2 engine byte probe

Verdict: HAND-SVG. The Sparkline probe on the TanStack Charts engine costs 40,699 B gz over a bare React `createRoot`, above the 36 KB line (36,864 B at 1 KiB = 1024 B; 36,000 B at 1000 B fails by more).

Harness: `bun test src/charts/core/bytes.test.ts` in `packages/basalt-ui`. Concept: `docs/v3/concepts/charts-cards-kanban.md` section 9, S2; DPO 11.

## Question

Does `Sparkline` ride the engine at 36 KB gz or less? Refuted above that: the 130-line hand-SVG core goes in charts-1 under `src/charts/core`.

## Method

- Probe fixtures in `src/charts/core/probe/`, each mounting the engine's `Chart` from `@tanstack/charts/react` (the host's job) with bare marks: `line.tsx` (`lineY`), `bar.tsx` (`barY`), `sparkline.tsx` (the shipped Sparkline's mark set: `lineY`, last-point `dot`, `ruleY`, `text`, band `rect`, `decorative`). No basalt chrome, no tokens, no placeholders.
- Contract method (quality-contract section 6): Vite 8 production build, `gzipSync` default level, every peer bundled including React, minus a `base0` built in the same run (React + react-dom `createRoot`).
- `@tanstack/charts` 1.5.0, React 19.3.0, `minify: true`, all emitted chunks counted.

## Measurements

Two runs, identical.

| Probe     | gz bytes | Over base0 (76,783 B) |
| --------- | -------- | --------------------- |
| line      | 113,318  | 36,535                |
| bar       | 119,127  | 42,344                |
| sparkline | 117,482  | 40,699                |

`bytes.test.ts` asserts the three deltas within 400 B and the verdict at the line.

## Reading

- The floor is the engine, not the marks: a lone `lineY` is already 36.5 KB, so no mark trimming brings the Sparkline under 36 KB. `barY` costs more than the full Sparkline mark set because of the band scale.
- The numbers hold for MiniBars too (same engine floor, bar probe 42.3 KB), so it takes the hand-SVG core as well.
- Out of scope here: byte ceilings (freeze-g1 seeds them), the core port itself (charts-1).
