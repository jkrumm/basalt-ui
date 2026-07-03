---
source: basalt-ui
description: Mantine v9 usage conventions for basalt-ui apps — provider order, the Vx bridge, component defaults, and interaction feedback. Partly enforced by-construction via createBasaltTheme.
paths:
  - 'src/**'
  - 'apps/**/src/**'
---

# Basalt Mantine — Usage Conventions

basalt-ui is a framework for Mantine v9 apps. `createBasaltTheme` and `BasaltProvider` encode most of
the theming opinion **by construction** — this rule covers the conventions the framework can't enforce
in code.

## Provider order

Mount `BasaltProvider` (which wraps `MantineProvider` + injects the palette `<style>` + bridges the Vx
tokens) at the top of the tree, before the router. A typical `main.tsx` stack, top to bottom:

1. `BasaltProvider` (Mantine + palette CSS + Vx bridge; pass `theme={createBasaltTheme(overrides)}`)
2. `Notifications` (from `@mantine/notifications`) — optional
3. `ModalsProvider` (from `@mantine/modals`) — optional
4. data layer (e.g. `QueryClientProvider`)
5. `RouterProvider`

Never wrap `BasaltProvider` inside the router — Mantine's context must be available before any route
renders.

## Theming

- Use `createBasaltTheme(overrides?)` for the theme — it merges your overrides over `baseTheme`
  (last-wins), so you can retune any field without forking. Don't hand-build `createTheme`.
- The theme reskins **every** Mantine accent to the Basalt identity — **lifted zinc-charcoal** ramps
  (volcanic basalt; dark surfaces neutral/faint-cool, the light canvas + chart neutrals warm-neutral)
  plus a **single muted slate-blue accent** — and binds Mantine's surface vars to the same `--vx-*`
  tokens the charts use (`cssVariablesResolver`, pre-wired in `BasaltProvider`), so chrome and charts
  share one scheme-reactive identity. (Blueprint is the historical hue-tuning ancestor; the identity
  is Basalt zinc-charcoal now.) Don't add a second `cssVariablesResolver`.
- Color scheme: read/write via `useMantineColorScheme()`. **Never** read the color scheme from
  localStorage directly, and never `localStorage.getItem('theme')` — see basalt-state.md.
- Owned `spacing`/`radius` scales and the `fontWeights` ladder live in the theme — consume them as
  tokens (`p="md"`, `radius="sm"`, `fw="semibold"`), not raw numbers (see basalt-tokens.md).

## Color & accent restraint

Restraint is the #1 lever — neutrals carry the surface, the accent only points. The palette is
**one muted slate-blue accent** over lifted zinc-charcoal; the neutrals do ~90% of the work
(60/30/10, pushed toward 90/10).

- **The accent appears ONLY on**: the single primary CTA per view, focus rings, links, and small
  status pops. It does **NOT** appear on active nav, borders, large fills, every icon, or
  secondary/routine buttons. Don't flood blue — "ink earns its color."
- **Active nav = neutral surface fill** + plain text + a weight bump, **never the accent**. This is
  baked into the theme's NavLink defaults (`--nl-*` vars) and holds for _every_ render path,
  including a consumer's router `<Link>` passed via `renderNavLink` — so "blue active nav
  everywhere" can't return. Don't re-color the active state back to the accent.
- **Buttons**: the primary action = filled accent (`variant="filled"`), **exactly one per view**.
  Every other/secondary action = `variant="default"` (neutral). Do **not** use a colored
  `variant="light"` for routine actions — it reads washed-out on the warm light canvas.
- **Status hues stay muted/forest.** Positive deltas use `color="green"` (forest green), never
  `color="teal"` (vivid turquoise) or a saturated emerald. Status (`red`/`green`/`orange`/`yellow`)
  is for signal only, kept muted — never raw Material/AntD.
- **Dark mode** is a lifted neutral/faint-cool zinc-charcoal — not steel-blue, not pure black, and
  lighter than a near-black so cards/borders separate. Lift elevation via small lightness steps; the
  accent uses its lighter shade on dark to avoid glow/bleed.
