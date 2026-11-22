import { revalidateLogic } from '@tanstack/react-form'
import { createFileRoute } from '@tanstack/react-router'
import { useRouterState } from '@tanstack/react-router'
import {
  FormActionRow,
  FormConfirmRow,
  FormField,
  FormGroupRow,
  FormSection,
  filterSlot,
  spec,
} from 'basalt-ui/controls'
import { createSyncedState } from 'basalt-ui/data'
import { useAppForm } from 'basalt-ui/form'
import { InnerNav, Page, PageBar, SettingsLayout, SplitPage } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import { Lozenge } from 'basalt-ui/ui/badge'
import { Button } from 'basalt-ui/ui/button'
import { Input } from 'basalt-ui/ui/input'
import { Select } from 'basalt-ui/ui/select'
import { Switch } from 'basalt-ui/ui/switch'
import { Textarea } from 'basalt-ui/ui/textarea'
import type { ReactElement } from 'react'
import { useEffect } from 'react'
import { z } from 'zod'
import { useUnsavedGuard } from '../recipes/form-guard'

const SECTIONS = ['profile', 'preferences', 'notifications', 'workspace'] as const
type SectionId = (typeof SECTIONS)[number]

const COPY: Record<SectionId, { title: string; body: string }> = {
  profile: { title: 'Profile', body: 'Your name, email and the bio shown to your team.' },
  preferences: {
    title: 'Preferences',
    body: 'How the interface looks and speaks. Every change applies at once.',
  },
  notifications: {
    title: 'Notifications',
    body: 'Which events reach you, grouped by what they are about.',
  },
  workspace: { title: 'Workspace', body: 'Exports, sign-in policy and what cannot be undone.' },
}

type Groups = Parameters<typeof InnerNav>[0]['groups']

