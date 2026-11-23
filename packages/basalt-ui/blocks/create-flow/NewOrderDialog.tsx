import { useFormat } from 'basalt-ui'
import { WizardDialog } from 'basalt-ui/controls'
import { useAppForm } from 'basalt-ui/form'
import { Facts } from 'basalt-ui/page'
import { DatePicker } from 'basalt-ui/ui/date-picker'
import { Dialog, DialogContent } from 'basalt-ui/ui/dialog'
import { EntityTitle } from 'basalt-ui/ui/entity'
import { Input } from 'basalt-ui/ui/input'
import { NumberField } from 'basalt-ui/ui/number-field'
import { RadioGroup } from 'basalt-ui/ui/radio-group'
import { Select } from 'basalt-ui/ui/select'
import { Factory } from 'lucide-react'
import type { ReactElement } from 'react'
import { z } from 'zod'
import { WAREHOUSES } from './model'
import type { Part, Supplier } from './model'

const DAY = 86_400_000

const Values = z.object({
  supplierId: z.string().min(1, 'Pick a supplier.'),
  reference: z.string().trim().max(40, 'Keep the reference under 40 characters.'),
  part: z.string().min(1, 'Pick the part to order.'),
  quantity: z.number().int().min(1, 'Order at least one.').nullable(),
  warehouse: z.enum(['main', 'line-2', 'quarantine']),
  due: z.string().min(1, 'Pick the day it is due.').nullable(),
})
type Values = z.infer<typeof Values>

const ok =
  (schema: z.ZodType) =>
  (v: Values): boolean =>
    schema.safeParse(v).success

const SUPPLIER_STEP = Values.pick({ supplierId: true, reference: true })
const lineStep = (parts: readonly Part[]) =>
  Values.pick({ supplierId: true, part: true, quantity: true }).refine(
    (v) => v.quantity !== null && parts.find((p) => p.id === v.part)?.supplierId === v.supplierId,
  )
const DELIVERY_STEP = Values.pick({ warehouse: true, due: true }).refine((v) => v.due !== null)

const dayAfter = (now: number, days: number): string =>
  new Date(now + days * DAY).toISOString().slice(0, 10)

/** The order as it takes shape: every line follows the form. */
function OrderPreview({
  v,
  suppliers,
  parts,
}: {
  v: Values
  suppliers: readonly Supplier[]
  parts: readonly Part[]
}): ReactElement {
  const f = useFormat()
  const supplier = suppliers.find((s) => s.id === v.supplierId)
  const part = parts.find((p) => p.id === v.part)
  const total = part === undefined || v.quantity === null ? null : part.unitCost * v.quantity
  const warehouse = WAREHOUSES.find((w) => w.value === v.warehouse)
  return (
    <div className="flex flex-col gap-4">
      <EntityTitle
        size="lg"
        title={supplier?.name ?? 'No supplier yet'}
        subtitle={v.reference === '' ? 'Purchase order, draft' : `Reference ${v.reference}`}
        avatar={{ shape: 'object', icon: Factory }}
      />
      <Facts
        rows={[
          {
            label: 'Part',
            value:
              part === undefined ? 'Pick a part on the next step' : `${part.sku}, ${part.name}`,
          },
          {
            label: 'Quantity',
            value: v.quantity === null ? 'Set with the part' : `${v.quantity} pcs`,
          },
          {
            label: 'Unit cost',
            value: part === undefined ? 'From the part' : f.money(part.unitCost, 'EUR'),
          },
          { label: 'Total', value: total === null ? 'Part times quantity' : f.money(total, 'EUR') },
          { label: 'Deliver to', value: warehouse?.label ?? 'Not picked' },
          { label: 'Due', value: v.due === null ? 'Not set' : f.date(Date.parse(v.due)) },
        ]}
      />
    </div>
  )
}

