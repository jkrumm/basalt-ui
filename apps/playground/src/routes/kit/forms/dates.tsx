import { createFileRoute } from '@tanstack/react-router'
import { FormField } from 'basalt-ui/controls'
import { Page, Section } from 'basalt-ui/page'
import { DatePicker, DateRangePicker } from 'basalt-ui/ui/date-picker'
import type { CalendarDate } from 'basalt-ui'
import type { CalendarRange } from 'basalt-ui/ui/date-picker'
import { Slider } from 'basalt-ui/ui/slider'
import type { ReactElement, ReactNode } from 'react'
import { useSpecimen } from './-specimen'

function Pair({ children }: { children: ReactNode }): ReactElement {
  return <div className="grid max-w-5xl gap-6 @regular:grid-cols-2">{children}</div>
}

/**
 * The pickers take `onChange`, not the `onValueChange` FormField hands its child, so each one names
 * `onChange` itself (docs/v3/verdicts/showcase-gaps.md, Forms).
 */
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
        <DatePicker aria-label="Launch day" onChange={launch.handleChange} />
      </FormField>
      <FormField
        label="Deploy freeze"
        description="DateRangePicker: reported once both ends are picked."
        field={freeze}
      >
        <DateRangePicker aria-label="Deploy freeze" onChange={freeze.handleChange} />
      </FormField>
    </Pair>
  )
}

function Scales(): ReactElement {
  const cpu = useSpecimen(60)
  const latency = useSpecimen<[number, number]>([120, 480])
  return (
    <Pair>
      <FormField
        label="CPU alert at"
        description={`Alerts above ${String(cpu.state.value)}%; approximate is fine, 5% steps.`}
        field={cpu}
      >
        <Slider min={0} max={100} step={5} format={{ style: 'unit', unit: 'percent' }} />
      </FormField>
      <FormField
        label="Latency band (ms)"
        description={`From ${String(latency.state.value[0])} to ${String(latency.state.value[1])} ms; two thumbs, each named.`}
        field={latency}
      >
        <Slider
          min={0}
          max={1000}
          step={20}
          thumbLabels={['Lowest latency', 'Highest latency']}
          format={{ style: 'unit', unit: 'millisecond' }}
        />
      </FormField>
    </Pair>
  )
}

/**
 * Dates and numbers: one day and a span of days as zone-less `YYYY-MM-DD` strings, and a value and a
 * band on a scale. NumberField is held back while the quality matrix fails it.
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
      <Section title="Held back" summary="Parts the quality matrix fails at rest on a page.">
        <p className="m-0 max-w-2xl text-sm text-muted-foreground">
          NumberField is not drawn here: the matrix finds no focus ring on its input and, under a
          coarse pointer, an input 42 px tall under the 44 px floor. It is a row in the Forms list
          of docs/v3/verdicts/showcase-gaps.md; the whole forms (/kit/forms/whole) use it for
          replicas and parallel deploys.
        </p>
      </Section>
    </Page>
  )
}

export const Route = createFileRoute('/kit/forms/dates')({
  staticData: { title: 'Dates and numbers' },
  component: DatesRoute,
})
