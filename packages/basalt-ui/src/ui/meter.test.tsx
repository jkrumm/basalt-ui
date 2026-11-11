import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { IntlScope } from '../core/provider-props'
import type { MeterZone } from '../core/ports'
import { Meter, meterParts } from './meter'

afterEach(cleanup)

const ZONES: [MeterZone, MeterZone, MeterZone] = [
  { to: 0.8, tone: 'info', label: 'Detraining' },
  { to: 1.3, tone: 'good', label: 'Optimal' },
  { to: 2, tone: 'bad', label: 'Overreaching' },
]

describe('meter module', () => {
  test('the part carries data-slot and meterParts lists it', () => {
    const { container } = render(<Meter label="Load" value={1} max={2} />)
    const slots = [...container.querySelectorAll('[data-slot]')].map((el) =>
      el.getAttribute('data-slot'),
    )
    expect(slots).toEqual([...meterParts])
  })

  test('server render keeps the slot', () => {
    expect(renderToString(<Meter label="Load" value={1} max={2} />)).toContain('data-slot="meter"')
  })

  test('is a named meter with its value', () => {
    const { getByRole } = render(<Meter label="Load" value={1} max={2} />)
    const meter = getByRole('meter')
    expect(meter.getAttribute('aria-label')).toBe('Load')
    expect(meter.getAttribute('aria-valuenow')).toBe('1')
    expect(meter.getAttribute('aria-valuemax')).toBe('2')
  })

  test('prints the active zone label as text, and moves with the value', () => {
    const { getByText, queryByText, rerender } = render(
      <Meter label="Load" value={1.1} max={2} zones={ZONES} />,
    )
    expect(getByText('Optimal')).toBeTruthy()
    expect(queryByText('Overreaching')).toBeNull()
    rerender(<Meter label="Load" value={1.7} max={2} zones={ZONES} />)
    expect(getByText('Overreaching')).toBeTruthy()
    expect(queryByText('Optimal')).toBeNull()
  })

  test('a value on a boundary belongs to the lower zone; one past the last stays in the last', () => {
    const { getByText, rerender } = render(<Meter label="L" value={0.8} max={2} zones={ZONES} />)
    expect(getByText('Detraining')).toBeTruthy()
    rerender(<Meter label="L" value={5} max={2} zones={ZONES} />)
    expect(getByText('Overreaching')).toBeTruthy()
  })

  test('the value text names the zone', () => {
    const { getByRole } = render(<Meter label="Load" value={1.1} max={2} zones={ZONES} />)
    expect(getByRole('meter').getAttribute('aria-valuetext')).toBe('1.1, Optimal')
  })

  test('draws one tinted segment per zone and a marker', () => {
    const { container } = render(<Meter label="Load" value={1.1} max={2} zones={ZONES} />)
    expect(container.querySelectorAll('rect')).toHaveLength(3)
    expect(container.querySelector('line')).not.toBeNull()
  })

  test('without zones it is a plain fill with no zone word', () => {
    const { container } = render(<Meter label="Disk" value={30} max={100} tone="warn" />)
    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('[data-fill]')).not.toBeNull()
    expect(container.firstElementChild?.className).toContain('bg-warn')
  })

  test('null value prints a dash and draws no marker', () => {
    const { container, getByRole } = render(
      <Meter label="Load" value={null} max={2} zones={ZONES} />,
    )
    expect(container.querySelector('line')).toBeNull()
    expect(getByRole('meter').getAttribute('aria-valuetext')).toBe('—')
  })

  test('format prints the value; the page locale prints it by default', () => {
    const { getByText, rerender } = render(
      <Meter label="L" value={1.1} max={2} format={(v) => `${v.toFixed(2)} ACWR`} />,
    )
    expect(getByText('1.10 ACWR')).toBeTruthy()
    rerender(
      <IntlScope locale="de-DE">
        <Meter label="L" value={1.5} max={2} />
      </IntlScope>,
    )
    expect(getByText('1,5')).toBeTruthy()
  })
})
