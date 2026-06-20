---
source: basalt-ui
description: Client state conventions for basalt-ui apps — where each kind of state lives and the theme-scheme rule (localStorage-theme read is guarded). Mostly advisory.
paths:
  - 'src/**'
  - 'apps/**/src/**'
---

# Basalt State

How to place state in a basalt-ui app. The **theme-scheme rule** below is
guard-enforced (`basalt check-theme` bans `localStorage.getItem('theme')`); the rest is **advisory**.

## State placement

Pick the right home for each kind of state — don't dump everything into one store:

- **Server state** (API data) → TanStack Query (see basalt-query.md).
- **URL state** (filters, active tab, pagination, time window) → `validateSearch` in TanStack Router
  (see basalt-router.md). URL state is shareable and survives reload — prefer it for anything a user
  might link to.
- **Theme / color scheme** → `useMantineColorScheme()` from Mantine — **never** a client store, and
  **never** `localStorage.getItem('theme')`. The scheme persists to Mantine's own key and resolves the
  `--vx-*` tokens via CSS; reading it any other way breaks scheme reactivity and trips `basalt check-theme`.
- **UI preferences that must survive navigation but aren't URL-worthy** (sidebar collapsed, panel
  layout) → a small client store. `BasaltShell` already persists its own collapse state via
  `useLocalStorage` from `@mantine/hooks` — for one or two flags, `useLocalStorage` is enough; reach for
  a store (e.g. Zustand) only when shared, cross-component UI state genuinely warrants it.

## Client store pattern (when warranted)

If you adopt a store, keep it small and persist only what must survive reload:

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type UiState = {
  panelLayout: 'split' | 'stacked'
  setPanelLayout: (v: UiState['panelLayout']) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      panelLayout: 'split',
      setPanelLayout: (v) => set({ panelLayout: v }),
    }),
    { name: 'app-ui' },
  ),
)
```

basalt-ui does **not** ship or depend on a state library — this is a consumer choice. Resist putting
query results, derived data, or theme scheme in the store.

> **Forms** are covered by `basalt-forms.md` — see `./forms` (createForm, field, FormErrorSummary,
> useFormDraft). `@mantine/form` is an optional peer; install it with `bun add @mantine/form`.
