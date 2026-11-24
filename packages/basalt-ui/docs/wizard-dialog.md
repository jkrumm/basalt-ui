---
name: WizardDialog
use when: 'a record is created in three or more steps and the user should see it take shape (a contract, a workspace, an invoice)'
never when: 'the form is one screen (use `Dialog` with `FormFooter`), or the steps are not taken in order'
subpath: basalt-ui/controls
peers: ['@base-ui/react']
slots: [wizard-body, wizard-counter, wizard-dialog, wizard-footer, wizard-form, wizard-heading, wizard-preview, wizard-preview-card, wizard-review, wizard-review-row, wizard-top-bar]
---

# WizardDialog

The body of a split wizard dialog: a live preview beside a stepped form, ending on a review of
every answer. Put it in `DialogContent size="split"`; it draws the close itself. The form is the
app's (`useAppForm`), the steps are data, and the primary is disabled until the step's `valid`
says yes. With `draft` the answers survive a reload.

## Signature

```ts
WizardDialog<F extends WizardForm>({ form, steps, preview, submitLabel, draft, className, }: WizardDialogProps<F>): ReactElement
  form: F  // The form every step reads and writes; its `onSubmit` runs from the review step's primary
  steps: readonly [WizardStep<F>, ...WizardStep<F>[]]  // The steps before the review, in order; at least one
  preview: (values: WizardValues<F>) => ReactNode  // The record as it stands, drawn from the form's current values, so it mirrors every input
  submitLabel: string  // The label of the primary on the review step: `Create contract`
  draft?: UseFormDraftOptions<WizardValues<F>>  // Keeps the answers across a reload; a restored draft opens on the first step that is not valid
  className?: string  // Layout only
```

`UseFormDraftOptions`, `WizardDialogProps`, `WizardForm`, `WizardStep` import from `basalt-ui/controls`: `import type { UseFormDraftOptions, WizardDialogProps, WizardForm, WizardStep } from 'basalt-ui/controls'`.

## Example

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent title="New contract" size="split">
    <WizardDialog form={form} steps={STEPS} preview={(v) => <ContractCard {...v} />} submitLabel="Create contract" />
  </DialogContent>
</Dialog>
```
