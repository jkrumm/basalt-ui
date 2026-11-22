import { WizardDialog } from 'basalt-ui/controls'
import { useAppForm } from 'basalt-ui/form'
import { Facts, Section } from 'basalt-ui/page'
import { Button } from 'basalt-ui/ui/button'
import { Dialog, DialogContent, DialogTrigger } from 'basalt-ui/ui/dialog'
import { Input } from 'basalt-ui/ui/input'
import { NumberField } from 'basalt-ui/ui/number-field'
import { RadioGroup } from 'basalt-ui/ui/radio-group'
import { Segmented } from 'basalt-ui/ui/segmented'
import { Switch } from 'basalt-ui/ui/switch'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { z } from 'zod'
import { later } from './-specimen'

const PLANS = [
  { value: 'starter', label: 'Starter', description: 'One workspace, community support.' },
  { value: 'team', label: 'Team', description: 'Shared workspaces and roles.' },
  { value: 'business', label: 'Business', description: 'Single sign-on and audit log.' },
  { value: 'scale', label: 'Scale', description: 'Higher limits and a named contact.' },
  { value: 'enterprise', label: 'Enterprise', description: 'Custom terms and invoicing.' },
] as const
const CYCLES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual' },
] as const

const Values = z.object({
  customer: z.string().trim().min(2, 'Name the customer.'),
  title: z.string().trim().min(2, 'Give the contract a title.'),
  plan: z.enum(['starter', 'team', 'business', 'scale', 'enterprise']),
  seats: z.number().int().min(1, 'At least one seat.').nullable(),
  cycle: z.enum(['monthly', 'annual']),
  autoRenew: z.boolean(),
  signer: z.string().trim().min(2, 'Name the signer.'),
  email: z.email('Use a full address, like ada@example.com.'),
})
type Values = z.infer<typeof Values>

const EMPTY: Values = {
  customer: '',
  title: '',
  plan: 'team',
  seats: 5,
  cycle: 'annual',
  autoRenew: true,
  signer: '',
  email: '',
}

const labelOf = (list: readonly { value: string; label: string }[], value: string): string =>
  list.find((o) => o.value === value)?.label ?? value

const ok = (schema: z.ZodType): ((v: Values) => boolean) => {
  return (v) => schema.safeParse(v).success
}

const CUSTOMER = Values.pick({ customer: true, title: true })
const PLAN = Values.pick({ plan: true, seats: true })
const SIGNER = Values.pick({ signer: true, email: true })

/** The contract as it takes shape: every line follows the form. */
function ContractCard({ v }: { v: Values }): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="m-0 text-xs text-muted-foreground">Contract</p>
        <p className="m-0 text-lg font-medium">{v.title === '' ? 'Untitled contract' : v.title}</p>
        <p className="m-0 text-sm text-muted-foreground">
          {v.customer === '' ? 'No customer yet' : v.customer}
        </p>
      </div>
      <Facts
        rows={[
          { label: 'Plan', value: labelOf(PLANS, v.plan) },
          { label: 'Seats', value: v.seats === null ? 'None' : String(v.seats) },
          {
            label: 'Billing',
            value: `${labelOf(CYCLES, v.cycle)}${v.autoRenew ? ', renews' : ''}`,
          },
          { label: 'Signer', value: v.signer === '' ? 'Not set' : v.signer },
        ]}
      />
    </div>
  )
}

/**
 * A five-step create flow in one split dialog: the contract previews live on the left, the form
 * takes the right, and the review lists every answer with a jump back. The draft survives a reload.
 */
