/**
 * Area: provider — what `BasaltProvider` costs a consumer's first paint: the provider-only, embedded
 * and theme-only gzip ceilings, plus the zero rows (dev-only chunks, feature runtimes) over the same
 * bundles. Each ceiling follows CI's Linux build; its history sits above it.
 */
import { existsSync } from 'node:fs'

import {
  allChunksGzip,
  buildProviderOnlyBundle,
  devOnlyChunks,
  featureRuntimeChunks,
  firstPaintGzip,
} from '../bundle'
import { Unmeasured, gate } from '../lib'
import type { Ctx, RowDef } from '../lib'

const PROVIDER_ONLY_LABEL = 'provider-only first paint (gzip B, dist)'
// Landed 18706 locally / 18722 in CI (1.33.0: lab store + every isDev()/DEV-const gate folded;
// 1.30.2 19393, 1.32.1 20379). The ~1% margin absorbs the zlib/runtime difference between machines
// (16 B measured) — it is a regression gate for KB-scale growth, not a byte-exact snapshot. Raise it
// deliberately, in the commit that spends it, never to make a red gate green.
// 18900 → 19000: the AA anchor/error vars and the badge/outline ink mix in the resolver (18904 locally).
// 19000 → 20800: `BasaltProvider` now wires the whole tree (router, query, modals, telemetry, hotkeys,
// Spotlight actions, § 2); 20655 landed. Peers stay external, so these are basalt's own bytes.
// 20800 → 20880: #255 (embedded-children provider mode, `spotlight={false}`, `useRouter` import) added
// ~140 B (20796 locally, 20830 in CI). No honest saving: the new error strings must name both modes
// (tested) and Spotlight is statically mounted by default, so lazying it would change first paint.
// 20880 → 20340: the dock's lazy import() is dead code in production (20136 locally, was 20796);
// ~1% over local clears CI's measured +34 B with room.
// 20340 → 19940: the 32 camelCase `--vx-*` aliases leave the injected CSS (19744 locally, was 20136).
// 19940 → 19000: Spotlight and modals leave the entry (provider slots): 18810 locally, was 19755.
// 19000 → 19200: the provider owns the `route.error` emit now (it was in `createBasaltRouter`, outside
// this entry) plus the mutation-key hash: 19034 locally, was 18923.
// 19200 → 19202 (W33 CI): the light Badge default, ink Tabs underline and the badge glyph rule in the theme + palette CSS.
// 19202 → 19281 (W33 CI, review round): the subtle ink label/hover moved from the resolver into Button/ActionIcon `vars`, plus `tabsVars`.
// 19281 → 19305 (W33 CI, chrome-vars move): +24 B.
// 19305 → 19308 (W33 CI, all five W33 PRs merged): +3 B.
// 19308 → 19473 (2.18): +165 B, status text derived per surface — contrastRatio + bounded tone walk in derive (a no-op at the default config).
// 19473 → 19577 (2.18, review round): +104 B, the lightLevel/darkLevel RangeError and the exhaustive text-surface record.
// 19577 → 19607 (2.18, CI Linux measurement): +30 B over the macOS build.
// 19607 → 19599 (2.18, review round 2, CI Linux measurement): −8 B, the solver moved to its own module.
// 19599 → 19732 (2.18, light/outline Button+ActionIcon ink vars, CI Linux measurement): +133 B.
// 19732 → 19782 (W35, the theme owns the card inset, CI Linux measurement): +50 B.
// 19782 → 19921 (W35, on-scale Button padding and the neutral error state, CI Linux measurement): +139 B.
// 19921 → 20012 (W36, Button section inset vars, CI Linux measurement): +91 B.
// 20012 → 20345 (W37, tab/badge/row-surface/disabled vars, CI Linux measurement): +333 B.
// 20345 → 20398 (W37 review round 1, CI Linux measurement): +53 B.
// 20398 → 20435 (W37 states r3, CI Linux measurement): +37 B.
// 20435 → 20442 (W37 states r3 round 2, CI Linux measurement): +7 B, the per-instance indicator radius.
// 20442 → 20452 (W38 nested radii, CI Linux measurement): +10 B.
// 20452 → 20445 (W42 table law, CI Linux measurement): -7 B.
// 20445 → 20446 (Wave 46: NumberInput/PasswordInput/Textarea join the ctl tier): +1 B.
// 20446 → 20468 (CI's own zlib measures the shipped bytes above the mini's; the Wave 46 ceilings were set from the mini and CI has been red since): ceiling follows CI.
const PROVIDER_ONLY_CEILING = 20468
// Embedded `<BasaltProvider spotlight={false}>`, no defines, peers bundled, every chunk counted: 54735 B landed, ~1% margin.
// 55300 → 55391 (W32): +91 B for the Wave 32 scales — the dense control tier rule in the palette CSS, the row line-height and `lineHeights` ratios, the expanded gutter, and the card/radius/type retunes.
// 55391 → 55404 (W32 CI): the gate is CI's Linux build, which gzips 13 B larger than the macOS build the lead measured.
// 55404 → 55482 (W33 CI): +78 B, the same Badge/Tabs/subtle-Button chrome changes.
// 55482 → 55569 (W33 CI, review round): +87 B, the same move.
// 55569 → 55599 (W33 CI, chrome-vars move): +30 B.
// 55599 → 55601 (W33 CI, all five W33 PRs merged): +2 B.
// 55601 → 55776 (2.18): +175 B, the same status-text derivation (walk is a no-op at the default config).
// 55776 → 55859 (2.18, review round): +83 B, the same move.
// 55859 → 55878 (2.18, CI Linux measurement): +19 B over the macOS build.
// 55878 → 55902 (2.18, review round 2, CI Linux measurement): +24 B, the level clamp and the solver extraction.
// 55902 → 56033 (2.18, light/outline Button+ActionIcon ink vars, CI Linux measurement): +131 B.
// 56033 → 56097 (W35, the theme owns the card inset, CI Linux measurement): +64 B.
// 56097 → 56238 (W35, on-scale Button padding and the neutral error state, CI Linux measurement): +141 B.
// 56238 → 56319 (W36, Button section inset vars, CI Linux measurement): +81 B.
// 56319 → 56641 (W37, tab/badge/row-surface/disabled vars, CI Linux measurement): +322 B.
// 56641 → 56699 (W37 review round 1, CI Linux measurement): +58 B.
// 56699 → 56735 (W37 states r3, CI Linux measurement): +36 B.
// 56735 → 56742 (W37 states r3 round 2, CI Linux measurement): +7 B.
// 56742 → 56749 (W38 nested radii, CI Linux measurement): +7 B.
// 56749 → 56744 (W42 table law, CI Linux measurement): -5 B.
// 56744 → 56755 (Wave 46: NumberInput/PasswordInput/Textarea join the ctl tier): +11 B.
// 56755 → 56766 (CI's own zlib measures the shipped bytes above the mini's; the Wave 46 ceilings were set from the mini and CI has been red since): ceiling follows CI.
const EMBEDDED_CEILING = 56766
// `createBasaltTheme()` alone, peers bundled, every chunk counted: 14420 locally. The theme reaching
// no component it configures is what keeps this near Mantine's core; ~1% over landed.
// 14570 → 14571 (W32): +1 B, the `lineHeights` ratios.
// 14571 → 14580 (W32 CI): the same Linux-vs-macOS gzip difference, 9 B. Raise gzip ceilings from CI's numbers.
// 14580 → 14653 (W33 CI): +73 B, the same chrome changes.
// 14653 → 14719 (W33 CI, review round): +66 B, the same move.
// 14719 → 14768 (W33 CI, chrome-vars move): +49 B.
// 14768 → 14771 (W33 CI, all five W33 PRs merged): +3 B.
// 14771 → 14953 (2.18): +182 B, the same status-text derivation (walk is a no-op at the default config).
// 14953 → 15036 (2.18, review round): +83 B, the same move.
// 15036 → 15047 (2.18, CI Linux measurement): +11 B over the macOS build.
// 15047 → 15057 (2.18, review round 2, CI Linux measurement): +10 B, the same move.
// 15057 → 15183 (2.18, light/outline Button+ActionIcon ink vars, CI Linux measurement): +126 B.
// 15183 → 15235 (W35, the theme owns the card inset, CI Linux measurement): +52 B.
// 15235 → 15374 (W35, on-scale Button padding and the neutral error state, CI Linux measurement): +139 B.
// 15374 → 15451 (W36, Button section inset vars, CI Linux measurement): +77 B.
// 15451 → 15767 (W37, tab/badge/row-surface/disabled vars, CI Linux measurement): +316 B.
// 15767 → 15819 (W37 review round 1, CI Linux measurement): +52 B.
// 15819 → 15853 (W37 states r3, CI Linux measurement): +34 B.
// 15853 → 15859 (W37 states r3 round 2, CI Linux measurement): +6 B.
// 15859 → 15868 (W38 nested radii, CI Linux measurement): +9 B.
// 15868 → 15862 (W42 table law, CI Linux measurement): -6 B.
// 15862 → 15874 (Wave 46: NumberInput/PasswordInput/Textarea join the ctl tier): +12 B.
// 15874 → 15882 (CI's own zlib measures the shipped bytes above the mini's; the Wave 46 ceilings were set from the mini and CI has been red since): ceiling follows CI.
const THEME_ONLY_CEILING = 15882
const THEME_ONLY_LABEL = 'createBasaltTheme only, peers bundled, all chunks (gzip B, dist)'
const EMBEDDED_LABEL = 'embedded provider, no defines, peers bundled, all chunks (gzip B, dist)'
const FEATURE_CHUNKS_LABEL =
  'spotlight/modals/hotkeys modules in a define-free provider build (+ ShortcutsHelp)'