- **Light mode** is never pure-white page + pure-black text (harsh halation). Page = near-neutral
  off-white (`#fafafa` — only a whisper of warmth, not a creamy/yellow cast), cards = white
  (`#ffffff`) that lift above it, soft low-contrast hairline (`#ededec`), text = near-black
  (`#121110`). Hairline borders; shadows reserved for genuinely floating elements.

## Bridging Mantine ↔ charts

Charts are Mantine-free, but their color scheme must track Mantine's toggle. `BasaltProvider` already
bridges this. If you compose the providers manually, one — and only one — file may import both
`@mantine/core` and `basalt-ui/charts` to read the scheme and feed `VxThemeProvider`:

```tsx
import { useMantineColorScheme } from '@mantine/core'
import { VxThemeProvider } from 'basalt-ui/charts'

export function VxBridge({ children }: { children: React.ReactNode }) {
  const { colorScheme } = useMantineColorScheme()
  const resolved = colorScheme === 'auto' ? 'dark' : colorScheme
  return <VxThemeProvider colorScheme={resolved}>{children}</VxThemeProvider>
}
```

Route components import chart primitives directly from `basalt-ui/charts` — never from the bridge file.

## Component conventions

- **Shell**: `BasaltShell` wraps every page (compose it once at the root). Don't add another shell
  inside a page. Wire nav badges with `NavCountBadge`.
- **Layout**: prefer `Stack`/`Group`/`SimpleGrid` over manual flex/grid CSS.
- **Notifications**: `notifications.show(...)` from `@mantine/notifications` — never roll a custom toast.
- **Modals**: `modals.openConfirmModal(...)` for destructive actions; `modals.open(...)` for forms.
- **Inputs**: from `@mantine/core` (`TextInput`, `Select`, `Combobox`, …). Don't use native `<select>`.
  The theme defaults inputs to `md` (16px font) so iOS Safari never zooms on focus.
- **DatePickerInput**: from `@mantine/dates` (if you separately install it). In v9 it uses string
  values (`YYYY-MM-DD`) for `value`/`onChange` — no `Date` conversion.
- **Responsive chart sizing**: use `ResponsiveChart` or `useChartSize` from `basalt-ui/charts`
  (see basalt-charts.md). Never `useElementSize` from `@mantine/hooks` in a chart file (Mantine is
  banned inside `charts/**`), and never raw `@visx/responsive` outside `charts/**`.

## Strict surfaces & layout primitives

The theme runs a **strict surface system**: Mantine components don't chain through
`--mantine-color-default-*` — each reads a **raw ramp step** directly — so `cssVariablesResolver`
**collapses the ramp steps onto the basalt tokens**. Light borders (`--mantine-color-gray-2/3/4`)
and dark borders (`--mantine-color-dark-4`) both resolve to `--vx-surface-border`; light
hover/subtle steps (`--mantine-color-gray-0/1`) resolve to the `--vx-surface-subtle` token;
`Card`/`Paper` backgrounds are forced to `--vx-surface-panel` via theme `styles` (Mantine otherwise
defaults card bg to the page body color, so cards blend into the page); `--app-shell-border-color`
is pinned to `--vx-surface-border`. Net: **one border shade, one card background, one radius
(`--vx-radius-card`) across every surface** — AppShell, Table, Input, Divider, Tabs, Popover,
Accordion, cards. The agent cannot reintroduce a divergent border/bg (no more off-system
`#aba59c`). Surfaces must come from `VX.surface.*` / `withBorder` + the radius token — **never**
inline `border`/`borderRadius`/`backgroundColor`/`boxShadow`, and never a raw Mantine ramp-step var
(`var(--mantine-color-gray-N)`).

- **Use Mantine primitives, not raw HTML.** To keep padding/spacing/radius/colors consistent,
  consumer code must compose Mantine layout/surface primitives — `Box`, `Flex`, `Grid`,
  `SimpleGrid`, `Stack`, `Group`, `Paper`, `Card` — instead of raw `<div>`/`<span>` with inline
  `style`. Raw HTML with inline layout/surface styling defeats the token system.
