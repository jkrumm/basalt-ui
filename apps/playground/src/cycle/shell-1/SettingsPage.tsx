/**
 * Shell cycle 1 (docs/v3/cycles/shell-1.md), page 3 of the fleet app: settings, an InnerNav over a
 * push field inside a SplitPage. The panes are fixture copy plus a few controls, enough for the
 * keyboard pass to have something to land on. Every workaround carries a `cycle-shell-1:` comment.
 */
import { InnerNav, Page, PageBar, Section, SplitPage } from 'basalt-ui/page'
import { Button } from 'basalt-ui/ui/button'
import { Field, Fieldset } from 'basalt-ui/ui/field'
import { Input } from 'basalt-ui/ui/input'
import { Switch } from 'basalt-ui/ui/switch'
import type { ReactElement } from 'react'
import { useV3Tokens } from '../../demo/v3-tokens'
import { labelOf, settings } from './fleet-store'
import type { SettingsSection } from './fleet-store'
import { useInnerNavState } from './handle-adapters'

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
        <Input defaultValue="Fleet" />
      </Field>
      <Field label="Default region" description="New services deploy here.">
        <Input defaultValue="eu-central" />
      </Field>
    </Fieldset>
  )
}

function Notifications(): ReactElement {
  return (
    <Fieldset className="max-w-md">
      <Field label="Failed deploys" description="Mail the service owner.">
        <Switch defaultChecked />
      </Field>
      <Field label="Weekly digest" description="One email on Monday.">
        <Switch />
      </Field>
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
  useV3Tokens()
  const [section] = settings.field.section.use()
  const Pane = PANES[section]
  const sectionNav = useInnerNavState(settings.field.section)
  return (
    <Page area="cycle-shell-settings">
      <PageBar title="Settings" />
      <SplitPage
        // cycle-shell-1: shell-1.5 — the documented `selected={field.isSet}` does not exist on a
        // field handle; `isDefault` is the nearest, and it cannot tell "chose General" from "chose
        // nothing", because General is the fallback.
        selected={!settings.field.section.isDefault}
        list={() => <InnerNav label="Settings sections" state={sectionNav} groups={GROUPS} />}
        detail={() => (
          <Section title={labelOf(settings.field.section, section)}>
            <Pane />
          </Section>
        )}
      />
    </Page>
  )
}
