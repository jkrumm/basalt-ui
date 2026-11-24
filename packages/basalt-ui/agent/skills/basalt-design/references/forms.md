# Forms

basalt binds TanStack Form; the app owns its schema and its save. Props are in the generated docs: [useAppForm](node_modules/basalt-ui/docs/use-app-form.md), [withForm](node_modules/basalt-ui/docs/with-form.md), [FormField](node_modules/basalt-ui/docs/form-field.md), [FormSection](node_modules/basalt-ui/docs/form-section.md), [FormRow](node_modules/basalt-ui/docs/form-row.md), [FormFooter](node_modules/basalt-ui/docs/form-footer.md), [FormActionRow](node_modules/basalt-ui/docs/form-action-row.md), [FormConfirmRow](node_modules/basalt-ui/docs/form-confirm-row.md), [FormGroupRow](node_modules/basalt-ui/docs/form-group-row.md), [SettingsLayout](node_modules/basalt-ui/docs/settings-layout.md), [Stepper](node_modules/basalt-ui/docs/stepper.md), [FileUpload](node_modules/basalt-ui/docs/file-upload.md), [toSubmitErrors](node_modules/basalt-ui/docs/to-submit-errors.md), [useFormDraft](node_modules/basalt-ui/docs/use-form-draft.md).

## Ownership

- A submit form is `useAppForm` from `basalt-ui/form` (peer `@tanstack/react-form`) with a Standard Schema library (zod, valibot or arktype): `form.AppForm` around `form.Form`, each field a `form.AppField` rendering `f.FormField`, the actions in `form.Footer`. `form.Form` is the `<form noValidate>` that submits through `handleSubmit` and disables the fields while it submits, so a form never hand-writes either.
- A long form splits into components with `withForm`, each rendering its part of the one form. A control of the app's own renders as the child of `f.FormField`, which hands it the value and the change handler.
- **One form API is taught: `useAppForm`** (`f.FormField`, `form.Footer`). The `FormField field={f}` and `FormFooter form={form}` of `basalt-ui/controls` are the structural port it binds; reach for them only where `@tanstack/react-form` is not installed. `FormField control={handle}` is the other source: a store handle, or a synced state's `field(key)`, that applies at once.
- A form control sits in a [FormField](node_modules/basalt-ui/docs/form-field.md): label required, description and error beneath. A filter is not a form field; it is a `spec` in a [FilterSet](node_modules/basalt-ui/docs/filter-set.md).

## Pick the shape

- A create or edit dialog, up to about five fields: `FormField`s stacked, two short related ones side by side in a `FormRow`, `form.Footer` at the end.
- A settings or edit page: a [SettingsLayout](node_modules/basalt-ui/docs/settings-layout.md) (title, one line) over one `FormSection` per group: a heading row (title, optional `badge` and `action`, one muted line) above one bordered box of rows divided by hairlines. One `form.Footer floating` after the last section is the unsaved bar (Discard, Save), shown only while the form is dirty.
- A row is label and help at the start and one control at the end, 18rem wide, stacked below the `regular` tier. A control that needs the width (a tag input, a table) takes `layout="stack"`: it sits on a second line under the label. `icon` puts a tile at the start. Give a row an `id` when a link can point at it: `#row-id` scrolls to it and marks it once.
- A row that runs a command is `FormActionRow` (`tone="danger"` for a destructive one); one that destroys data asks for its name first, `FormConfirmRow`; a setting that fans out into switches is `FormGroupRow`, an expandable row (never an expandable section). A section behind a plan or a permission is `locked="why"`: dimmed, disabled, the way out in `action`.
- A hit on a setting's name is an `InnerNav` item whose `href` is the section's link plus `#row-id`; the search that finds it is the app's.
- A settings page covers its domain, not the three fields the first read finds. List what the domain holds before the first section and give each a section: the people (members, roles, invites), the policies (defaults, limits, retention), the notifications (channels and what triggers them), the integrations, and a danger zone last whose destructive action (delete, transfer, reset) confirms in an [AlertDialog](node_modules/basalt-ui/docs/dialog.md) and names what it removes. A section of one or two rows joins its neighbour; a domain that fills five sections is five,, and a page that covers three of them reads smaller than the app it settles.
- A page of many groups: split it with `InnerNav` or `PageBar tabs`, one URL per part; never collapsible sections.
- Three or more steps taken in order on a page: a `Stepper` over one form with one step mounted at a time (a `withForm` component per step); `form.Footer` with Back and Continue, the last primary names what it creates.
- A record created in three or more steps, where the user should see it take shape (a contract, a workspace, an invoice): a [WizardDialog](node_modules/basalt-ui/docs/wizard-dialog.md) in `DialogContent size="split"`, a live preview beside the stepped form and a review step at the end; `basalt-ui add create-flow` writes one. Pick an option on a step with a [ChoiceCard](node_modules/basalt-ui/docs/choice-card.md).
- Settings that apply at once: `FormField control={handle}` with a Switch, a Segmented or a single select; no footer.