const DEV_CHUNKS_LABEL =
  'dev-only chunks in a production consumer build (dock, theme lab, devtools)'

/** The bundles are built against `dist/`: absent is `skipped`, a bundler failure is `failed`. */
function distEntry(ctx: Ctx): string {
  if (!existsSync(ctx.providerOnlyDist)) {
    throw new Unmeasured('dist/ missing, run `bun run build`')
  }
  return ctx.providerOnlyDist
}

/** The provider-only fixture; its size row and dev-chunks row share one build and one failure. */
function providerOnly(ctx: Ctx) {
  const dist = distEntry(ctx)
  return ctx.once('provider-only', () => buildProviderOnlyBundle(dist))
}

/** The three peer-bundled fixtures; a failure in any of them marks all three of their rows failed. */
function embeddedGroup(ctx: Ctx) {
  const dist = distEntry(ctx)
  return ctx.once('embedded-group', async () => ({
    embedded: await buildProviderOnlyBundle(dist, {
      fixture: 'provider-embedded.tsx',
      bundlePeers: true,
    }),
    // `ShortcutsHelp` is the `./commands` export a define-free app can read; gate it with the same zero row.
    shortcuts: await buildProviderOnlyBundle(dist, {
      fixture: 'provider-shortcuts-help.tsx',
      bundlePeers: true,
    }),
    themeOnly: await buildProviderOnlyBundle(dist, {
      fixture: 'provider-theme-only.tsx',
      bundlePeers: true,
    }),
  }))
}