const GROUPS = [
  {
    id: 'account',
    label: 'Account',
    items: [
      { id: 'profile', label: 'Profile' },
      { id: 'preferences', label: 'Preferences' },
      { id: 'notifications', label: 'Notifications' },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    items: [{ id: 'workspace', label: 'Workspace', badge: { dot: true, attention: true } }],
  },
] as const satisfies Groups

/** Every setting a person can search for: its section, its row id and its name. */
const INDEX: readonly { section: SectionId; id: string; label: string }[] = [
  { section: 'profile', id: 'row-name', label: 'Name' },
  { section: 'profile', id: 'row-email', label: 'Email' },
  { section: 'profile', id: 'row-bio', label: 'Bio' },
  { section: 'preferences', id: 'row-density', label: 'Density' },
  { section: 'preferences', id: 'row-language', label: 'Language' },
  { section: 'preferences', id: 'row-motion', label: 'Reduce motion' },
  { section: 'preferences', id: 'row-digest', label: 'Weekly digest' },
  { section: 'notifications', id: 'row-deploys', label: 'Deploy notifications' },
  { section: 'notifications', id: 'row-activity', label: 'Activity notifications' },
  { section: 'workspace', id: 'row-export', label: 'Export data' },
  { section: 'workspace', id: 'row-sso', label: 'Single sign-on' },
  { section: 'workspace', id: 'row-delete', label: 'Delete workspace' },
]

// Synced preferences: the person's, on every device. The transport is a stand-in server with one row.
const Prefs = z.object({
  density: z.enum(['comfortable', 'compact']),
  language: z.enum(['en', 'de']),
  motion: z.boolean(),
  digest: z.boolean(),
  deployOk: z.boolean(),
  deployFailed: z.boolean(),
  mentions: z.boolean(),
  comments: z.boolean(),
  sso: z.boolean(),
})
type Prefs = z.infer<typeof Prefs>
const INITIAL: Prefs = {
  density: 'comfortable',
  language: 'en',
  motion: false,
  digest: true,
  deployOk: false,
  deployFailed: true,
  mentions: true,
  comments: false,
  sso: false,
}
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

/** Rows that apply at once: each is bound to the synced field itself, no form and no footer. */
function PreferencesPane(): ReactElement {
  const { status } = prefs.use()
  return (
    <div data-shot="preferences">
      <FormSection
        title="Display and language"
        description="Kept on your account, so every device agrees."
        action={<output className="text-sm text-muted-foreground">{STATUS[status]}</output>}
      >
        <FormField
          id="row-density"
          label="Density"
          description="Row height in lists and tables."
          control={prefs.field('density')}
        >
          <Select
            aria-label="Density"
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
          />
        </FormField>
        <FormField
          id="row-language"
          label="Language"
          description="Menus, dates and numbers."
          control={prefs.field('language')}
        >
          <Select
            aria-label="Language"
            options={[
              { value: 'en', label: 'English' },
              { value: 'de', label: 'Deutsch' },
            ]}
          />
        </FormField>
        <FormField
          id="row-motion"
          label="Reduce motion"
          description="Fades replace slides and zooms."
          control={prefs.field('motion')}
        >
          <Switch />
        </FormField>
        <FormField
          id="row-digest"
          label="Weekly digest"
          description="One email on Monday."
          control={prefs.field('digest')}
        >
          <Switch />
        </FormField>
      </FormSection>
    </div>
  )
}

const on = (...flags: boolean[]): string => `${flags.filter(Boolean).length} of ${flags.length} on`

function NotificationsPane(): ReactElement {
  const [ok] = prefs.field('deployOk').use()
  const [failed] = prefs.field('deployFailed').use()
  const [mentions] = prefs.field('mentions').use()
  const [comments] = prefs.field('comments').use()
  return (
    <div data-shot="notifications">
      <FormSection
        title="Email alerts"
        description="Deploy results and replies that reach your inbox."
      >
        <FormGroupRow
          id="row-deploys"
          label="Deploys"
          description="What happens to your pipelines."
          summary={on(ok, failed)}
          defaultOpen
        >
          <FormField label="Deploy succeeded" control={prefs.field('deployOk')}>
            <Switch />
          </FormField>
          <FormField label="Deploy failed" control={prefs.field('deployFailed')}>
            <Switch />
          </FormField>
        </FormGroupRow>
        <FormGroupRow
          id="row-activity"
          label="Activity"
          description="People talking to you."
          summary={on(mentions, comments)}
        >
          <FormField label="Mentions" control={prefs.field('mentions')}>
            <Switch />
          </FormField>
          <FormField label="Comments on your runs" control={prefs.field('comments')}>
            <Switch />
          </FormField>
        </FormGroupRow>
      </FormSection>
    </div>
  )
}

// A form with a Save action is guarded, never drafted: leaving asks, a reload does not restore.
const Profile = z.object({
  name: z.string().min(1, 'Enter a name.'),
  email: z.email('Enter an email address.'),
  bio: z.string().max(160, 'Keep it under 160 characters.'),
})

function ProfilePane({ edited }: { edited: boolean }): ReactElement {
  const form = useAppForm({
    defaultValues: { name: 'Ada Lovelace', email: 'ada@example.com', bio: '' },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: Profile },
    onSubmit: async ({ value, formApi }) => {
      await later(600)
      formApi.reset(value)
    },
  })
  // A link with `edited` opens the pane with a change in it, so a shot shows the unsaved bar.
  useEffect(() => {
    if (edited) form.setFieldValue('bio', 'Wrote the first program.')
  }, [edited, form])
  const guard = useUnsavedGuard(form)
  return (
    <form.AppForm>
      <form.Form>
        <div data-shot="profile-form" className="flex flex-col gap-10">
          <FormSection title="Identity" description="Shown to your team. Saved together.">
            <form.AppField name="name">
              {(f) => (
                <f.FormField
                  id="row-name"
                  label="Name"
                  description="How you appear in lists."
                  required
                >
                  <Input autoComplete="name" />
                </f.FormField>
              )}
            </form.AppField>
            <form.AppField name="email">
              {(f) => (
                <f.FormField id="row-email" label="Email" description="Where receipts go." required>
                  <Input type="email" autoComplete="email" inputMode="email" />
                </f.FormField>
              )}
            </form.AppField>
            <form.AppField name="bio">
              {(f) => (
                <f.FormField
                  id="row-bio"
                  label="Bio"
                  description="Up to 160 characters."
                  layout="stack"
                >
                  <Textarea rows={3} autoComplete="off" />
                </f.FormField>
              )}
            </form.AppField>
          </FormSection>
          <form.Footer
            floating
            actions={[
              { label: 'Discard', onClick: () => form.reset() },
              { label: 'Save changes', primary: true },
            ]}
          />
        </div>
      </form.Form>
      {guard}
    </form.AppForm>
  )
}