export function ContractWizard(): ReactElement {
  const [open, setOpen] = useState(false)
  const [created, setCreated] = useState<string | null>(null)
  const form = useAppForm({
    defaultValues: EMPTY,
    onSubmit: async ({ value }) => {
      await later(600)
      setCreated(value.title)
      setOpen(false)
      form.reset(EMPTY)
    },
  })
  const steps = [
    {
      label: 'Customer',
      title: 'Who is the contract for?',
      help: 'The customer and a title you will recognise later.',
      valid: ok(CUSTOMER),
      summary: (v: Values) => [
        { label: 'Customer', value: v.customer },
        { label: 'Title', value: v.title },
      ],
      render: () => (
        <>
          <form.AppField name="customer" validators={{ onDynamic: Values.shape.customer }}>
            {(f) => (
              <f.FormField label="Customer" required>
                <Input autoComplete="organization" />
              </f.FormField>
            )}
          </form.AppField>
          <form.AppField name="title" validators={{ onDynamic: Values.shape.title }}>
            {(f) => (
              <f.FormField label="Title" required>
                <Input autoComplete="off" />
              </f.FormField>
            )}
          </form.AppField>
        </>
      ),
    },
    {
      label: 'Plan',
      title: 'Pick a plan',
      help: 'Seats can change later; the plan sets the limits.',
      valid: ok(PLAN),
      summary: (v: Values) => [
        { label: 'Plan', value: labelOf(PLANS, v.plan) },
        { label: 'Seats', value: v.seats ?? 'None' },
      ],
      render: () => (
        <>
          <form.AppField name="plan">
            {(f) => (
              <f.FormField label="Plan">
                <RadioGroup options={PLANS} />
              </f.FormField>
            )}
          </form.AppField>
          <form.AppField name="seats" validators={{ onDynamic: Values.shape.seats }}>
            {(f) => (
              <f.FormField label="Seats" required>
                <NumberField min={1} max={500} />
              </f.FormField>
            )}
          </form.AppField>
        </>
      ),
    },
    {
      label: 'Billing',
      title: 'How is it billed?',
      help: 'Annual billing is invoiced once, up front.',
      valid: () => true,
      summary: (v: Values) => [
        { label: 'Cycle', value: labelOf(CYCLES, v.cycle) },
        { label: 'Renewal', value: v.autoRenew ? 'Renews automatically' : 'Ends at term' },
      ],
      render: () => (
        <>
          <form.AppField name="cycle">
            {(f) => (
              <f.FormField label="Billing cycle">
                <Segmented aria-label="Billing cycle" options={CYCLES} />
              </f.FormField>
            )}
          </form.AppField>
          <form.AppField name="autoRenew">
            {(f) => (
              <f.FormField
                label="Renew automatically"
                description="Renews at the end of each term."
              >
                <Switch />
              </f.FormField>
            )}
          </form.AppField>
        </>
      ),
    },
    {
      label: 'Signer',
      title: 'Who signs?',
      help: 'The contract is sent to this address.',
      valid: ok(SIGNER),
      summary: (v: Values) => [
        { label: 'Signer', value: v.signer },
        { label: 'Email', value: v.email },
      ],
      render: () => (
        <>
          <form.AppField name="signer" validators={{ onDynamic: Values.shape.signer }}>
            {(f) => (
              <f.FormField label="Signer" required>
                <Input autoComplete="name" />
              </f.FormField>
            )}
          </form.AppField>
          <form.AppField name="email" validators={{ onDynamic: Values.shape.email }}>
            {(f) => (
              <f.FormField label="Email" required>
                <Input type="email" autoComplete="email" inputMode="email" />
              </f.FormField>
            )}
          </form.AppField>
        </>
      ),
    },
  ] as const
  return (
    <Section
      title="New contract"
      summary="A split dialog: the contract previews live, five steps, a review and a draft that survives a reload."
    >
      <div className="flex flex-col items-start gap-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="primary" />}>New contract</DialogTrigger>
          <DialogContent
            size="split"
            title="New contract"
            description="Five steps: customer, plan, billing, signer and a review."
          >
            <WizardDialog
              form={form}
              steps={steps}
              preview={(v) => <ContractCard v={v} />}
              submitLabel="Create contract"
              draft={{ key: 'kit-contract-wizard', version: 1, owner: null, schema: Values }}
            />
          </DialogContent>
        </Dialog>
        {created !== null && <p className="m-0 text-sm">{created} was created.</p>}
      </div>
    </Section>
  )
}