export const rows: readonly RowDef[] = [
  {
    id: 'provider-only',
    order: 120,
    label: PROVIDER_ONLY_LABEL,
    ceiling: PROVIDER_ONLY_CEILING,
    measure: async (ctx) => {
      const { chunks, entry } = await providerOnly(ctx)
      return firstPaintGzip(chunks, entry)
    },
  },
  {
    id: 'dev-chunks',
    order: 130,
    label: DEV_CHUNKS_LABEL,
    ceiling: 0,
    measure: async (ctx) => gate(devOnlyChunks([...(await providerOnly(ctx)).chunks.values()])),
  },
  {
    id: 'embedded',
    order: 140,
    label: EMBEDDED_LABEL,
    ceiling: EMBEDDED_CEILING,
    measure: async (ctx) => allChunksGzip((await embeddedGroup(ctx)).embedded.chunks),
  },
  {
    id: 'theme-only',
    order: 150,
    label: THEME_ONLY_LABEL,
    ceiling: THEME_ONLY_CEILING,
    measure: async (ctx) => allChunksGzip((await embeddedGroup(ctx)).themeOnly.chunks),
  },
  {
    id: 'feature-chunks',
    order: 160,
    label: FEATURE_CHUNKS_LABEL,
    ceiling: 0,
    measure: async (ctx) => {
      const { embedded, shortcuts } = await embeddedGroup(ctx)
      return gate([
        ...featureRuntimeChunks([...embedded.chunks.values()]),
        ...featureRuntimeChunks([...shortcuts.chunks.values()]).map(
          (name) => `shortcuts-help: ${name}`,
        ),
      ])
    },
  },
]
