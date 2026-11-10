/**
 * Controls contract: the public types of `spec`, `filterSlot`, `FilterSet`, `ViewTabs`,
 * `ControlHome`, `FormField`, `useFormDraft`, `FormFooter` and `toSubmitErrors`. Types only, no
 * value symbols. Pinned by `check-contract-frozen`; a change needs a `chore: contract amendment`
 * commit. Sketched in docs/v3/concepts/controls-url-state.md section 5 and
 * docs/v3/concepts/state-persistence-forms.md section 6. The handle, slot and structural form
 * types live in `src/core/ports.ts`.
 */
import type { ReactNode } from 'react'
import type { ControlHandle, FieldLike, FormLike } from '../core/ports'

// ---- Specs (controls-url-state 5) ---------------------------------------------------------

/** Runtime option catalogue; same shape as `ControlHandle.options`. */
export type FilterOption<T> = { value: T; label: string }

// minimal; concept elides it
export type FilterScope = 'global' | 'page' | 'widget'

/** Product of `spec(handle, label, options)`. `Scope` lets a card slot reject a global spec. */
export type FilterSpec<T, Scope extends FilterScope = FilterScope> = {
  handle: ControlHandle<T>
  label: string
  scope: Scope
  options?: readonly FilterOption<T>[]
  clearable?: boolean
  placeholder?: string
  // minimal; concept elides it
  facets?: readonly { value: T; count: number }[]
  // minimal; concept elides it
  as?: string
}

/** Options argument of `spec(handle, label, options)`. */
export type SpecOptions<T> = Pick<
  FilterSpec<T>,
  'options' | 'clearable' | 'placeholder' | 'facets' | 'as'
>

// ---- Homes and presentation ---------------------------------------------------------------

export type ControlHome =
  | 'page-bar'
  | 'section-header'
  | 'view-mode'
  | 'card-header'
  | 'tool'
  | 'form-row'
  | 'aside'
  | 'sheet'
  | 'side-panel'
  | 'overlay'

export type ControlPresentation = 'pill' | 'row' | 'inline'

/** Never a `variant` prop. A `FilterSet` outside any `ControlHome` is `pill`. */
export type HomePresentation = {
  'page-bar': 'pill'
  'section-header': 'pill'
  'view-mode': 'pill'
  'card-header': 'inline'
  tool: 'inline'
  'form-row': 'row'
  aside: 'row'
  sheet: 'row'
  'side-panel': 'row'
  overlay: 'row'
}

export type ControlHomeProps = { home: ControlHome; children?: ReactNode }

export type FilterSetProps = {
  // `any` is the concept's `FilterSpec<any>[]`: handles of different `T` share one list
  // oxlint-disable-next-line typescript/no-explicit-any
  specs: readonly FilterSpec<any>[]
}

export type ViewTabsProps<T extends string = string> = { handle: ControlHandle<T> }

// ---- Forms (state-persistence-forms 6) ----------------------------------------------------

type FormFieldBase = { label: string; children?: ReactNode }

/** Two arms: a TanStack-shaped `field`, or a store-bound `control`. */
export type FormFieldProps<T = unknown> = FormFieldBase &
  ({ field: FieldLike<T>; control?: never } | { control: ControlHandle<T>; field?: never })

// Mirrors the Standard Schema spec (and `src/register.ts`) so any schema library's result unifies;
// declared here because a pinned contract cannot import 2.x implementation files.
export type SchemaIssue = {
  readonly message: string
  readonly path?: readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined
}

export type StandardSchemaV1<Input = unknown, Output = Input> = {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (
      value: unknown,
    ) =>
      | { readonly value: Output; readonly issues?: undefined }
      | { readonly issues: readonly SchemaIssue[] }
      | Promise<
          | { readonly value: Output; readonly issues?: undefined }
          | { readonly issues: readonly SchemaIssue[] }
        >
    readonly types?: { readonly input: Input; readonly output: Output } | undefined
  }
}

export type UseFormDraftOptions<V> = {
  key: string
  version: number
  schema: StandardSchemaV1<unknown, V>
  owner: string | null
}

export type UseFormDraftResult = { status: 'none' | 'restored'; clear(): void }

/** `actions` slot: max 5, one `primary` = submit. */
export type FormAction = {
  label: string
  onClick?: () => void
  primary?: boolean
}

export type FormFooterProps = {
  form: FormLike<unknown>
  actions: readonly FormAction[]
}

/** What `toSubmitErrors(save)` resolves to for the form's `onSubmitAsync`. */
export type SubmitErrors = { form?: string; fields?: Record<string, string> }

/** Return of `toSubmitErrors(save)`. */
export type ToSubmitErrors<V> = (a: { value: V }) => Promise<SubmitErrors | undefined>
