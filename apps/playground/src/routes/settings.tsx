// theme-allow-file raw-selection-control — the guard reads a 2.x `Select` as a bare filter; these are v3 `Select`s bound to a form field, never a page filter
import { revalidateLogic, useForm } from '@tanstack/react-form'
import { createFileRoute } from '@tanstack/react-router'
import { FormField, FormFooter } from 'basalt-ui/controls'
import type { FormFieldProps } from 'basalt-ui/controls'
import { createSyncedState } from 'basalt-ui/data'
import { InnerNav, Page, PageBar, Section, SplitPage } from 'basalt-ui/page'
import { Fieldset } from 'basalt-ui/ui/field'
import { Input } from 'basalt-ui/ui/input'
import { Select } from 'basalt-ui/ui/select'
import { Switch } from 'basalt-ui/ui/switch'
import { Textarea } from 'basalt-ui/ui/textarea'
import { useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import { z } from 'zod'
import { useV3Tokens } from '../demo/v3-tokens'
import { useUnsavedGuard } from '../recipes/form-guard'

const SECTIONS = ['profile', 'appearance', 'members', 'billing', 'api-keys'] as const
type SectionId = (typeof SECTIONS)[number]

const COPY: Record<SectionId, { title: string; body: string }> = {
  profile: { title: 'Profile', body: 'Your name, email and the avatar shown to your team.' },
  appearance: { title: 'Appearance', body: 'Theme, density and the language of the interface.' },
  members: { title: 'Members', body: 'Who can open this workspace and what they may change.' },
  billing: { title: 'Billing', body: 'Plan, invoices and the card on file.' },
  'api-keys': { title: 'API keys', body: 'Tokens for scripts and integrations.' },
}

const GROUPS = [
  {
    id: 'account',
    label: 'Account',
    items: [
      { id: 'profile', label: 'Profile' },
      { id: 'appearance', label: 'Appearance' },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { id: 'members', label: 'Members', badge: { count: 4 } },
      { id: 'billing', label: 'Billing', badge: { dot: true, attention: true } },
      { id: 'api-keys', label: 'API keys' },
    ],
  },
] as const

// Synced preferences: the person's, on every device. The transport is a stand-in server with one row.
const Prefs = z.object({
  density: z.enum(['comfortable', 'compact']),
  language: z.enum(['en', 'de']),
  digest: z.boolean(),
})
type Prefs = z.infer<typeof Prefs>
const INITIAL: Prefs = { density: 'comfortable', language: 'en', digest: true }
let row: { value: Prefs; rev: number } | null = null
const later = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const prefs = createSyncedState<Prefs>({
  key: 'settings',
  version: 1,
  schema: Prefs,
  initial: INITIAL,
  owner: () => 'demo',
  transport: {
    async load() {
      await later(200)
      return { value: row?.value ?? null, rev: row === null ? null : String(row.rev) }
    },
    async save(patch, base) {
      await later(400)
      row = { value: { ...INITIAL, ...base.value, ...patch }, rev: (row?.rev ?? 0) + 1 }
      return { value: row.value, rev: String(row.rev) }
    },
  },
})

const STATUS = {
  saved: 'Saved',
  saving: 'Saving',
  offline: 'Offline',
  error: 'Save failed',
} as const

/** An instant-apply preference as the `field` a `FormField` binds. */
function useFieldOf<K extends keyof Prefs>(key: K): NonNullable<FormFieldProps<Prefs[K]>['field']> {
  const [value, set] = prefs.field(key).use()
  return { state: { value, meta: { errors: [] } }, handleChange: set, handleBlur: () => {} }
}

function AppearanceForm(): ReactElement {
  const { status } = prefs.use()
  const density = useFieldOf('density')
  const language = useFieldOf('language')
  const digest = useFieldOf('digest')
  return (
    <Fieldset className="max-w-md">
      <p role="status" className="m-0 text-sm text-muted-foreground">
        {STATUS[status]}
      </p>
      <FormField label="Density" field={density}>
        <Select
          aria-label="Density"
          options={[
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'compact', label: 'Compact' },
          ]}
        />
      </FormField>
      <FormField label="Language" field={language}>
        <Select
          aria-label="Language"
          options={[
            { value: 'en', label: 'English' },
            { value: 'de', label: 'Deutsch' },
          ]}
        />
      </FormField>
      <FormField label="Weekly digest" description="One email on Monday." field={digest}>
        <Switch />
      </FormField>
    </Fieldset>
  )
}

