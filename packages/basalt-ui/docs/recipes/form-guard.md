---
name: form-guard
use-when: a form with a Save action must not be left with unsaved edits, by a link, Back or a closed tab
file: apps/playground/src/recipes/form-guard.tsx
---

A guard is `useBlocker` over one boolean, and basalt ships no symbol for it: the registry of dirty forms and the dialog stay app code.
`shouldBlockFn` returns the form's dirty state and `enableBeforeUnload` asks the browser to confirm a closing tab, with its own generic text. `withResolver` hands back `proceed` and `reset`, which the dialog answers.
Compare `values` to `options.defaultValues` structurally. `isDefaultValue` reads true for a field that never mounted, so a lazy tab hides an edit from it.
A form with a Save action is guarded, never drafted: a reload loses the edit, and a draft would save one the person never chose to keep. A form that submits and leaves (a long textarea, many fields) takes `useFormDraft` instead.

```tsx
import { evaluate, useStore } from '@tanstack/react-form'
import type { AnyFormApi } from '@tanstack/react-form'
import { useBlocker } from '@tanstack/react-router'
import { AlertDialog, AlertDialogContent, DialogClose } from 'basalt-ui/ui/dialog'
import { Button } from 'basalt-ui/ui/button'
import type { ReactElement } from 'react'

/** Blocks leaving the route while the form differs from its defaults. */
export function useUnsavedGuard(form: AnyFormApi): ReactElement {
  const dirty = useStore(form.store, (s) => !evaluate(s.values, form.options.defaultValues))
  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
    enableBeforeUnload: () => dirty,
    withResolver: true,
  })
  return (
    <AlertDialog open={blocker.status === 'blocked'}>
      <AlertDialogContent title="Discard unsaved changes?" description="Leaving drops them.">
        <DialogClose render={<Button variant="secondary" onClick={() => blocker.reset?.()} />}>
          Keep editing
        </DialogClose>
        <DialogClose render={<Button variant="danger" onClick={() => blocker.proceed?.()} />}>
          Discard
        </DialogClose>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```