export type NewOrderDialogProps = {
  /** The supplier the order starts with. */
  supplier: Supplier
  /** The supplier options the supplier step offers. */
  suppliers: readonly Supplier[]
  /** The parts the line step offers, matched to the chosen supplier. */
  parts: readonly Part[]
  /** The reading time in ms: the default due day starts at the quoted lead time from it. */
  now: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The reference create flow: a new purchase order in the split wizard dialog, three steps and a
 * review, the order previewed live beside the form; the draft survives a reload.
 */
export function NewOrderDialog({
  supplier,
  suppliers,
  parts,
  now,
  open,
  onOpenChange,
}: NewOrderDialogProps): ReactElement {
  const start: Values = {
    supplierId: supplier.id,
    reference: '',
    part: '',
    quantity: null,
    warehouse: 'main',
    due: dayAfter(now, supplier.leadDays),
  }
  const form = useAppForm({
    defaultValues: start,
    onSubmit: async () => {
      onOpenChange(false)
      form.reset(start)
    },
  })
  const steps = [
    {
      label: 'Supplier',
      title: 'Who is the order for?',
      help: 'The supplier and a reference their confirmation will quote.',
      valid: ok(SUPPLIER_STEP),
      summary: (v: Values) => [
        { label: 'Supplier', value: suppliers.find((s) => s.id === v.supplierId)?.name ?? 'None' },
        { label: 'Reference', value: v.reference === '' ? 'No reference' : v.reference },
      ],
      render: () => (
        <>
          <form.AppField name="supplierId" validators={{ onBlur: Values.shape.supplierId }}>
            {(f) => (
              <f.FormField label="Supplier" required>
                <Select
                  aria-label="Supplier"
                  options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                />
              </f.FormField>
            )}
          </form.AppField>
          <form.AppField name="reference" validators={{ onBlur: Values.shape.reference }}>
            {(f) => (
              <f.FormField label="Reference" description="Optional, up to 40 characters.">
                <Input autoComplete="off" />
              </f.FormField>
            )}
          </form.AppField>
        </>
      ),
    },
    {
      label: 'Line',
      title: 'What is ordered?',
      help: 'One part per order line; add more lines on the order page.',
      valid: ok(lineStep(parts)),
      summary: (v: Values) => [
        { label: 'Part', value: parts.find((p) => p.id === v.part)?.sku ?? 'None' },
        { label: 'Quantity', value: v.quantity === null ? 'None' : `${v.quantity} pcs` },
      ],
      render: () => (
        <form.Subscribe selector={(state) => state.values.supplierId}>
          {(supplierId) => (
            <>
              <form.AppField name="part" validators={{ onBlur: Values.shape.part }}>
                {(f) => (
                  <f.FormField label="Part" description="Parts this supplier delivers." required>
                    <Select
                      aria-label="Part"
                      options={parts
                        .filter((p) => p.supplierId === supplierId)
                        .map((p) => ({
                          value: p.id,
                          label: `${p.sku}, ${p.name}`,
                        }))}
                    />
                  </f.FormField>
                )}
              </form.AppField>
              <form.AppField name="quantity" validators={{ onBlur: Values.shape.quantity }}>
                {(f) => (
                  <f.FormField label="Quantity" description="In pieces." required>
                    <NumberField min={1} max={100_000} />
                  </f.FormField>
                )}
              </form.AppField>
            </>
          )}
        </form.Subscribe>
      ),
    },
    {
      label: 'Delivery',
      title: 'Where and when does it arrive?',
      help: 'The due day starts at the quoted lead time.',
      valid: ok(DELIVERY_STEP),
      summary: (v: Values) => [
        {
          label: 'Deliver to',
          value: WAREHOUSES.find((w) => w.value === v.warehouse)?.label ?? 'None',
        },
        { label: 'Due', value: v.due ?? 'None' },
      ],
      render: () => (
        <>
          <form.AppField name="warehouse">
            {(f) => (
              <f.FormField label="Deliver to">
                <RadioGroup variant="card" aria-label="Deliver to" options={WAREHOUSES} />
              </f.FormField>
            )}
          </form.AppField>
          <form.AppField name="due" validators={{ onBlur: Values.shape.due }}>
            {(f) => (
              <f.FormField label="Due" required>
                <DatePicker aria-label="Due" />
              </f.FormField>
            )}
          </form.AppField>
        </>
      ),
    },
  ] as const
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-shot="new-order"
        size="split"
        title="New purchase order"
        description="Three steps: supplier, line and delivery, then a review."
      >
        <WizardDialog
          form={form}
          steps={steps}
          preview={(v) => <OrderPreview v={v} suppliers={suppliers} parts={parts} />}
          submitLabel="Place order"
          draft={{ key: `ref-new-order-${supplier.id}`, version: 1, owner: null, schema: Values }}
        />
      </DialogContent>
    </Dialog>
  )
}
