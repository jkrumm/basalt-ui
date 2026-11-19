# Forms

The app owns the form engine; basalt owns the shape around it. Props are in the generated docs: [FormField](node_modules/basalt-ui/docs/form-field.md), [FormSection](node_modules/basalt-ui/docs/form-section.md), [FormRow](node_modules/basalt-ui/docs/form-row.md), [FormFooter](node_modules/basalt-ui/docs/form-footer.md), [Stepper](node_modules/basalt-ui/docs/stepper.md), [FileUpload](node_modules/basalt-ui/docs/file-upload.md), [toSubmitErrors](node_modules/basalt-ui/docs/to-submit-errors.md), [useFormDraft](node_modules/basalt-ui/docs/use-form-draft.md).

## Ownership

- The app depends on TanStack Form and a Standard Schema library (zod, valibot or arktype) and creates its forms; basalt ships no form hook, no adapter and no peer for it. `FormField field={f}` takes a TanStack field as it is, so a `form.Field` render prop is the whole binding.
- A TanStack form is a plain `<form noValidate>` whose `onSubmit` calls `form.handleSubmit()`; never the ui Form (`basalt-ui/ui/field`), whose native validation stops the submit before the engine sees it.
- A form control sits in a [FormField](node_modules/basalt-ui/docs/form-field.md): label required, description and error beneath. A filter is not a form field; it is a `spec` in a [FilterSet](node_modules/basalt-ui/docs/filter-set.md).

## Pick the shape

- A create or edit dialog, up to about five fields: `FormField`s stacked, two short related ones side by side in a `FormRow`, `FormFooter` at the end.
- A settings or edit page: one `FormSection` per group (title and a one-line description), its fields as settings rows, one `FormFooter sticky` after the last section.
- A page of many groups: split it with `InnerNav` or `PageBar tabs`, one URL per part; never collapsible sections.
- Three or more steps taken in order: a `Stepper` over one form with one step mounted at a time; `FormFooter` with Back and Continue, the last primary names what it creates.
- Settings that apply at once: `FormField control={handle}` with a Switch or a Segmented; no footer.

- A settings row is `FormField layout="row"`: label and description at the start, the control at the end, stacked when the field is under 480px wide; a `FormSection` makes it the default for its fields. A switch or a checkbox stays at the end at every width.
- A group of more than five fields gets its own `FormSection`; a page with one short group can be one section with its own `footer`.
- Choices with a hint line are a RadioGroup or a CheckboxGroup with `options`, a `description` per option, never a hand-built label.
- An attachment is a [FileUpload](node_modules/basalt-ui/docs/file-upload.md) with `accept` and `maxSize`; the upload itself is the app's, on submit.
- A free list of names (labels, tags) is a multiple Combobox (`basalt-ui/ui/combobox`) with ComboboxChips and `onCreate`, which offers a Create "x" row for text that matches no item.
- An input with a fixed unit or a leading icon names it with the Input's `start` or `end` (`basalt-ui/ui/input`), never a label suffix.

## Save

- One save per form, never one per section of a larger form, and never a form that both saves on a button and applies some fields at once.
- A field that applies at once is a Switch, a Segmented or a single select on a store handle; text, checkbox and radio groups, dates and multi-selects wait for Save.
- The primary stays enabled while the form is invalid or unchanged: a click validates, shows every error and moves focus to the first invalid control. `FormFooter` disables it only while it submits.
- A long settings page uses `FormFooter sticky`: the row stays in view and reads "Unsaved changes" while the form is dirty. Discard is `form.reset()`.

## Validation

- Put the schema on `onDynamic` with `revalidateLogic({ mode: 'blur', modeAfterSubmission: 'change' })`: a field checks when it is left, every field on submit, and after a submit on every change, so a fix clears its error at once. A schema on `onSubmit` only keeps a stale error until the next submit, and nothing lints it. This is taught, not guarded.
- A server verdict is `onSubmitAsync` through [toSubmitErrors](node_modules/basalt-ui/docs/to-submit-errors.md): the `fieldErrors` envelope lands on the fields, the first error takes focus.
- A rule the server alone decides (a name already taken) adds `onDynamicAsync` and `onDynamicAsyncDebounceMs` to the same field; the sync schema runs first. A rule that depends on another field adds `onChangeListenTo`.
- A multi-step form validates the mounted step on Continue: submit with the step as meta (`handleSubmit({ step })`) and move on in `onSubmit`.
- Mark the minority: an asterisk on required fields when most are optional; a form where every field is required says so once in its description instead.

## Drafts and leaving

- A submit-and-leave form with a textarea or more than three fields keeps a draft with [useFormDraft](node_modules/basalt-ui/docs/use-form-draft.md); the server value stays the form's default, so the form is dirty against it while a draft is applied.
- A settings form with a Save action keeps no draft. It guards leaving with the router's `useBlocker({ shouldBlockFn, enableBeforeUnload })`, comparing against the pristine values; the browser's unload text is generic.
- An instant-apply preference is a control on a store, not a form.

not guarded:

- Never validate on `onSubmit` alone, and never put the same schema on both `onSubmit` and `onDynamic`; every error appears twice.
- Never infer dirtiness from `isDefaultValue`: a field that was never mounted (a lazy tab, an accordion) reads as pristine and the draft is dropped.
- Never pair a draft with a Save-action form; it guards, it does not draft.
- Never put a long form in a dialog; more than about five fields is a page.