function WorkspacePane(): ReactElement {
  return (
    <>
      <div data-shot="workspace-exports">
        <FormSection title="Exports" description="What leaves the workspace.">
          <FormActionRow
            id="row-export"
            label="Export data"
            description="A CSV of every run and its logs, mailed when it is ready."
            action={<Button>Export</Button>}
          />
        </FormSection>
      </div>
      <div data-shot="workspace-locked">
        <FormSection
          title="Single sign-on"
          badge={<Lozenge tone="accent">Enterprise</Lozenge>}
          description="Sign in through your identity provider."
          locked="Part of the Enterprise plan."
          action={<Button>See plans</Button>}
        >
          <FormField
            id="row-sso"
            label="Require SSO"
            description="Members sign in through SAML only."
            control={prefs.field('sso')}
          >
            <Switch />
          </FormField>
        </FormSection>
      </div>
      <div data-shot="workspace-danger">
        <FormSection title="Danger zone" description="None of this can be undone.">
          <FormActionRow
            id="row-transfer"
            tone="danger"
            label="Transfer ownership"
            description="The new owner can remove you."
            action={<Button variant="danger">Transfer</Button>}
          />
          <FormConfirmRow
            id="row-delete"
            label="Delete workspace"
            description="Removes every project, run and member."
            confirmText="acme"
            actionLabel="Delete workspace"
            onConfirm={() => later(600)}
          />
        </FormSection>
      </div>
    </>
  )
}

// The section is a push field: each section is a history entry, Back walks them, and `InnerNav` draws
// its links from the field as it is. `q` filters the names of settings; `edited` seeds a shot.
const settings = defineControls({
  id: 'settings',
  scope: 'page',
  fields: {
    section: field
      .enum(SECTIONS, 'profile', { history: 'push' })
      .labels(Object.fromEntries(SECTIONS.map((id) => [id, COPY[id].title]))),
    q: field.string(''),
    edited: field.boolean(false),
  },
})
const section = settings.field.section
const searchFilter = filterSlot([spec(settings.field.q, 'Search settings')])

/** The nav's groups: the sections, with the settings whose name matches the search above them. */
function groupsFor(q: string): Groups {
  const needle = q.trim().toLowerCase()
  if (needle === '') return GROUPS
  const hits = INDEX.filter((entry) => entry.label.toLowerCase().includes(needle))
  return [
    {
      id: 'matches',
      label: hits.length === 0 ? 'No setting matches' : 'Settings',
      items: hits.map((hit) => ({
        id: hit.id,
        label: `${hit.label} · ${COPY[hit.section].title}`,
        href: `/settings?section=${hit.section}#${hit.id}`,
      })),
    },
    ...GROUPS,
  ]
}

// #region recipe:inner-nav
function SettingsPane({ id }: { id: SectionId }): ReactElement {
  const { title, body } = COPY[id]
  const [edited] = settings.field.edited.use()
  // Under a router a hash change is a `pushState`, which fires no event: pass the row from the router.
  const hash = useRouterState({ select: (state) => state.location.hash })
  return (
    <SettingsLayout title={title} description={body} {...(hash !== '' && { row: hash })}>
      {id === 'profile' && <ProfilePane edited={edited} />}
      {id === 'preferences' && <PreferencesPane />}
      {id === 'notifications' && <NotificationsPane />}
      {id === 'workspace' && <WorkspacePane />}
    </SettingsLayout>
  )
}

export function SettingsPage(): ReactElement {
  const [current] = section.use()
  const [q] = settings.field.q.use()
  const selected = section.useIsSet()
  return (
    <Page area="settings">
      <PageBar title="Settings" />
      <SplitPage
        selected={selected}
        list={() => (
          <InnerNav
            label="Settings sections"
            state={section}
            filter={searchFilter}
            groups={groupsFor(q)}
          />
        )}
        detail={() => <SettingsPane id={current} />}
      />
    </Page>
  )
}
// #endregion

function SettingsRoute(): ReactElement {
  return <SettingsPage />
}

export const Route = createFileRoute('/settings')({
  validateSearch: settings.validateSearch,
  search: { middlewares: settings.middlewares },
  staticData: { title: 'Settings' },
  component: SettingsRoute,
})
