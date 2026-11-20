/**
 * The field and form contexts of basalt's form hook. One pair for the whole package: the parts in
 * `parts.tsx` read them and `createFormHook` in `hook.ts` provides them through `AppField` and
 * `AppForm`, so a part rendered outside those providers throws TanStack's own error.
 */
import { createFormHookContexts } from '@tanstack/react-form'

export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts()
