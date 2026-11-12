# Spike: Q2 weatherorb `/map` real build against 704 KiB

Q2 passes. The first-load closure of `/map`, ported to v3 parts (Base UI + Tailwind) in a scratch copy of weatherorb, builds to 704,178 B gzip (687.7 KiB), 16,718 B (16.3 KiB) under the 720,896 B bar. No lever was needed.

Concept: `docs/v3/concepts/quality-contract.md` section 10, Q2, and the section 6 method. No harness is committed; the command list below is the test.

## Question

Does weatherorb's `/map` first load stay at or under 704 KiB (720,896 B) gzip when its Mantine/basalt 2.x chrome is ported to v3 parts? The section 6 sum predicted about 696 KiB with a 5 KB provider, with an error of +/-15 KiB. Over the bar means the section 6 levers in order (native range, checkbox, radio; lazy Drawer), never a raise.

## Method

- Source: weatherorb at `031160b21172c2370a000b4cea1cd5d8b8931dde`, apps/web, read-only. `git status --short` in the source checkout printed nothing before the spike and nothing after it: clean both times. No commit, no file written there; `apps/web/dist` in the source was only read to compare, never rebuilt.
- Scratch copy: `rsync -a` of the checkout into a fresh `mktemp -d /tmp/q2map.XXXXXX` directory, leaving out `.git`, `node_modules`, `data`, `var`, `apps/mobile`, `products`, `ops`, `vendor`, `.venv`, `.claude` and caches; then `bun install` there (bun 1.4.2).
- Baseline in the copy, same command as the port (`bun scripts/generate-routes.ts && vite build`, then `bun scripts/bundle-report.ts`): 715,806 B gzip (699.0 KiB), 5,090 B headroom. weatherorb's own record is 699.2 KiB, so the copy reproduces the source. `tsc --noEmit` is skipped in the copy: it fails on the left-out `data/` schema, which is unrelated.
- Install route: `bun pm pack` of `packages/basalt-ui` at base commit `4d29d05249359a81ffd555e260027c9eab08d67b` after `bun run build`: `basalt-ui-2.29.0.tgz` (the manifest still reads 2.29.0 during the in-place rewrite), shasum `317eda5fff47fa78357e6e7698643212183926be`. In `apps/web`: `bun remove @mantine/core @mantine/hooks @mantine/modals @mantine/notifications @mantine/spotlight`, `bun add basalt-ui@file:<tarball> @base-ui/react@1.9.0`, `bun add -d tailwindcss@4.3.5 @tailwindcss/vite@4.3.5 class-variance-authority@0.7.1 clsx@2.1.1`.
- Scratch scaffolding (4 files outside the chrome): `vite.config.ts` swaps `basaltViteConfig` for `tailwindcss()` and aliases `basalt-ui/core/provider` to the packed `dist/core/provider.js` (the v3 provider is not an exported subpath yet); `src/app/app.css` (`@import 'basalt-ui/tailwind.css'` plus `@source` lines); `src/app/providers.tsx` (app-owned `QueryClientProvider` plus the v3 `BasaltProvider`); `src/router.tsx` and `src/routes/__root.tsx` (a plain `QueryClient` in the router context instead of `basaltRouterOptions`).
- Port: every file in the first-load closure that imported `@mantine/*`, `VX`/`alpha` from `basalt-ui/tokens` or the 2.x root. Layout primitives (`Box`, `Group`, `Stack`, `Text`, `UnstyledButton`, `Anchor`) became plain elements with Tailwind classes. Widgets became parts: `ui/slider`, `ui/switch`, `ui/radio-group`, `ui/segmented`, `ui/sheet` (Drawer), `ui/accordion`, `ui/scroll-area`, `ui/button`, `ui/popover`, `ui/menu`, `ui/input`, `ui/select`. `useSizeClass` came from `basalt-ui/page`, `unwrap` from `basalt-ui/data`. Same components and behaviour, nothing dropped for bytes.
- Edit count: 19 files changed in `src/`, 1 added (`app.css`), plus `vite.config.ts` and `package.json`: 22 files, under the 40-file stop rule. The files ported: `map/map-canvas`, `map/breakpoints`, `map/chrome/{map-chrome,display-controls,opacity,map-overlays,legend,layer-picker,model-picker,sources-footer,place-search,stack-editor,timeline-bar}`, `account/{account-menu,favourites-ui,hooks}`, `app/providers`, `router`, `routes/__root`.
- Not ported: the lazy chunks (`point-panel` family, `probe-popup`, `sign-in-modal`, `api-keys-modal`, `_app.app-sign-in`, the chart files). They are outside the first-load closure and stay Mantine; the walk skips them by name exactly as weatherorb's `src/bundle-bars.test.ts` does. `rg -c -i mantine` over the first-load chunks finds nothing.
- Measure: `vite build` (Vite 8.3.0, Rolldown, minified), then weatherorb's own `scripts/bundle-report.ts`: the static plus dynamic closure of `_shell.html` (`followDynamic: true`), the DEFERRED chunks skipped, plus the two workers the page spawns on load, `gzipSync` default level. Same definition as the section 6 `maxScripts` per-route closure.

