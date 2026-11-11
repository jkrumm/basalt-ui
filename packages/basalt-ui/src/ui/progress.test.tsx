import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { IntlScope } from '../core/provider-props'
import { Progress, Ring, progressParts } from './progress'

afterEach(cleanup)

describe('progress module', () => {
  test('every part carries data-slot and progressParts lists them', () => {
    const { container } = render(
      <>
        <Progress value={10} aria-label="Upload" />
        <Ring value={10} aria-label="Disk" />
      </>,
    )
    const slots = [...container.querySelectorAll('[data-slot]')].map((el) =>
      el.getAttribute('data-slot'),
    )
    expect(slots).toEqual([...progressParts])
  })

  test('server render keeps the slots', () => {
    const html = renderToString(<Ring value={50} aria-label="Disk" />)
    expect(html).toContain('data-slot="ring"')
  })
})

describe('Progress', () => {
  test('is a progressbar with its name and a percentage value text', () => {
    const { getByRole } = render(<Progress value={40} aria-label="Upload" />)
    const bar = getByRole('progressbar')
    expect(bar.getAttribute('aria-label')).toBe('Upload')
    expect(bar.getAttribute('aria-valuenow')).toBe('40')
    expect(bar.getAttribute('aria-valuetext')).toBe('40%')
  })

  test('the value text follows the page locale', () => {
    const { getByRole } = render(
      <IntlScope locale="de-DE">
        <Progress value={40} aria-label="Upload" />
      </IntlScope>,
    )
    expect(getByRole('progressbar').getAttribute('aria-valuetext')).toBe('40\u00a0%')
  })

  test('null is indeterminate', () => {
    const { getByRole } = render(<Progress value={null} aria-labelledby="h" />)
    const bar = getByRole('progressbar')
    expect(bar.hasAttribute('data-indeterminate')).toBe(true)
    expect(bar.hasAttribute('aria-valuenow')).toBe(false)
  })

  test('tone colours the fill, default accent', () => {
    const { getAllByRole } = render(
      <>
        <Progress value={1} aria-label="a" tone="bad" />
        <Progress value={1} aria-label="b" />
      </>,
    )
    const [bad, accent] = getAllByRole('progressbar')
    expect(bad?.className).toContain('*:bg-bad')
    expect(accent?.className).toContain('*:bg-brand-fill')
  })
})

describe('Ring', () => {
  test('prints the percentage in the middle and exposes it as value text', () => {
    const { getByRole, getByText } = render(<Ring value={42} aria-label="Disk" />)
    expect(getByText('42%')).toBeTruthy()
    const ring = getByRole('progressbar')
    expect(ring.getAttribute('aria-label')).toBe('Disk')
    expect(ring.getAttribute('aria-valuenow')).toBe('42')
    expect(ring.getAttribute('aria-valuetext')).toBe('42%')
  })

  test('de-DE prints the percent with a comma', () => {
    const { getByRole } = render(
      <IntlScope locale="de-DE">
        <Ring value={42.5} aria-label="Speicher" />
      </IntlScope>,
    )
    expect(getByRole('progressbar').getAttribute('aria-valuetext')).toBe('42,5\u00a0%')
  })

  test('digits sets the decimals and min/max rescale', () => {
    const { getByRole } = render(<Ring value={5} min={0} max={8} digits={0} aria-label="x" />)
    expect(getByRole('progressbar').getAttribute('aria-valuetext')).toBe('63%')
  })

  test('the arc is clamped to the scale', () => {
    const { container } = render(<Ring value={250} aria-label="x" />)
    const arc = container.querySelectorAll('circle')[1]
    expect(arc?.getAttribute('stroke-dasharray')).toBe('100 100')
  })
})
