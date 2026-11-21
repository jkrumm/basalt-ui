# Forms

basalt binds TanStack Form; the app owns its schema and its save. Props are in the generated docs: [useAppForm](node_modules/basalt-ui/docs/use-app-form.md), [withForm](node_modules/basalt-ui/docs/with-form.md), [FormField](node_modules/basalt-ui/docs/form-field.md), [FormSection](node_modules/basalt-ui/docs/form-section.md), [FormRow](node_modules/basalt-ui/docs/form-row.md), [FormFooter](node_modules/basalt-ui/docs/form-footer.md), [Stepper](node_modules/basalt-ui/docs/stepper.md), [FileUpload](node_modules/basalt-ui/docs/file-upload.md), [toSubmitErrors](node_modules/basalt-ui/docs/to-submit-errors.md), [useFormDraft](node_modules/basalt-ui/docs/use-form-draft.md).

## Ownership

- A submit form is `useAppForm` from `basalt-ui/form` (peer `@tanstack/react-form`) with a Standard Schema library (zod, valibot or arktype): `form.AppForm` around `form.Form`, each field a `form.AppField` rendering `f.FormField`, the actions in `form.Footer`. `form.Form` is the `<form noValidate>` that submits through `handleSubmit` and disables the fields while it submits, so a form never hand-writes either.
- A long form splits into components with `withForm`, each rendering its part of the one form. A control of the app's own renders as the child of `f.FormField`, which hands it the value and the change handler.
- A form control sits in a [FormField](node_modules/basalt-ui/docs/form-field.md): label required, description and error beneath. A filter is not a form field; it is a `spec` in a [FilterSet](node_modules/basalt-ui/docs/filter-set.md).

## Pick the shape

- A create or edit dialog, up to about five fields: `FormField`s stacked, two short related ones side by side in a `FormRow`, `form.Footer` at the end.
- A settings or edit page: one `FormSection` per group (title and a one-line description), its fields as settings rows, one `form.Footer sticky` after the last section.
- A settings page covers its domain, not the three fields the first read finds. List what the domain holds before the first section and give each a section: the people (members, roles, invites), the policies (defaults, limits, retention), the notifications (channels and what triggers them), the integrations, and a danger zone last whose destructive action (delete, transfer, reset) confirms in an [AlertDialog](node_modules/basalt-ui/docs/dialog.md) and names what it removes. A section of one or two rows joins its neighbour; a domain that fills five sections is five, and a page that covers three of them reads smaller than the app it settles (a rebuilt settings page came out with three short sections where the old build had five).
- A page of many groups: split it with `InnerNav` or `PageBar tabs`, one URL per part; never collapsible sections.
- Three or more steps taken in order: a `Stepper` over one form with one step mounted at a time (a `withForm` component per step); `form.Footer` with Back and Continue, the last primary names what it creates.
- Settings that apply at once: `FormField control={handle}` with a Switch or a Segmented; no footer.

- A settings row is `FormField layout="row"`: label and description at the start, the control at the end, stacked when the field is under 480px wide; a `FormSection` makes it the default for its fields. A switch or a checkbox stays at the end at every width.
- A group of more than five fields gets its own `FormSection`; a page with one short group can be one section with its own `footer`.
- A choice group is a RadioGroup or a CheckboxGroup with `options`, and every option carries its `description` line (what it does, what it costs), never a bare label and never a hand-built label: with labels alone, each choice reads as a word to guess.
- An attachment is a [FileUpload](node_modules/basalt-ui/docs/file-upload.md) with `accept` and `maxSize`; the upload itself is the app's, on submit.
- A free list of names (labels, tags) is a multiple Combobox (`basalt-ui/ui/combobox`) with ComboboxChips and `onCreate`, which offers a Create "x" row for text that matches no item.
- An input with a fixed unit or a leading icon names it with the Input's `start` or `end` (`basalt-ui/ui/input`), never a label suffix.

## Save

- One save per form, never one per section of a larger form, and never a form that both saves on a button and applies some fields at once.
- A field that applies at once is a Switch, a Segmented or a single select on a store handle; text, checkbox and radio groups, dates and multi-selects wait for Save.
- The primary stays enabled while the form is invalid or unchanged: a click validates, shows every error and moves focus to the first invalid control. `form.Footer` disables it only while it submits.
- A long settings page uses `form.Footer sticky`: the row stays in view and reads "Unsaved changes" while the form is dirty. Discard is `form.reset()`.

## Validation

- Put the schema on `onDynamic`: `useAppForm` runs it when a field is left, on every field at submit, and after a submit on every change, so a fix clears its error at once. A schema on `onSubmit` only keeps a stale error until the next submit.
- A server verdict is `onSubmitAsync` through [toSubmitErrors](node_modules/basalt-ui/docs/to-submit-errors.md): the `fieldErrors` envelope lands on the fields, the first error takes focus.
- A rule the server alone decides (a name already taken) adds `onDynamicAsync` and `onDynamicAsyncDebounceMs` to the same field; the sync schema runs first. A rule that depends on another field adds `onChangeListenTo`.
- A multi-step form validates the mounted step on Continue: `form.Form meta={{ step }}` submits with the step as meta (`onSubmitMeta` types it) and `onSubmit` moves on.
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
