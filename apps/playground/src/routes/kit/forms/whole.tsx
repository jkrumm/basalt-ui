import { createFileRoute } from '@tanstack/react-router'
import { Page, PageBar } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import type { ReactElement } from 'react'
import { CreateService } from './-create-service'
import { SettingsForm } from './-settings-form'
import { StepsForm } from './-steps-form'

/** Which of the three forms the page shows; each is a history entry, so Back walks them. */
const store = defineControls({
  id: 'kit-forms-whole',
  scope: 'page',
  fields: {
    form: field
      .enum(['create', 'settings', 'steps'], 'create', { history: 'push' })
      .labels({ create: 'Create dialog', settings: 'Settings page', steps: 'Multi-step' }),
  },
})

/**
 * Three whole forms, each bound to TanStack Form (`@tanstack/react-form`, the app's engine) through
 * FormField's structural `FieldLike` port; the kit ships no form engine of its own. A record created
 * in a dialog, a long settings page with one save footer, and a three-step flow.
 */
function WholeRoute(): ReactElement {
  const [form] = store.field.form.use()
  return (
    <Page area="kit-forms-whole">
      <PageBar tabs={{ state: store.field.form, label: 'Form' }} />
      {form === 'create' && <CreateService />}
      {form === 'settings' && <SettingsForm />}
      {form === 'steps' && <StepsForm />}
    </Page>
  )
}

export const Route = createFileRoute('/kit/forms/whole')({
  staticData: { title: 'Whole forms' },
  validateSearch: store.validateSearch,
  search: { middlewares: store.middlewares },
  component: WholeRoute,
})
