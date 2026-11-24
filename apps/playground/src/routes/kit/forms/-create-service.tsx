import { useQueryClient } from '@tanstack/react-query'
import { FormRow, toSubmitErrors } from 'basalt-ui/controls'
import { useAppForm } from 'basalt-ui/form'
import { Section } from 'basalt-ui/page'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { Button } from 'basalt-ui/ui/button'
import {
  Combobox,
  ComboboxChips,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
} from 'basalt-ui/ui/combobox'
import { Dialog, DialogContent, DialogTrigger } from 'basalt-ui/ui/dialog'
import { Input } from 'basalt-ui/ui/input'
import { NumberField } from 'basalt-ui/ui/number-field'
import { Select } from 'basalt-ui/ui/select'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { z } from 'zod'
import { fixtureKey, useFixture } from '../../../demo/fixture'
import { LABELS, Link, Plus, TEAMS, TIME_ZONES, later } from './-specimen'

export type Service = {
  id: string
  name: string
  team: string
  repo: string
  zone: string | null
  replicas: number | null
  labels: string[]
}
type Values = Omit<Service, 'id'>

const TEAM_LABEL: Record<string, string> = Object.fromEntries(TEAMS.map((t) => [t.value, t.label]))

const SEED: readonly Service[] = [
  {
    id: 's-1',
    name: 'checkout',
    team: 'payments',
    repo: 'https://git.example.com/payments/checkout',
    zone: 'Europe/Berlin',
    replicas: 6,
    labels: ['customer-facing'],
  },
  {
    id: 's-2',
    name: 'search-api',
    team: 'search',
    repo: 'https://git.example.com/search/api',
    zone: 'America/New_York',
    replicas: 4,
    labels: ['customer-facing'],
  },
  {
    id: 's-3',
    name: 'ledger',
    team: 'payments',
    repo: 'https://git.example.com/payments/ledger',
    zone: 'Europe/Berlin',
    replicas: 3,
    labels: ['customer-facing'],
  },
]

// A name the server already holds comes back from the save as a field error.
const NAME = z
  .string()
  .min(3, 'Use at least 3 characters.')
  .regex(/^[a-z][a-z0-9-]*$/, 'Use lowercase letters, digits and dashes, starting with a letter.')
const REPO = z.url('Enter the repository URL, like https://git.example.com/team/name.')
const ZONE = z.string('Pick the zone its schedules run in.')
const REPLICAS = z.number('Enter a number.').int().min(1, 'At least 1.').max(20, 'At most 20.')

