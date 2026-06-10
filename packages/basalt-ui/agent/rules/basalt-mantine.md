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
- The theme reskins **every** Mantine accent to a Blueprint family and binds Mantine's surface vars to
  the same `--vx-*` tokens the charts use (`cssVariablesResolver`, pre-wired in `BasaltProvider`), so
  chrome and charts share one scheme-reactive identity. Don't add a second `cssVariablesResolver`.
- Color scheme: read/write via `useMantineColorScheme()`. **Never** read the color scheme from
  localStorage directly, and never `localStorage.getItem('theme')` — see basalt-state.md.
- Owned `spacing`/`radius` scales and the `fontWeights` ladder live in the theme — consume them as
  tokens (`p="md"`, `radius="sm"`, `fw="semibold"`), not raw numbers (see basalt-tokens.md).

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
- **DatePickerInput**: from `@mantine/dates` (an optional peer). In v9 it uses string values
  (`YYYY-MM-DD`) for `value`/`onChange` — no `Date` conversion. The theme applies its `md` default only
  if you install/render it.
- **Responsive chart sizing**: `useElementSize` from `@mantine/hooks` (replaces `@visx/responsive`).

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
