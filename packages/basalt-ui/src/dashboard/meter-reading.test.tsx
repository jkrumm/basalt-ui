import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { Meter } from './meter'
import { StatCard } from './stat-card'
import { StatGroup } from './stat-group'

afterEach(cleanup)

const zones = [
  { from: 0, to: 300, label: 'Low' },
  { from: 300, to: 750, label: 'Optimal' },
  { from: 750, to: 1000, label: 'High' },
]
const meter = <Meter label="Training load" value={612} max={1000} zones={zones} />
const reading = (c: HTMLElement) => c.querySelector('[data-meter-reading-row]')

describe('the marker reading in a host that already shows the value', () => {
  test('standalone: the reading sits at the marker', () => {
    const { container } = render(<MantineProvider>{meter}</MantineProvider>)
    expect(reading(container)).not.toBeNull()
  })

  test('StatCard sparkline slot: no reading, the track and zone labels remain', () => {
    const { container } = render(
      <MantineProvider>
        <StatCard title="Load" value="612" sparkline={meter} />
      </MantineProvider>,
    )
    expect(reading(container)).toBeNull()
    expect(container.querySelector('[role="meter"]')).not.toBeNull()
    expect(container.querySelector('[data-meter-zone-band]')).not.toBeNull()
  })

  test('strip cell visual: no reading', () => {
    const { container } = render(
      <MantineProvider>
        <StatGroup
          variant="strip"
          label="Health"
          cells={[
            { key: 'a', caption: 'Load', value: '612', visual: meter },
            { key: 'b', caption: 'Other', value: '1' },
          ]}
        />
      </MantineProvider>,
    )
    expect(reading(container)).toBeNull()
    expect(container.querySelector('[role="meter"]')).not.toBeNull()
  })

  test('an explicit startCaption still renders in a host', () => {
    const { container, getByText } = render(
      <MantineProvider>
        <StatCard
          title="Load"
          value="612"
          sparkline={
            <Meter
              label="Training load"
              value={612}
              max={1000}
              zones={zones}
              startCaption="Since Monday"
            />
          }
        />
      </MantineProvider>,
    )
    // The consumer's caption is not the reading: it renders where the reading would have.
    expect(getByText('Since Monday')).toBeTruthy()
    expect(reading(container)?.textContent).toBe('Since Monday')
  })

  test('a rows-only strip cell (no hero value) keeps the reading', () => {
    const { container } = render(
      <MantineProvider>
        <StatGroup
          variant="strip"
          label="Health"
          cells={[
            {
              key: 'a',
              caption: 'Load',
              rows: [{ key: 'r', label: 'Acute', value: '612' }],
              visual: meter,
            },
            { key: 'b', caption: 'Other', value: '1' },
          ]}
        />
      </MantineProvider>,
    )
    expect(reading(container)).not.toBeNull()
  })
})

describe('the marker reading on an unzoned marked track (Wave 43)', () => {
  const caption = (c: HTMLElement) => c.querySelector('[data-meter-captions]')
  const weight = (
    <Meter
      label="Weight in the window"
      value={72.3}
      min={72.3}
      max={78.9}
      format={(v) => `${v.toFixed(1)} kg`}
      stops={[
        { at: 72.3, color: 'gray' },
        { at: 78.9, color: 'gray' },
      ]}
      startCaption="low 72.3 kg"
      endCaption="high 78.9 kg"
      readingAt="start"
    />
  )

  test('the reading shares the caption row with the end caption: no reading row of its own', () => {
    const { container } = render(<MantineProvider>{weight}</MantineProvider>)
    expect(reading(container)).toBeNull()
    const row = caption(container)
    expect([...(row?.children ?? [])].map((c) => c.textContent?.replaceAll('\u00a0', ' '))).toEqual(
      ['low 72.3 kg', 'high 78.9 kg'],
    )
  })

  test('a zoned track keeps the reading under its own row', () => {
    const { container } = render(<MantineProvider>{meter}</MantineProvider>)
    expect(reading(container)).not.toBeNull()
    expect(caption(container)?.textContent ?? '').not.toContain('612')
  })
})
