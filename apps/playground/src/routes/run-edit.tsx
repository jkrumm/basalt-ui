import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { FormRow, useFormDraft } from 'basalt-ui/controls'
import { Page, PageBar, Section } from 'basalt-ui/page'
import { Input } from 'basalt-ui/ui/input'
import { Select } from 'basalt-ui/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'basalt-ui/ui/tabs'
import { Textarea } from 'basalt-ui/ui/textarea'
import type { ReactElement } from 'react'
import { RunSchema, titleFree, useRunForm } from '../recipes/dependent-validation'
import { runKey, runsApi, useSaveRun } from '../recipes/optimistic'
import type { Run, RunValues } from '../recipes/optimistic'

const KINDS = [
  { value: 'easy', label: 'Easy' },
  { value: 'tempo', label: 'Tempo' },
  { value: 'long', label: 'Long' },
] as const
const SHOES = ['Pegasus 41', 'Vomero 18', 'Alphafly 3'].map((value) => ({ value, label: value }))

/** A number field on a text input: the form keeps a number, the input a string. */
function NumberInput({
  value,
  onValueChange,
  ...rest
}: {
  value?: number
  onValueChange?: (next: number) => void
  onBlur?: () => void
}): ReactElement {
  return (
    <Input
      type="number"
      inputMode="decimal"
      value={String(value ?? '')}
      onValueChange={(next) => onValueChange?.(Number(next))}
      {...rest}
    />
  )
}

const valuesOf = ({ id: _id, ...values }: Run): RunValues => values

function RunEditForm({ run }: { run: Run }): ReactElement {
  const save = useSaveRun(run.id)
  const form = useRunForm({
    defaultValues: valuesOf(run),
    save: (values) => save.mutateAsync(values),
  })
  // `useFormDraft` clears the draft and re-bases the form when the submit succeeds.
  const draft = useFormDraft(form, {
    key: `run-edit:${run.id}`,
    version: 1,
    schema: RunSchema,
    owner: 'demo',
  })

  return (
    <form.AppForm>
      <form.Form className="flex max-w-2xl flex-col gap-4">
        <output className="block text-sm text-muted-foreground empty:hidden">
          {draft.status === 'restored' ? 'Draft restored from this device.' : null}
        </output>
        <Tabs defaultValue="details">
          <TabsList aria-label="Run sections">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="gear">Gear</TabsTrigger>
          </TabsList>
          <TabsContent value="details">
            <div className="flex flex-col gap-4">
              <form.AppField name="title" validators={titleFree(runsApi.titleTaken)}>
                {(f) => (
                  <f.FormField label="Title" required>
                    <Input />
                  </f.FormField>
                )}
              </form.AppField>
              <FormRow>
                <form.AppField name="kind">
                  {(f) => (
                    <f.FormField label="Kind">
                      <Select aria-label="Kind" options={KINDS} />
                    </f.FormField>
                  )}
                </form.AppField>
                <form.AppField name="km">
                  {(f) => (
                    <f.FormField label="Distance (km)">
                      <NumberInput />
                    </f.FormField>
                  )}
                </form.AppField>
              </FormRow>
              <form.Subscribe selector={(state) => state.values.kind}>
                {(kind) =>
                  kind === 'tempo' ? (
                    <form.AppField name="intervals">
                      {(f) => (
                        <f.FormField label="Intervals" description="Only tempo runs have them.">
                          <NumberInput />
                        </f.FormField>
                      )}
                    </form.AppField>
                  ) : null
                }
              </form.Subscribe>
              <form.AppField name="notes">
                {(f) => (
                  <f.FormField label="Notes">
                    <Textarea rows={4} />
                  </f.FormField>
                )}
              </form.AppField>
            </div>
          </TabsContent>
          {/* Mounted on first open: its field never exists while the draft restores. */}
          <TabsContent value="gear">
            <form.AppField name="shoes">
              {(f) => (
                <f.FormField label="Shoes">
                  <Select aria-label="Shoes" options={SHOES} />
                </f.FormField>
              )}
            </form.AppField>
          </TabsContent>
        </Tabs>
        <form.Footer actions={[{ label: 'Save', primary: true }]} />
      </form.Form>
    </form.AppForm>
  )
}

function RunEditPage(): ReactElement {
  const run = useQuery({ queryKey: runKey('r-1'), queryFn: () => runsApi.get() })
  return (
    <Page area="run-edit">
      <PageBar title={run.data?.title ?? 'Edit run'} />
      <Section title="Edit run">
        {run.data === undefined ? (
          <p className="m-0 text-sm text-muted-foreground">Loading the run.</p>
        ) : (
          <RunEditForm run={run.data} />
        )}
      </Section>
    </Page>
  )
}

export const Route = createFileRoute('/run-edit')({
  staticData: { title: 'Edit run' },
  component: RunEditPage,
})
