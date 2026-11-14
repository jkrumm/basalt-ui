// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:form-guard
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
// #endregion
