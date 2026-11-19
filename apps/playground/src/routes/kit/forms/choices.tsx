import { createFileRoute } from '@tanstack/react-router'
import { FormField } from 'basalt-ui/controls'
import { Page, Section } from 'basalt-ui/page'
import { Checkbox, CheckboxGroup } from 'basalt-ui/ui/checkbox'
import { Radio, RadioGroup } from 'basalt-ui/ui/radio-group'
import { Segmented } from 'basalt-ui/ui/segmented'
import { Select } from 'basalt-ui/ui/select'
import type { ReactElement, ReactNode } from 'react'
import { ENVIRONMENTS, EVENTS, SIZES, STRATEGIES, STRATEGY_HINT, useSpecimen } from './-specimen'
import type { Strategy } from './-specimen'

/** Two fields a row from `@regular`, one on a phone. */
function Pair({ children }: { children: ReactNode }): ReactElement {
  return <div className="grid max-w-5xl gap-6 @regular:grid-cols-2">{children}</div>
}

function OneOfFew(): ReactElement {
  const environment = useSpecimen<string | null>('production')
  const strategy = useSpecimen<Strategy>('rolling')
  const size = useSpecimen('m')
  return (
    <Pair>
      <FormField
        label="Environment"
        description="Select: fewer than ten known values."
        field={environment}
      >
        <Select aria-label="Environment" options={ENVIRONMENTS} placeholder="Choose one" />
      </FormField>
      <FormField
        label="Instance size"
        description="Segmented: two to five short options."
        field={size}
      >
        <Segmented aria-label="Instance size" options={SIZES} />
      </FormField>
      <FormField
        label="Rollout"
        description={`RadioGroup: a few options seen at once. ${STRATEGY_HINT}`}
        field={strategy}
      >
        <RadioGroup aria-label="Rollout">
          {STRATEGIES.map((s) => (
            <label key={s.value} className="flex items-center gap-2 text-sm">
              <Radio value={s.value} />
              {s.label}
            </label>
          ))}
        </RadioGroup>
      </FormField>
    </Pair>
  )
}

function PickSeveral(): ReactElement {
  const events = useSpecimen<string[]>(['deploy-failed', 'incident'])
  return (
    <Pair>
      <FormField
        label="Notify me when"
        description="CheckboxGroup: independent choices."
        field={events}
      >
        <CheckboxGroup aria-label="Notify me when">
          {EVENTS.map((e) => (
            <label key={e.value} className="flex items-center gap-2 text-sm">
              <Checkbox value={e.value} />
              {e.label}
            </label>
          ))}
        </CheckboxGroup>
      </FormField>
    </Pair>
  )
}

/**
 * The choice controls on a deploy's real options: its environments, sizes, rollouts and events. The
 * search parts are held back while the quality matrix fails them. Each field is local state behind
 * FormField's `FieldLike` port; /kit/forms/whole binds the same controls to TanStack Form.
 */
function ChoicesRoute(): ReactElement {
  return (
    <Page area="kit-forms-choices">
      <Section title="One of a few" summary="Select, Segmented and RadioGroup.">
        <OneOfFew />
      </Section>
      <Section title="Several" summary="Several values at once.">
        <PickSeveral />
      </Section>
      <Section title="Held back" summary="Parts the quality matrix fails at rest on a page.">
        <p className="m-0 max-w-2xl text-sm text-muted-foreground">
          The searchable Combobox, Autocomplete, the Combobox with chips and Switch are not drawn
          here: the matrix finds no focus ring on the three search inputs, inputs and chip remove
          buttons under the 24 px hit floor, and a Switch frame that vanishes under forced colours.
          Each is a row in the Forms list of docs/v3/verdicts/showcase-gaps.md; the whole forms
          (/kit/forms/whole) use the time zone Combobox and the language chips in the dialog and the
          settings form.
        </p>
      </Section>
    </Page>
  )
}

export const Route = createFileRoute('/kit/forms/choices')({
  staticData: { title: 'Choices' },
  component: ChoicesRoute,
})
