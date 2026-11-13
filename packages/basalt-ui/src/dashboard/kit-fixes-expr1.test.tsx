/**
 * Expression cycle 1's kit fixes: a strip cell's verdict is a dot and a word, a Meter draws a
 * reading past `max` as over-limit and names a categorical part on its own fill, takes its track
 * height from the size scale (`docs/v3/cycles/expression-1.md` rows .27, .28, .45, .47).
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { Meter } from './meter'
import { modelBar } from './meter-model'
import { StatGroup } from './stat-group'

afterEach(cleanup)

const mount = (node: React.ReactNode) => render(<MantineProvider>{node}</MantineProvider>)

describe('StatStripCell tone', () => {
  test('a toned cell states its verdict as a status dot and a word, beside the value ink', () => {
    const { container } = mount(
      <StatGroup
        variant="strip"
        label="SLO"
        cells={[
          { key: 'a', caption: 'Failures', value: '410', tone: 'bad' },
          { key: 'b', caption: 'Latency', value: '90 ms', tone: 'good' },
          { key: 'c', caption: 'Queue', value: '3' },
        ]}
      />,
    )
    const cell = (key: string) => container.querySelector(`[data-strip-cell="${key}"]`)
    const word = (key: string) => cell(key)?.querySelector('[data-verdict-word]')
    expect(word('a')?.textContent).toBe('Over')
    expect(word('b')?.textContent).toBe('OK')
    expect(word('c')).toBeNull()
    const dot = cell('a')?.querySelector('[data-basalt-status-dot]') as HTMLElement | null
    expect(dot?.style.getPropertyValue('--basalt-status-dot')).toContain('--vx-status-bad')
    expect(cell('c')?.querySelector('[data-basalt-status-dot]')).toBeNull()
    // The phrase is what assistive tech reads, in place of the bare word.
    expect(cell('a')?.textContent).toContain('Past the severe threshold')
    // The value keeps its ink: the dot and word add to it, never replace it.
    const value = cell('a')?.querySelector<HTMLElement>('[data-strip-value]')
    expect(value?.style.color).toContain('--vx-status-bad')
  })
})

describe('Meter past max', () => {
  test('the model flags a reading past max and words the overage', () => {
    const model = modelBar({ reading: 130, min: 0, max: 100, format: String })
    expect(model.over).toBe(true)
    expect(model.endText).toBe('30 over 100')
    expect(model.describedByText).toContain('30 over the limit of 100')
    expect(modelBar({ reading: 100, min: 0, max: 100, format: String }).over).toBe(false)
  })

  test('a target keeps its own overage wording', () => {
    const model = modelBar({ reading: 130, min: 0, max: 100, target: 90, format: String })
    expect(model.over).toBe(true)
    expect(model.endText).toBe('Target 90 · 40 over')
  })

  test('the track marks over-limit with a cap and the end caption states the overage', () => {
    const { container } = mount(<Meter label="Spend" value={130} max={100} />)
    expect(container.querySelector('[data-meter-track][data-meter-over]')).not.toBeNull()
    expect(container.querySelector('[data-meter-tick="over"]')).not.toBeNull()
    expect(container.textContent?.replaceAll(' ', ' ')).toContain('30 over 100')
    // The fill ends at the track end, not past it.
    const fill = container.querySelector<HTMLElement>('[data-meter-fill="committed"]')
    expect(fill?.style.width).toBe('100%')
  })

  test('a reading inside the track draws no cap', () => {
    const { container } = mount(<Meter label="Spend" value={60} max={100} />)
    expect(container.querySelector('[data-meter-over]')).toBeNull()
    expect(container.querySelector('[data-meter-tick="over"]')).toBeNull()
  })
})

describe('Meter size and part labels', () => {
  const segments = [
    { value: 60, label: 'Files', color: 'var(--vx-status-good)' },
    { value: 30, label: 'History', color: 'var(--vx-status-warn)' },
    { value: 5, label: 'Tools', tone: 'muted' as const },
  ]

  test('a track height step is written on the root; the default writes none', () => {
    const lg = mount(<Meter label="Context" segments={segments} size="lg" />)
    expect(lg.container.querySelector('[data-basalt-meter]')?.getAttribute('data-meter-size')).toBe(
      'lg',
    )
    lg.unmount()
    const none = mount(<Meter label="Context" segments={segments} />)
    expect(
      none.container.querySelector('[data-basalt-meter]')?.hasAttribute('data-meter-size'),
    ).toBe(false)
  })

  test('size="lg" names each part on its own fill', () => {
    const { container } = mount(<Meter label="Context" segments={segments} size="lg" />)
    const labels = [...container.querySelectorAll('[data-meter-fill-label]')].map(
      (l) => l.textContent,
    )
    expect(labels).toEqual(['Files', 'History', 'Tools'])
    // A muted (translucent) part takes ink, a series colour the inverse.
    const quiet = [...container.querySelectorAll('[data-meter-fill-label]')].map((l) =>
      l.hasAttribute('data-quiet'),
    )
    expect(quiet).toEqual([false, false, true])
  })

  test('only size="lg" labels a fill; a plain value bar never does', () => {
    const md = mount(<Meter label="Context" segments={segments} size="md" />)
    expect(md.container.querySelector('[data-meter-fill-label]')).toBeNull()
    md.unmount()
    const plain = mount(<Meter label="Spend" value={40} size="lg" />)
    expect(plain.container.querySelector('[data-meter-fill-label]')).toBeNull()
  })
})