// A form with a Save action is guarded, never drafted: leaving asks, a reload does not restore.
const Profile = z.object({
  name: z.string().min(1, 'Enter a name.'),
  email: z.email('Enter an email address.'),
  bio: z.string().max(160, 'Keep it under 160 characters.'),
})

function ProfileForm(): ReactElement {
  const form = useForm({
    defaultValues: { name: 'Ada Lovelace', email: 'ada@example.com', bio: '' },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: Profile },
    onSubmit: async ({ value, formApi }) => {
      await later(600)
      formApi.reset(value)
    },
  })
  const guard = useUnsavedGuard(form)
  return (
    <form
      noValidate
      className="max-w-md"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <Fieldset disabled={form.state.isSubmitting}>
        <form.Field name="name">
          {(f) => (
            <FormField label="Name" required field={f}>
              <Input />
            </FormField>
          )}
        </form.Field>
        <form.Field name="email">
          {(f) => (
            <FormField label="Email" required field={f}>
              <Input type="email" />
            </FormField>
          )}
        </form.Field>
        <form.Field name="bio">
          {(f) => (
            <FormField label="Bio" description="Shown on your profile." field={f}>
              <Textarea rows={3} />
            </FormField>
          )}
        </form.Field>
        <FormFooter form={form} actions={[{ label: 'Save', primary: true }]} />
      </Fieldset>
      {guard}
    </form>
  )
}

const PANES: Partial<Record<SectionId, ReactElement>> = {
  profile: <ProfileForm />,
  appearance: <AppearanceForm />,
}

// The controls layer's push field binds here (v3-ctl-6). Until then the route owns this structural
// stand-in: `?section=<id>` written with `history.pushState`, so Back walks the sections.
const listeners = new Set<() => void>()
const notify = (): void => listeners.forEach((listener) => listener())
function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('popstate', notify)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('popstate', notify)
  }
}
const raw = (): string | null => new URLSearchParams(window.location.search).get('section')
const hrefOf = (value: SectionId): string => {
  const params = new URLSearchParams(window.location.search)
  params.set('section', value)
  return `?${params.toString()}`
}
const go = (value: SectionId): void => {
  window.history.pushState(null, '', hrefOf(value))
  notify()
}

const section = {
  key: 'section',
  kind: 'enum',
  history: 'push',
  options: SECTIONS.map((value) => ({ value, label: COPY[value].title })),
  use: () => {
    const stored = useSyncExternalStore(subscribe, raw, () => null)
    return [SECTIONS.find((value) => value === stored) ?? SECTIONS[0], go] as [
      SectionId,
      (v: SectionId) => void,
    ]
  },
  useSource: () => ({ source: 'own' as const, inherited: undefined }),
  clear: () => undefined,
  get isDefault() {
    return raw() === null
  },
  get isSet() {
    return raw() !== null
  },
  link: (value: SectionId) => ({
    href: hrefOf(value),
    onClick: (event: { preventDefault(): void }) => {
      event.preventDefault()
      go(value)
    },
  }),
} as const

function useIsSet(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => raw() !== null,
    () => false,
  )
}

// #region recipe:inner-nav
function SettingsPane({ id }: { id: SectionId }): ReactElement {
  const { title, body } = COPY[id]
  return (
    <Section title={title}>
      {PANES[id] ?? <p className="m-0 text-sm text-muted-foreground">{body}</p>}
    </Section>
  )
}

export function SettingsPage(): ReactElement {
  const [current] = section.use()
  const selected = useIsSet()
  return (
    <Page area="settings">
      <PageBar title="Settings" />
      <SplitPage
        selected={selected}
        list={() => <InnerNav label="Settings sections" state={section} groups={GROUPS} />}
        detail={() => <SettingsPane id={current} />}
      />
    </Page>
  )
}
// #endregion

function SettingsRoute(): ReactElement {
  useV3Tokens()
  return <SettingsPage />
}

export const Route = createFileRoute('/settings')({
  staticData: { title: 'Settings' },
  component: SettingsRoute,
})