function CreateServiceForm({
  taken,
  onCreated,
  onCancel,
}: {
  taken: ReadonlySet<string>
  onCreated: (values: Values) => void
  onCancel: () => void
}): ReactElement {
  const save = async (values: Values): Promise<void> => {
    await later(500)
    if (taken.has(values.name)) {
      throw { fieldErrors: { name: `A service named ${values.name} exists. Pick another name.` } }
    }
  }
  const form = useAppForm({
    // useAppForm checks each field on blur, every field on submit, and after a submit on every change, so a fix
    // clears its error at once.
    defaultValues: {
      name: '',
      team: 'platform',
      repo: '',
      zone: null,
      replicas: 2,
      labels: [],
    } as Values,
    validators: { onSubmitAsync: toSubmitErrors(save) },
    onSubmit: ({ value }) => {
      onCreated(value)
    },
  })
  return (
    <form.AppForm>
      <form.Form className="flex flex-col gap-4">
        <form.AppField name="name" validators={{ onDynamic: NAME }}>
          {(f) => (
            <f.FormField
              label="Name"
              description="Lowercase, as it appears in URLs. Try checkout to see a server error."
              required
            >
              <Input autoComplete="off" spellCheck={false} />
            </f.FormField>
          )}
        </form.AppField>
        <FormRow>
          <form.AppField name="team">
            {(f) => (
              <f.FormField label="Team">
                <Select aria-label="Team" options={TEAMS} />
              </f.FormField>
            )}
          </form.AppField>
          <form.AppField name="replicas" validators={{ onDynamic: REPLICAS }}>
            {(f) => (
              <f.FormField label="Replicas" required>
                <NumberField min={1} max={20} />
              </f.FormField>
            )}
          </form.AppField>
        </FormRow>
        <form.AppField name="repo" validators={{ onDynamic: REPO }}>
          {(f) => (
            <f.FormField label="Repository" required>
              <Input
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://"
                start={Link}
              />
            </f.FormField>
          )}
        </form.AppField>
        <form.AppField name="zone" validators={{ onDynamic: ZONE }}>
          {(f) => (
            <f.FormField label="Time zone" description="Where its schedules run." required>
              <Combobox items={TIME_ZONES}>
                <ComboboxInput aria-label="Time zone" placeholder="Search zones" />
                <ComboboxContent empty="No zone matches.">
                  {(zone: string) => (
                    <ComboboxItem key={zone} value={zone}>
                      {zone}
                    </ComboboxItem>
                  )}
                </ComboboxContent>
              </Combobox>
            </f.FormField>
          )}
        </form.AppField>
        <form.AppField name="labels">
          {(f) => (
            <f.FormField label="Labels" description="Pick one or type a new one.">
              <Combobox multiple items={LABELS} onCreate={(text) => text.trim().toLowerCase()}>
                <ComboboxChips aria-label="Labels" placeholder="Add a label" />
                <ComboboxContent empty="No label matches.">
                  {(label: string) => (
                    <ComboboxItem key={label} value={label}>
                      {label}
                    </ComboboxItem>
                  )}
                </ComboboxContent>
              </Combobox>
            </f.FormField>
          )}
        </form.AppField>
        <form.Footer
          actions={[
            { label: 'Cancel', onClick: onCancel },
            { label: 'Create service', primary: true },
          ]}
        />
      </form.Form>
    </form.AppForm>
  )
}

const SERVICES_KEY = ['kit-forms', 'services'] as const

const c = col<Service>()
const columns = [
  c.entity('name', { header: 'Service', sub: (s) => s.repo, subMono: true }),
  c.status('team', {
    header: 'Team',
    priority: 1,
    card: 'meta',
    options: TEAMS.map((t): string => t.value),
    labels: TEAM_LABEL,
  }),
  c.text('zone', { header: 'Time zone', priority: 2 }),
  c.number('replicas', { header: 'Replicas' }),
]

/** A record created in a dialog: the table of services and the New service dialog over it. */
export function CreateService(): ReactElement {
  // The services list is the endpoint's answer; a created service is written into the same query.
  const services = useFixture(SERVICES_KEY, SEED)
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const table = useDataTable({
    id: 'kit-forms-services',
    label: 'Services',
    columns,
    data: services.data,
    phase: services,
    getRowId: (s) => s.id,
    mode: { kind: 'client' },
  })
  return (
    <Section
      title="Create a record in a dialog"
      summary="TanStack Form binds every field through FormField; the save maps its errors with toSubmitErrors."
    >
      <div className="flex flex-col gap-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="primary" className="self-start" />}>
            <Plus />
            New service
          </DialogTrigger>
          <DialogContent
            title="New service"
            description="It starts with one deploy of the default branch."
            size="lg"
          >
            <CreateServiceForm
              taken={new Set((services.data ?? []).map((s) => s.name))}
              onCreated={(values) => {
                queryClient.setQueryData<readonly Service[]>(
                  fixtureKey(SERVICES_KEY),
                  (prev = []) => [{ id: `s-${String(prev.length + 1)}`, ...values }, ...prev],
                )
                setOpen(false)
              }}
              onCancel={() => {
                setOpen(false)
              }}
            />
          </DialogContent>
        </Dialog>
        <DataTable table={table} />
      </div>
    </Section>
  )
}