- **Mechanical enforcement.** `basalt check-theme` now adds four guard kinds (each a config knob,
  default ON; `theme-allow` line-comment escape): `off-system-surface-var` (raw ramp-step vars),
  `raw-html-layout` (raw `<div>`/`<span>` with inline layout/surface styling), `inline-spacing`
  (inline spacing literals), `inline-display` (inline `display` literals). The Mantine-free
  `src/charts/**` is the only place raw `<div>` is allowed — and it must still use `VX.*` tokens.

## Elevation, density & shape

basalt-ui targets dense, professional surfaces (a terminal, not a marketing page). The depth and
shape doctrine lives here; the spacing/radius/type **tokens** are in basalt-tokens.md.

- **Density is the point** (Linear/Notion). Sections separate by surface change and hairlines, not
  by large air — default to the tighter spacing step. The shipped dense defaults: shell header
  **48px**, navbar width **224** (collapsed **64**) with **`sm` (12px)** padding; sidebar section
  gap **`sm`**, compact nav rows (`--nl-padding: 6px 8px`, `min-height: 30px`, `sm` font), brand row
  32px. Pages: KPI/card padding **`sm` (12px)**, page `Stack`/`SimpleGrid` gaps **`sm`**; ChartCard
  header/body padding stays tight (`8px 12px`).
- **Surface single-source.** All cards — Mantine `Card`/`Paper` **and** the Mantine-free
  `ChartCard` — resolve to **one border token** (`--vx-surface-border`) and **one radius token**
  (`--vx-radius-card` = `radius.md` = **8px**), rendered **flat** (no `boxShadow`). Cards must never
  diverge: same border, same radius, no shadow. Never inline-override `border`/`borderRadius`/
  `boxShadow`/`backgroundColor` on a surface — use `withBorder` + the radius token (`radius="md"` /
  `var(--vx-radius-card)`) + `VX.surface.*`. Mechanically enforced by `basalt check-theme`'s
  `raw-surface` guard. Outer spacing comes from the parent `Stack`/`SimpleGrid` gap, not an
  intrinsic card margin.
