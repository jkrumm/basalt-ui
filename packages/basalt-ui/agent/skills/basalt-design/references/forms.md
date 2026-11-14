# Forms

The app owns the form engine; basalt owns the shape around it. Props are in the generated docs: [FormField](docs/form-field.md), [FormRow](docs/form-row.md), [FormFooter](docs/form-footer.md), [toSubmitErrors](docs/to-submit-errors.md), [useFormDraft](docs/use-form-draft.md).

## Ownership

- The app depends on TanStack Form and a Standard Schema library (zod, valibot or arktype) and creates its forms; basalt ships no form hook and no peer for it. The shipped pieces read a structural form, so any v1 form fits.
- A form control sits in a [FormField](docs/form-field.md): label required, description and error beneath. A filter is not a form field; it is a `spec` in a [FilterSet](docs/filter-set.md).
- [FormRow](docs/form-row.md) is the horizontal label-and-control row of a settings or edit form; [FormField](docs/form-field.md) alone is the stacked form of a dialog or a phone. One form uses one of them.
- The footer is [FormFooter](docs/form-footer.md): the form-level error and an actions slot, with the primary action last.

## Validation

- Put the schema on `onDynamic` with `revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' })`: quiet until the first submit, live after it. A schema on `onSubmit` only shows nothing for a new invalid value until the next submit, and nothing lints it. This is taught, not guarded.
- A server verdict is `onSubmitAsync` through [toSubmitErrors](docs/to-submit-errors.md): the `fieldErrors` envelope lands on the fields, the first error takes focus.
- A rule the server alone decides (a name already taken) adds `onDynamicAsync` and `onDynamicAsyncDebounceMs` to the same field; the sync schema runs first. A rule that depends on another field adds `onChangeListenTo`.

## Drafts and leaving

- A submit-and-leave form with a textarea or more than three fields keeps a draft with [useFormDraft](docs/use-form-draft.md); the server value stays the form's default, so the form is dirty against it while a draft is applied.
- A settings form with a Save action keeps no draft. It guards leaving with the router's `useBlocker({ shouldBlockFn, enableBeforeUnload })`, comparing against the pristine values; the browser's unload text is generic.
- An instant-apply preference is a control on a store, not a form.

not guarded:

- Never validate on `onSubmit` alone, and never put the same schema on both `onSubmit` and `onDynamic`; every error appears twice.
- Never infer dirtiness from `isDefaultValue`: a field that was never mounted (a lazy tab, an accordion) reads as pristine and the draft is dropped.
- Never pair a draft with a Save-action form; it guards, it does not draft.
