import { FormActionRow, FormConfirmRow, FormSection } from 'basalt-ui/controls'
import { useAppForm } from 'basalt-ui/form'
import { InnerNav, Page, PageBar, SettingsLayout, SplitPage } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import { Button } from 'basalt-ui/ui/button'
import { Checkbox } from 'basalt-ui/ui/checkbox'
import { CheckboxMatrix } from 'basalt-ui/ui/checkbox-matrix'
import { NumberField } from 'basalt-ui/ui/number-field'
import { RadioGroup } from 'basalt-ui/ui/radio-group'
import { Select } from 'basalt-ui/ui/select'
import { TagInput } from 'basalt-ui/ui/tag-input'
import { Bell, Boxes, Building2 } from 'lucide-react'
import type { ReactElement } from 'react'
import { z } from 'zod'
import { CHANNELS, COPY, EVENTS, POLICIES, SECTIONS, WAREHOUSES } from './model'
import type { SectionId } from './model'

const later = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/

const Reordering = z.object({
  policy: z.enum(['point', 'minmax', 'manual']),
  safetyDays: z
    .number()
    .int()
    .min(0, 'Zero or more days.')
    .max(60, 'At most 60 days.')
    .nullable()
    .refine((days) => days !== null, 'Enter the days of safety stock.'),
  warehouse: z.string(),
  packRound: z.boolean(),
  domains: z.array(z.string()),
})

