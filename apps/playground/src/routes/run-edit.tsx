// theme-allow-file raw-selection-control — the guard reads a 2.x `Select` as a bare filter; these are v3 `Select`s bound to a form field, never a page filter
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { FormField, FormFooter, FormRow, useFormDraft } from 'basalt-ui/controls'
import { Page, PageBar, Section } from 'basalt-ui/page'
import { Fieldset, Form } from 'basalt-ui/ui/field'
import { Input } from 'basalt-ui/ui/input'
import { Select } from 'basalt-ui/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'basalt-ui/ui/tabs'
import { Textarea } from 'basalt-ui/ui/textarea'
import type { ReactElement } from 'react'
import { useV3Tokens } from '../demo/v3-tokens'
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
  const draft = useFormDraft(form, {
    key: `run-edit:${run.id}`,
    version: 1,
    schema: RunSchema,
    owner: 'demo',
  })

  async function submit(): Promise<void> {
    await form.handleSubmit()
    if (!form.state.isSubmitSuccessful) return
    draft.clear()
    form.reset(form.state.values)
  }

  return (
    <Form
      noValidate
      className="max-w-2xl"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <Fieldset disabled={form.state.isSubmitting}>
        <p role="status" className="m-0 text-sm text-muted-foreground empty:hidden">
          {draft.status === 'restored' ? 'Draft restored from this device.' : null}
        </p>
        <Tabs defaultValue="details">
          <TabsList aria-label="Run sections" className="p-1">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="gear">Gear</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="flex flex-col gap-4 pt-4">
            <form.Field name="title" validators={titleFree(runsApi.titleTaken)}>
              {(f) => (
                <FormField label="Title" required field={f}>
                  <Input />
                </FormField>
              )}
            </form.Field>
            <FormRow>
              <form.Field name="kind">
                {(f) => (
                  <FormField label="Kind" field={f}>
                    <Select aria-label="Kind" options={KINDS} />
                  </FormField>
                )}
              </form.Field>
              <form.Field name="km">
                {(f) => (
                  <FormField label="Distance (km)" field={f}>
                    <NumberInput />
                  </FormField>
                )}
              </form.Field>
            </FormRow>
            <form.Subscribe selector={(state) => state.values.kind}>
              {(kind) =>
                kind === 'tempo' ? (
                  <form.Field name="intervals">
                    {(f) => (
                      <FormField
                        label="Intervals"
                        description="Only tempo runs have them."
                        field={f}
                      >
                        <NumberInput />
                      </FormField>
                    )}
                  </form.Field>
                ) : null
              }
            </form.Subscribe>
            <form.Field name="notes">
              {(f) => (
                <FormField label="Notes" field={f}>
                  <Textarea rows={4} />
                </FormField>
              )}
            </form.Field>
          </TabsContent>
          {/* Mounted on first open: its field never exists while the draft restores. */}
          <TabsContent value="gear" className="flex flex-col gap-4 pt-4">
            <form.Field name="shoes">
              {(f) => (
                <FormField label="Shoes" field={f}>
                  <Select aria-label="Shoes" options={SHOES} />
                </FormField>
              )}
            </form.Field>
          </TabsContent>
        </Tabs>
        <FormFooter form={form} actions={[{ label: 'Save', primary: true }]} />
      </Fieldset>
    </Form>
  )
}

function RunEditPage(): ReactElement {
  useV3Tokens()
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
