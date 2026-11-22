import { createFileRoute } from '@tanstack/react-router'
import { Page, PageBar } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import type { ReactElement } from 'react'
import { ContractWizard } from './-contract-wizard'
import { CreateService } from './-create-service'
import { SettingsForm } from './-settings-form'
import { StepsForm } from './-steps-form'

/** Which of the four forms the page shows; each is a history entry, so Back walks them. */
const store = defineControls({
  id: 'kit-forms-whole',
  scope: 'page',
  fields: {
    form: field
      .enum(['create', 'settings', 'steps', 'wizard'], 'create', { history: 'push' })
      .labels({
        create: 'Create dialog',
        settings: 'Settings page',
        steps: 'Multi-step',
        wizard: 'Wizard dialog',
      }),
  },
})

/**
 * Four whole forms, each built with `basalt-ui/form` on TanStack Form (`@tanstack/react-form`, the
 * app's engine); the kit ships no form engine of its own. A record created
 * in a dialog, a long settings page with one save footer, a three-step flow and a five-step wizard in a split dialog.
 */
function WholeRoute(): ReactElement {
  const [form] = store.field.form.use()
  return (
    <Page area="kit-forms-whole">
      <PageBar tabs={{ state: store.field.form, label: 'Form' }} />
      {form === 'create' && <CreateService />}
      {form === 'settings' && <SettingsForm />}
      {form === 'steps' && <StepsForm />}
      {form === 'wizard' && <ContractWizard />}
    </Page>
  )
}

export const Route = createFileRoute('/kit/forms/whole')({
  staticData: { title: 'Whole forms' },
  validateSearch: store.validateSearch,
  search: { middlewares: store.middlewares },
  component: WholeRoute,
})
