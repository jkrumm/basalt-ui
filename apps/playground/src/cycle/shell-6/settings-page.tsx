import { revalidateLogic, useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { FormField, FormFooter, FormSection, toSubmitErrors } from 'basalt-ui/controls'
import { EmptyState, InnerNav, Page, PageBar, SplitPage } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import { CheckboxGroup } from 'basalt-ui/ui/checkbox'
import { Input } from 'basalt-ui/ui/input'
import { NumberField } from 'basalt-ui/ui/number-field'
import { RadioGroup } from 'basalt-ui/ui/radio-group'
import { Select } from 'basalt-ui/ui/select'
import { Skeleton } from 'basalt-ui/ui/skeleton'
import { Switch } from 'basalt-ui/ui/switch'
import type { ReactElement } from 'react'
import { z } from 'zod'
import { useUnsavedGuard } from '../../recipes/form-guard'
import { ROOT } from './queries'
import { server } from './server'
import type { Settings } from './server'

const SECTIONS = ['general', 'deploys', 'notifications'] as const

/** The section is a push field: each section is a history entry, and the list draws its links from it. */
export const settingsStore = defineControls({
  id: 'fleet6-settings',
  scope: 'page',
  fields: {
    section: field
      .enum(SECTIONS, 'general', { history: 'push' })
      .labels({ general: 'General', deploys: 'Deploys', notifications: 'Notifications' }),
  },
})
const section = settingsStore.field.section

const GROUPS = [
  { id: 'team', label: 'Basics', items: [{ id: 'general', label: 'General' }] },
  {
    id: 'pipeline',
    label: 'Pipeline',
    items: [
      { id: 'deploys', label: 'Deploys' },
      { id: 'notifications', label: 'Notifications' },
    ],
  },
] as const

const ZONES = ['Europe/Berlin', 'Europe/London', 'America/New_York', 'Asia/Singapore'].map((z) => ({
  value: z,
  label: z,
}))
const ROLLOUTS = [
  { value: 'rolling', label: 'Rolling' },
  { value: 'canary', label: 'Canary' },
  { value: 'blue-green', label: 'Blue-green' },
] as const
const EVENTS = [
  { value: 'deploy-failed', label: 'A deploy failed' },
  { value: 'rolled-back', label: 'A deploy rolled back' },
  { value: 'freeze', label: 'A freeze starts' },
]

/** Saves a patch to the server, then refreshes what the route loaded. */
function useSave(): (patch: Partial<Settings>) => Promise<void> {
  const queryClient = useQueryClient()
  const router = useRouter()
  return async (patch) => {
    await server.saveSettings(patch)
    await queryClient.invalidateQueries({ queryKey: [ROOT, 'settings'] })
    await router.invalidate()
  }
}

const NAME = z.string().min(2, 'Use at least 2 characters.')
const SLUG = z
  .string()
  .regex(/^[a-z0-9-]{2,32}$/, 'Use 2 to 32 lowercase letters, digits or dashes.')
const EMAIL = z.email('Enter an address, like oncall@example.com.')
const PARALLEL = z.number('Enter a number.').int().min(1, 'At least 1.').max(10, 'At most 10.')

/** One section's form: its own TanStack form and save, so a section saves what it shows. */
function useSectionForm<V extends Partial<Settings>>(values: V) {
  const save = useSave()
  const form = useForm({
    defaultValues: values,
    validationLogic: revalidateLogic({ mode: 'blur', modeAfterSubmission: 'change' }),
    validators: { onSubmitAsync: toSubmitErrors(save) },
    onSubmit: ({ value, formApi }) => formApi.reset(value),
  })
  return { form, guard: useUnsavedGuard(form) }
}

function submit(form: { handleSubmit: () => Promise<void> }) {
  return (event: { preventDefault: () => void }) => {
    event.preventDefault()
    void form.handleSubmit()
  }
}

function GeneralForm({ settings }: { settings: Settings }): ReactElement {
  const { form, guard } = useSectionForm({
    name: settings.name,
    slug: settings.slug,
    zone: settings.zone,
  })
  return (
    <form noValidate className="max-w-3xl" onSubmit={submit(form)}>
      <FormSection
        title="General"
        description="How the team is named and when its schedules run."
        footer={
          <FormFooter
            form={form}
            actions={[
              { label: 'Discard', onClick: () => form.reset() },
              { label: 'Save', primary: true },
            ]}
          />
        }
      >
        <form.Field name="name" validators={{ onDynamic: NAME }}>
          {(f) => (
            <FormField
              label="Name"
              description="Shown in the header and in alerts."
              required
              field={f}
            >
              <Input autoComplete="organization" />
            </FormField>
          )}
        </form.Field>
        <form.Field name="slug" validators={{ onDynamic: SLUG }}>
          {(f) => (
            <FormField label="URL slug" description="example.com/platform" required field={f}>
              <Input autoComplete="off" spellCheck={false} />
            </FormField>
          )}
        </form.Field>
        <form.Field name="zone">
          {(f) => (
            <FormField label="Time zone" description="Schedules and digests run in it." field={f}>
              <Select aria-label="Time zone" options={ZONES} />
            </FormField>
          )}
        </form.Field>
      </FormSection>
      {guard}
    </form>
  )
}

function DeploysForm({ settings }: { settings: Settings }): ReactElement {
  const { form, guard } = useSectionForm({
    autoDeploy: settings.autoDeploy,
    rollout: settings.rollout,
    parallel: settings.parallel,
  })
  return (
    <form noValidate className="max-w-3xl" onSubmit={submit(form)}>
      <FormSection
        title="Deploys"
        description="How a merge reaches production."
        footer={
          <FormFooter
            form={form}
            actions={[
              { label: 'Discard', onClick: () => form.reset() },
              { label: 'Save', primary: true },
            ]}
          />
        }
      >
        <form.Field name="autoDeploy">
          {(f) => (
            <FormField label="Deploy main on push" description="Applies when saved." field={f}>
              <Switch />
            </FormField>
          )}
        </form.Field>
        <form.Field name="rollout">
          {(f) => (
            <FormField
              label="Rollout"
              description="How a deploy replaces the running version."
              field={f}
            >
              <RadioGroup options={ROLLOUTS} />
            </FormField>
          )}
        </form.Field>
        <form.Field name="parallel" validators={{ onDynamic: PARALLEL }}>
          {(f) => (
            <FormField
              label="Parallel deploys"
              description="Services that roll out at once."
              required
              field={f}
            >
              <NumberField min={1} max={10} />
            </FormField>
          )}
        </form.Field>
      </FormSection>
      {guard}
    </form>
  )
}

function NotificationsForm({ settings }: { settings: Settings }): ReactElement {
  const { form, guard } = useSectionForm({ events: settings.events, email: settings.email })
  return (
    <form noValidate className="max-w-3xl" onSubmit={submit(form)}>
      <FormSection
        title="Notifications"
        description="Who hears about what."
        footer={
          <FormFooter
            form={form}
            actions={[
              { label: 'Discard', onClick: () => form.reset() },
              { label: 'Save', primary: true },
            ]}
          />
        }
      >
        <form.Field name="events">
          {(f) => (
            <FormField label="Notify when" description="Sent to the alert address." field={f}>
              <CheckboxGroup options={EVENTS} />
            </FormField>
          )}
        </form.Field>
        <form.Field name="email" validators={{ onDynamic: EMAIL }}>
          {(f) => (
            <FormField
              label="Alert address"
              description="A team list, not a person."
              required
              field={f}
            >
              <Input type="email" autoComplete="email" />
            </FormField>
          )}
        </form.Field>
      </FormSection>
      {guard}
    </form>
  )
}

/** The pane of the open section. A form keys on the saved values, so a save or a reload resets its draft. */
function Pane({ settings }: { settings: Settings }): ReactElement {
  const [current] = section.use()
  const key = JSON.stringify(settings)
  if (current === 'deploys') return <DeploysForm key={key} settings={settings} />
  if (current === 'notifications') return <NotificationsForm key={key} settings={settings} />
  return <GeneralForm key={key} settings={settings} />
}

/** The settings page: `settings` is absent while the route is pending, `null` for a team that has none. */
export function SettingsPage({
  settings,
}: {
  settings: Settings | null | undefined
}): ReactElement {
  const router = useRouter()
  const queryClient = useQueryClient()
  const selected = section.useIsSet()
  const create = async (): Promise<void> => {
    await server.createSettings()
    await queryClient.invalidateQueries({ queryKey: [ROOT, 'settings'] })
    await router.invalidate()
  }
  if (settings === null) {
    return (
      <Page area="fleet6-settings">
        <PageBar title="Fleet settings" />
        <EmptyState
          title="No fleet settings yet"
          cause="No deploy rules are set. Start from the defaults and edit them here."
          action={{ label: 'Use the defaults', onClick: () => void create() }}
        />
      </Page>
    )
  }
  return (
    <Page area="fleet6-settings">
      <PageBar title="Fleet settings" />
      <SplitPage
        selected={selected}
        onBack={section.clear}
        backLabel="Sections"
        list={() => <InnerNav label="Sections" state={section} groups={GROUPS} />}
        detail={() =>
          settings === undefined ? (
            // owner-review-2: a form has no loading phase, so the pending pane is skeleton lines in a hand-built column
            <div className="flex max-w-3xl flex-col gap-6 text-sm" aria-busy="true">
              {['a', 'b', 'c', 'd'].map((k) => (
                <Skeleton key={k} className="w-full" />
              ))}
            </div>
          ) : (
            <Pane settings={settings} />
          )
        }
      />
    </Page>
  )
}
