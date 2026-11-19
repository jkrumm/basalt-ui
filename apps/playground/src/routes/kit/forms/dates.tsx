import { createFileRoute } from '@tanstack/react-router'
import { FormField } from 'basalt-ui/controls'
import { Page, Section } from 'basalt-ui/page'
import type { CalendarDate, CalendarRange } from 'basalt-ui/ui/date-picker'
import { DatePicker, DateRangePicker } from 'basalt-ui/ui/date-picker'
import { NumberField } from 'basalt-ui/ui/number-field'
import { Slider } from 'basalt-ui/ui/slider'
import type { ReactElement, ReactNode } from 'react'
import { useSpecimen } from './-specimen'

function Pair({ children }: { children: ReactNode }): ReactElement {
  return <div className="grid max-w-5xl gap-6 @regular:grid-cols-2">{children}</div>
}

function Days(): ReactElement {
  const launch = useSpecimen<CalendarDate | null>('2026-12-01')
  const freeze = useSpecimen<CalendarRange | null>({ from: '2026-12-21', to: '2027-01-04' })
  return (
    <Pair>
      <FormField
        label="Launch day"
        description="DatePicker: one calendar day, no zone."
        field={launch}
      >
        <DatePicker aria-label="Launch day" />
      </FormField>
      <FormField
        label="Deploy freeze"
        description="DateRangePicker: reported once both ends are picked."
        field={freeze}
      >
        <DateRangePicker aria-label="Deploy freeze" />
      </FormField>
    </Pair>
  )
}

function Scales(): ReactElement {
  const cpu = useSpecimen(60)
  const latency = useSpecimen<[number, number]>([120, 480])
  return (
    <Pair>
      <FormField label="CPU alert at" description="Approximate is fine; 5% steps." field={cpu}>
        <Slider min={0} max={100} step={5} showValue format={{ style: 'unit', unit: 'percent' }} />
      </FormField>
      <FormField label="Latency band (ms)" description="Two thumbs, each named." field={latency}>
        <Slider
          min={0}
          max={1000}
          step={20}
          showValue
          thumbLabels={['Lowest latency', 'Highest latency']}
          format={{ style: 'unit', unit: 'millisecond' }}
        />
      </FormField>
    </Pair>
  )
}

function Numbers(): ReactElement {
  const replicas = useSpecimen<number | null>(3)
  const headroom = useSpecimen<number | null>(1.5)
  const price = useSpecimen<number | null>(24.5)
  const errorBudget = useSpecimen<number | null>(0.25)
  return (
    <Pair>
      <FormField label="Replicas" description="A plain integer, from 1 to 20." field={replicas}>
        <NumberField min={1} max={20} />
      </FormField>
      <FormField label="Headroom" description="Steps by 0.5." field={headroom}>
        <NumberField min={0} max={10} step={0.5} format={{ maximumFractionDigits: 1 }} />
      </FormField>
      <FormField label="Price per month" description="Euro, two decimals." field={price}>
        <NumberField min={0} format={{ style: 'currency', currency: 'EUR' }} />
      </FormField>
      <FormField
        label="Error budget"
        description="A percent of requests; steps by 1%."
        field={errorBudget}
      >
        <NumberField min={0} max={1} step={0.01} format={{ style: 'percent' }} />
      </FormField>
    </Pair>
  )
}

/**
 * Dates and numbers: one day and a span of days as zone-less `YYYY-MM-DD` strings, a value and a
 * band on a scale, and a number in four formats.
 */
function DatesRoute(): ReactElement {
  return (
    <Page area="kit-forms-dates">
      <Section title="Days" summary="DatePicker and DateRangePicker.">
        <Days />
      </Section>
      <Section title="On a scale" summary="Slider, with one thumb and with two.">
        <Scales />
      </Section>
      <Section
        title="Numbers"
        summary="NumberField: an integer, a decimal step, currency and percent."
      >
        <Numbers />
      </Section>
    </Page>
  )
}

export const Route = createFileRoute('/kit/forms/dates')({
  staticData: { title: 'Dates and numbers' },
  component: DatesRoute,
})
