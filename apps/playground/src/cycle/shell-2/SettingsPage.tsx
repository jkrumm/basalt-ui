/**
 * Shell cycle 2 (docs/v3/cycles/shell-2.md), page 3 of the fleet app, copied from cycle 1: settings,
 * an InnerNav over a push field inside a SplitPage. The panes are fixture copy plus a few controls,
 * enough for the keyboard pass to have something to land on. Every workaround carries a
 * `cycle-shell-2:` comment.
 *
 * Gone since cycle 1: the `InnerNav` adapter (shell-1.3), `selected={!isDefault}` (shell-1.5),
 * `labelOf` (shell-1.6) and the per-page palette mount (shell-1.9).
 */
import { FormField } from 'basalt-ui/controls'
import { InnerNav, Page, PageBar, Section, SplitPage } from 'basalt-ui/page'
import { Button } from 'basalt-ui/ui/button'
import { Field, Fieldset } from 'basalt-ui/ui/field'
import { Input } from 'basalt-ui/ui/input'
import { Switch } from 'basalt-ui/ui/switch'
import type { ReactElement } from 'react'
import { prefs, settings } from './fleet-store'
import type { SettingsSection } from './fleet-store'

const GROUPS = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { id: 'general', label: 'General' },
      { id: 'notifications', label: 'Notifications' },
      { id: 'members', label: 'Members', badge: { count: 6 } },
    ],
  },
  { id: 'advanced', label: 'Advanced', items: [{ id: 'danger', label: 'Danger zone' }] },
] as const

function General(): ReactElement {
  return (
    <Fieldset className="max-w-md">
      <Field label="Workspace name">
        <Input name="workspace" autoComplete="organization" defaultValue="Fleet" />
      </Field>
      <Field label="Default region" description="New services deploy here.">
        <Input name="region" autoComplete="off" defaultValue="eu-central" />
      </Field>
    </Fieldset>
  )
}

function Notifications(): ReactElement {
  return (
    <Fieldset className="max-w-md">
      <FormField
        label="Failed deploys"
        description="Mail the service owner."
        control={prefs.field.failedDeploys}
      >
        <Switch />
      </FormField>
      <FormField
        label="Weekly digest"
        description="One email on Monday."
        control={prefs.field.weeklyDigest}
      >
        <Switch />
      </FormField>
    </Fieldset>
  )
}

function Members(): ReactElement {
  return (
    <p className="m-0 text-sm text-muted-foreground">
      Ada, Lin, Kai, Noor, Sam and Mo can deploy to every service.
    </p>
  )
}

function Danger(): ReactElement {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="m-0 text-sm text-muted-foreground">
        Deleting the workspace removes every service and its history.
      </p>
      <Button variant="danger">Delete workspace</Button>
    </div>
  )
}

const PANES: Record<SettingsSection, () => ReactElement> = {
  general: General,
  notifications: Notifications,
  members: Members,
  danger: Danger,
}

export function SettingsPage(): ReactElement {
  const [section] = settings.field.section.use()
  const Pane = PANES[section]
  return (
    <Page area="cycle-shell-2-settings">
      <PageBar title="Settings" />
      <SplitPage
        selected={settings.field.section.useIsSet()}
        onBack={settings.field.section.clear}
        backLabel="Settings"
        list={() => (
          <InnerNav label="Settings sections" state={settings.field.section} groups={GROUPS} />
        )}
        detail={() => (
          <Section title={settings.field.section.label(section)}>
            <Pane />
          </Section>
        )}
      />
    </Page>
  )
}