function ReorderingPane(): ReactElement {
  const form = useAppForm({
    defaultValues: {
      policy: 'point',
      safetyDays: 5,
      warehouse: 'main',
      packRound: true,
      domains: ['brenner-vt.example', 'nordlager.example', 'atlasseal.example'],
    } as z.input<typeof Reordering>,
    validators: { onDynamic: Reordering },
    onSubmit: async ({ value, formApi }) => {
      await later(400)
      formApi.reset(value)
    },
  })
  return (
    <form.AppForm>
      <form.Form>
        <div data-shot="reordering" className="flex flex-col gap-10">
          <FormSection
            title="Policy"
            description="Applies to every part without a policy of its own."
          >
            <form.AppField name="policy">
              {(f) => (
                <f.FormField id="row-policy" label="Reorder policy" layout="stack">
                  <RadioGroup variant="card" aria-label="Reorder policy" options={POLICIES} />
                </f.FormField>
              )}
            </form.AppField>
            <form.AppField name="safetyDays">
              {(f) => (
                <f.FormField
                  id="row-safety"
                  label="Safety stock"
                  description="Usage kept on top of the lead time."
                  required
                >
                  <NumberField
                    min={0}
                    max={60}
                    format={{ style: 'unit', unit: 'day', unitDisplay: 'long' }}
                  />
                </f.FormField>
              )}
            </form.AppField>
            <form.AppField name="packRound">
              {(f) => (
                <f.FormField
                  id="row-pack"
                  label="Round up to the pack size"
                  description="A suggested quantity becomes whole packs."
                >
                  <Checkbox />
                </f.FormField>
              )}
            </form.AppField>
          </FormSection>
          <FormSection
            title="Receiving"
            description="Where deliveries go and which confirmations match."
          >
            <form.AppField name="warehouse">
              {(f) => (
                <f.FormField
                  id="row-warehouse"
                  label="Default warehouse"
                  description="A new order delivers here unless it says otherwise."
                >
                  <Select aria-label="Default warehouse" options={WAREHOUSES} />
                </f.FormField>
              )}
            </form.AppField>
            <form.AppField name="domains">
              {(f) => (
                <f.FormField
                  id="row-domains"
                  label="Confirmation domains"
                  description="Order confirmations from these domains match their order on their own."
                  layout="stack"
                >
                  <TagInput
                    aria-label="Confirmation domains"
                    placeholder="supplier.example"
                    inputMode="url"
                    autoComplete="off"
                    validate={(tag) =>
                      DOMAIN.test(tag) ? undefined : 'Enter a domain, like supplier.example.'
                    }
                  />
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
    </form.AppForm>
  )
}

function NotificationsPane(): ReactElement {
  const form = useAppForm({
    defaultValues: {
      matrix: {
        low: ['app', 'digest'],
        out: ['email', 'app'],
        late: ['email', 'app'],
        confirmed: ['digest'],
        quality: ['email', 'app', 'digest'],
      } as Record<string, string[]>,
    },
    onSubmit: async ({ value, formApi }) => {
      await later(400)
      formApi.reset(value)
    },
  })
  return (
    <form.AppForm>
      <form.Form>
        <div data-shot="notifications" className="flex flex-col gap-10">
          <form.AppField name="matrix">
            {(f) => (
              <f.FormField
                id="row-matrix"
                label="Events and channels"
                description="Per event, the channels that reach the buyer who owns the part."
                layout="stack"
              >
                <CheckboxMatrix
                  aria-label="Events and channels"
                  rows={EVENTS}
                  columns={CHANNELS}
                  rowsLabel="Event"
                  columnToggles
                  cellState={(row, column) =>
                    row.id === 'out' && column.id === 'app' ? 'locked' : undefined
                  }
                />
              </f.FormField>
            )}
          </form.AppField>
          <form.Footer
            floating
            actions={[
              { label: 'Discard', onClick: () => form.reset() },
              { label: 'Save changes', primary: true },
            ]}
          />
        </div>
      </form.Form>
    </form.AppForm>
  )
}

function WorkspacePane(): ReactElement {
  return (
    <div data-shot="workspace" className="flex flex-col gap-10">
      <FormSection title="Exports" description="What leaves the inventory.">
        <FormActionRow
          id="row-export"
          label="Export stock list"
          description="Every part with its stock, value and supplier, as a CSV."
          action={<Button>Export</Button>}
        />
      </FormSection>
      <FormSection title="Danger zone" description="None of this can be undone.">
        <FormConfirmRow
          id="row-delete"
          label="Delete inventory"
          description="Removes every part, supplier, order and note."
          confirmText="central-stores"
          actionLabel="Delete inventory"
          onConfirm={() => later(600)}
        />
      </FormSection>
    </div>
  )
}

/** The page's one URL field: the pane it shows. The route wires it. */
export const settingsControls = defineControls({
  id: 'ref-settings',
  scope: 'page',
  fields: {
    section: field
      .enum(SECTIONS, 'reordering', { history: 'push' })
      .labels(Object.fromEntries(SECTIONS.map((id) => [id, COPY[id].title]))),
  },
})
const section = settingsControls.field.section

const GROUPS = [
  {
    id: 'inventory',
    label: 'Inventory',
    items: [
      { id: 'reordering', label: 'Reordering', icon: Boxes },
      { id: 'notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [{ id: 'workspace', label: 'Workspace', icon: Building2 }],
  },
]

function SettingsPane({ id, hash }: { id: SectionId; hash: string }): ReactElement {
  const { title, body } = COPY[id]
  return (
    <SettingsLayout title={title} description={body} {...(hash !== '' && { row: hash })}>
      {id === 'reordering' && <ReorderingPane />}
      {id === 'notifications' && <NotificationsPane />}
      {id === 'workspace' && <WorkspacePane />}
    </SettingsLayout>
  )
}

export type SettingsPageProps = {
  /** The URL hash: the row of the pane to open at, or the empty string. The route reads it from the router. */
  hash: string
}

/** The reference settings page: an inner nav of panes, each a column of bordered sections of rows. */
export function SettingsPage({ hash }: SettingsPageProps): ReactElement {
  const [current] = section.use()
  const selected = section.useIsSet()
  return (
    <Page area="ref-settings">
      <PageBar title="Inventory settings" />
      <SplitPage
        selected={selected}
        onBack={section.clear}
        backLabel="Inventory settings"
        list={() => <InnerNav label="Inventory settings" state={section} groups={GROUPS} />}
        detail={() => <SettingsPane id={current} hash={hash} />}
      />
    </Page>
  )
}