- **Depth = surface + hairline, never drop shadows** (Linear/Carbon discipline). Elevation tiers:
  0 flat (no border/shadow — body, page bg); 1 surface (`surface-1` on `canvas` — cards, panels);
  2 elevated (`surface-2` + 1px hairline — chart areas, tooltips, lifted cards); 3 focus (2px
  primary outline — focused control). `Card`/`Paper` default to `withBorder` with **no** shadow,
  and the Mantine-free `ChartCard` matches them (flat, same border + `--vx-radius-card` radius). All
  cards are flat by design — there is no default card shadow token. (Genuinely floating elements —
  modals, popovers, menus — get their elevation from Mantine's own shadow scale, not from a card.)
- **Tight radii read precise/technical** (Linear): `sm` for controls, `md` for cards, `pill` for
  badges. Consume the token, never a raw number (basalt-tokens.md).
- **Type is carried by size + weight** — system-sans (no display/body split), numbers in the mono
  tabular stack so metric columns align (a Coinbase pattern).

## Composing the shell from sub-components

`BasaltShell` is the canonical single-mount. When a fully custom layout is needed, the shell
sub-components are available individually from `basalt-ui`:

- `AppSidebar` — desktop sidebar (sections, collapse, brand, footer/settings extras)
- `MobileNav` — bottom-tab mobile nav
- `AppBreadcrumbs` — breadcrumb bar (reads from `useRouterBreadcrumbs` or a manual trail)
- `PageHeaderProvider` + `PageActions` + `PageActionsOutlet` — portal-based page action slots
- `NavCountBadge` — count badge for sidebar nav items

```tsx
import {
  AppSidebar,
  MobileNav,
  AppBreadcrumbs,
  PageHeaderProvider,
  PageActionsOutlet,
  NavCountBadge,
} from 'basalt-ui'

function CustomShell({ children }: { children: React.ReactNode }) {
  return (
    <PageHeaderProvider>
      <AppSidebar sections={sections} brand={brand} renderNavLink={renderNavLink} />
      <MobileNav sections={mobileSections} renderNavLink={renderNavLink} />
      <main>
        <AppBreadcrumbs />
        <PageActionsOutlet />
        {children}
      </main>
    </PageHeaderProvider>
  )
}
```

Prefer `BasaltShell` unless the layout genuinely diverges — it already composes all of the above
with the correct wiring (collapse persistence, mobile breakpoint, breadcrumb integration).

## Icons

basalt-ui takes icons as `ReactNode` (no icon dependency shipped). Use a single icon library across the
app — `@tabler/icons-react` pairs cleanly with Mantine. Size via the icon's `size` prop (`size={16}`),
not CSS.

## Interaction feedback (micro-animations)

Every action button (Save, Log, Add, Delete, Toggle) must give immediate visual confirmation — silent
success feels broken. Three layers, applied together:

1. **In-flight state** — `loading` prop on `<Button>` (built-in spinner). Disables clicks automatically.
2. **Post-success state on the trigger itself** — flip the button briefly: swap label `Save → Saved`,
   set `color="green"` (the success status hue — never `teal`/`violet`, which the theme guard rejects as
   off-identity), reveal an `IconCheck` via `<Transition mounted={justSaved} transition="pop"
duration={180}>`. Hold ~1.2–1.5s, then reset. The user's eye is on the thing they clicked — feedback
   lands there, not only in a corner toast.
3. **Toast (`notifications.show`)** — only for outcomes the user might miss (writes that succeed
   off-screen, errors, async background work). Don't toast trivial UI toggles. `autoClose` ≤ 2000ms for
   success; errors stay until dismissed.

Guidelines:

- Durations: 120–200ms for state flips, 180–250ms for `Transition`, never above 300ms (feels laggy).
- Never animate layout-shifting properties (height, width) on buttons — animate `transform`, `opacity`,
  `color`, `background`.
- A button that turns into a check **is** the confirmation; the toast is for context the user can't see.
- Destructive actions: `modals.openConfirmModal` first, then the same in-button success pattern after.
- Form errors: prefer inline field errors over toast; toast only for submit-level failures.

## Motion (`motion`)

basalt-ui ships `motion` (motion.dev, formerly framer-motion) as a bundled dependency — the same
precedent as `@visx/*`: an internal implementation detail, not a peer the consumer opts into.
`ThemeToggle` is the first consumer (icon morph + direct-select popover reveal).

- **Reach for Mantine's own `<Transition>`** (above) for simple mount/unmount fades/pops — it's
  already there, needs no import. **Reach for `motion`** when the interaction needs something
  `Transition` can't do: crossfade between two different elements (not just show/hide one),
  spring physics, or a gesture-driven reveal.
- **Import from `motion/react`, never the raw `framer-motion` package** — `motion` re-exports it,
  but a direct `framer-motion` import bypasses the pinned/vetted specifier. Enforced by oxlint
  `no-restricted-imports` (repo-local and the shipped consumer preset).
- **Never a hardcoded duration/spring/ease literal in a `transition={{...}}` prop.** Import
  `MOTION_DURATION` / `MOTION_SPRING` / `MOTION_EASE_STANDARD` from `basalt-ui` instead — the
  motion analog of routing color through `VX.*`. `MOTION_DURATION` is capped at 0.3s (300ms),
  matching the interaction-feedback ceiling above. Mechanically enforced by `basalt check-theme`'s
  `raw-motion-value` guard (default ON; `theme-allow` line-comment escape).
- **Always branch on `useReducedMotion`** (`@mantine/hooks`) — render a real unanimated code path
  (no `motion.*` wrapper at all), not just `transition={{ duration: 0 }}`. See `ThemeToggle`'s
  `SchemeGlyph` for the pattern.
- **Restraint applies to motion too.** Subtle and purposeful — a state change earns a transition,
  idle chrome does not. Never a looping/pulsing idle animation.