## Measurements

Commands, in the scratch `apps/web`:

```
bun scripts/generate-routes.ts
node_modules/.bin/vite build
bun scripts/bundle-report.ts
```

Versions: bun 1.4.2, node 26.13.0, Vite 8.3.0, React 19.3.0, `@base-ui/react` 1.9.0, Tailwind 4.3.5 and `@tailwindcss/vite` 4.3.5, `@tanstack/react-start` 1.168.60, `maplibre-gl` 6.4.1.

`/map` including workers: 704,178 B gzip = 687.7 KiB. Bar 720,896 B. Margin 16,718 B = 16.3 KiB.

| Chunk (gzip B)           | Baseline (Mantine, 2.26.0) | Port (v3 parts) |
| ------------------------ | -------------------------- | --------------- |
| `_app.map` (route)       | 348,343                    | 392,466         |
| `index` (entry)          | 133,019                    | 133,980         |
| `maplibre-gl-worker`     | 131,173                    | 131,173         |
| `TextInput` (Mantine)    | 24,134                     | gone            |
| `_app` (layout)          | 20,151                     | 252             |
| `account-menu`           | 7,522                      | 14,379          |
| `series`                 | 11,337                     | gone            |
| `hooks`                  | 10,986                     | 7,843           |
| `QueryClientProvider`    | 10,638                     | 269             |
| `button` (ui)            | not present                | 8,377           |
| `core` (ui)              | not present                | 7,522           |
| `Combination` (Mantine)  | 5,799                      | gone            |
| `decode.worker`          | 5,072                      | 5,072           |
| `react`                  | 3,284                      | gone            |
| `favourites-ui`          | 1,192                      | 1,113           |
| `messages`               | 998                        | 998             |
| `provider` (v3 skeleton) | not present                | 379             |
| Rest (under 1 KB each)   | 2,158                      | 355             |
| **Total**                | **715,806**                | **704,178**     |

Reading. The route chunk grows by 44 KB because the Base UI parts (accordion, sheet, slider, switch, radio-group, segmented, scroll-area, popover, select) and their `cn`/cva tables land in it; the Mantine shared chunks (`TextInput`, `Combination`, the Mantine provider in `_app`, `series`) leave. The net is 11.6 KB below the baseline, against the 3.4 KB the section 6 sum predicts (an illustration with +/-15 KiB error). The v3 provider here is the Q1 skeleton, 379 B in this build (298 B in the Q1 spike), not the final provider.

Provider headroom: the provider may grow to the 5,000 B cap. Replacing 379 B with 5,000 B gives 708,799 B = 692.2 KiB, still 12,097 B under the bar. The section 6 case of a 20 KB provider would give 723,799 B, over; the cap is what protects the bar.

## Verdict

Q2: PASS

Verdict: PASS

By the rule: 704,178 B is at most 720,896 B (704 KiB), with the levers unused: native range, checkbox and radio, and the lazy Drawer were not applied, so they remain unspent margin (the Drawer is the `ui/sheet` in `map-chrome.tsx` and the three input parts are isolated in `opacity.tsx` and `display-controls.tsx`).

Caveats. The count is bytes, not behaviour or looks: nothing was rendered, and Tailwind class choices approximate the Mantine look. The port loses a few Mantine affordances (slider value bubble, hover-only scrollbars, popover arrow, `xs` control sizes; the sheet gets its required title row) that a real migration would settle; none of them has a byte cost worth a lever. CSS is outside the bar (JS only, as in `bundle-bars.test.ts`) and was not tuned. The lazy chunks (point panel, charts, probe popup, modals) were not ported, so their v3 size is unmeasured; they do not count toward `/map` first load. The provider is a skeleton, and the dependency set (`@base-ui/react`, `tailwindcss`) was resolved at the pinned versions above, not at the final 3.0.0 manifest.

## Then

- The held weatherorb row owns the real G4 migration: the lazy files, the real provider, the CSS budget and rendered checks. It re-runs the three commands above from its own build and keeps the 704 KiB `MAP_BAR` in `src/bundle-bars.test.ts`.
- The Issue that adds the provider's `timeZone`, `messages` and `createFormat` path should re-run this arithmetic: the provider can add at most 4,621 B (5,000 minus this build's 379) before the margin of 16,718 B drops to 12,097 B; it stays positive up to the cap.
- Export the v3 provider from a public subpath (it was reached here through a Vite alias); that is a provider Issue, not this one.

## Affects

- `docs/v3/concepts/quality-contract.md` section 10, Q2: pass, frozen, unchanged; no Contract amendment and no raise. The section 6 weatherorb row (695.8 KiB, +/-15 KiB) is confirmed within its error: measured 687.7 KiB.
- Gate G4: the `/map` bar holds with 16.3 KiB of margin and 12.1 KiB at a full 5 KB provider.
- No code, rule, skill snippet or script changes in this repo.
