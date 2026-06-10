---
source: basalt-ui
description: Client state + forms conventions for basalt-ui apps — where each kind of state lives, the theme-scheme rule (localStorage-theme read is guarded), and the form/Zod pattern. Mostly advisory.
paths:
  - 'src/**'
  - 'apps/**/src/**'
---

# Basalt State & Forms

How to place state in a basalt-ui app, plus the form pattern. The **theme-scheme rule** below is
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

## Forms — Mantine form + Zod

```ts
import { useForm } from '@mantine/form'
import { z } from 'zod'
import { zodResolver } from '../lib/zod-resolver'

const Schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().min(0),
})

const form = useForm({
  initialValues: { date: '', amount: 0 },
  validate: zodResolver(Schema),
})
```

### zodResolver

`@mantine/form` v9 does not export a Zod resolver. Define one shared helper in `src/lib/zod-resolver.ts`
and always import it — never redefine it inline:

```ts
import type { UseFormInput } from '@mantine/form'
import { z } from 'zod'

export function zodResolver<T>(schema: z.ZodType<T>): UseFormInput<T>['validate'] {
  return (values) => {
    const result = schema.safeParse(values)
    if (result.success) return {}
    const errors: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const path = issue.path.join('.')
      if (path !== '') errors[path] = issue.message
    }
    return errors
  }
}
```

### List helpers

For dynamic lists: `form.insertListItem('items', {...})` / `form.removeListItem('items', index)`. Access
via `form.values.items[index]` and bind with `form.getInputProps('items.0.field')`.

### Submission

```ts
form.onSubmit((values) => mutation.mutate(values))
```

Reset after success with `form.reset()` — never mutate `form.values` directly. Surface validation as
inline field errors; toast only on submit-level failures. See basalt-query.md for the
mutation/invalidation pattern and basalt-mantine.md for the in-button success feedback.