- A settings row is `FormField layout="row"`: label and description at the start, the control at the end, stacked when the field is under 480px wide; a `FormSection` makes it the default for its fields. A switch or a checkbox stays at the end at every width.
- A group of more than five fields gets its own `FormSection`; a page with one short group can be one section with its own `footer`.
- A choice group is a RadioGroup or a CheckboxGroup with `options`, and every option carries its `description` line (what it does, what it costs), never a bare label and never a hand-built label: with labels alone, each choice reads as a word to guess.
- An attachment is a [FileUpload](node_modules/basalt-ui/docs/file-upload.md) with `accept` and `maxSize`; the upload itself is the app's, on submit.
- A free list of names (labels, tags) is a multiple Combobox (`basalt-ui/ui/combobox`) with ComboboxChips and `onCreate`, which offers a Create "x" row for text that matches no item.
- An input with a fixed unit or a leading icon names it with the Input's `start` or `end` (`basalt-ui/ui/input`), never a label suffix.

## Controls on one line

- Every control takes the same `size`, `md` or `sm`, and a size is one height whichever control draws it; never set a control's height with a class.
- A button inside a field (`Input` `end`: reveal, clear, copy) acts on that field only; one that reaches further sits beside the field in a group. A password is a `PasswordInput`, a value to copy takes a `CopyButton`.
- Two to five actions that read as one control (previous, today, next) are a [ButtonGroup](node_modules/basalt-ui/docs/control-group.md): fused edges, one size and variant for all.
- Different controls that make one request (a field and the select that scopes it, a search and its button) are a `ControlGroup`, 2 px apart; `fill` spreads them over the row and `className="grow-0"` keeps one at its own width.
- A prefix or a unit outside the field edge (`https://`, `EUR`, a unit select) is an `InputGroup` with an `InputAddon`; the field's name says what the addon says ("Price in EUR").
- A group sets `size` (and a ButtonGroup `variant`) for its children; a child that passes its own keeps it.

- Options with a hint, price or picture: `variant="card"` or `"tile"` on `RadioGroup`/`CheckboxGroup`. A role grid: [CheckboxMatrix](node_modules/basalt-ui/docs/checkbox-matrix.md). Free values: [TagInput](node_modules/basalt-ui/docs/tag-input.md). A code: [OneTimeCode](node_modules/basalt-ui/docs/one-time-code.md), error on the whole code.
- One palette color: [SwatchPicker](node_modules/basalt-ui/docs/swatch-picker.md). Shortcut values beside a field: [QuickPicks](node_modules/basalt-ui/docs/quick-picks.md).

## Save

- Two save models, never on one row: a row bound to a store control (`control=`) applies at once and has no footer; a section or page bound to a form (`field=`, `f.FormField`) saves through one floating unsaved bar. One save per form, never one per section of a larger form.
- A field that applies at once is a Switch, a Segmented or a single select on a store handle; text, checkbox and radio groups, dates and multi-selects wait for Save.
- The primary stays enabled while the form is invalid or unchanged: a click validates, shows every error and moves focus to the first invalid control. `form.Footer` disables it only while it submits.
- A long settings page uses `form.Footer floating`: the bar appears at the bottom while the form is dirty and reads "Unsaved changes". `sticky` is the always-visible band for a long edit form. Discard is `form.reset()`.

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
- Never put a long single-screen form in a dialog; more than about five fields is a page, or a `WizardDialog` when the fields fall into ordered steps.
