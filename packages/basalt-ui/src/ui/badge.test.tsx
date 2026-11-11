import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { CountBadge, DeltaBadge, Lozenge, badgeParts } from './badge'

afterEach(cleanup)

describe('badge module', () => {
  test('every part carries data-slot and badgeParts lists them', () => {
    const { container } = render(
      <>
        <Lozenge>Draft</Lozenge>
        <CountBadge count={2} />
        <DeltaBadge value={1} polarity="neutral" />
      </>,
    )
    const slots = [...container.querySelectorAll('[data-slot]')].map((el) =>
      el.getAttribute('data-slot'),
    )
    expect(slots).toEqual([...badgeParts])
  })

  test('server render keeps the slots', () => {
    const html = renderToString(<DeltaBadge value="+4%" polarity="up-good" />)
    expect(html).toContain('data-slot="delta-badge"')
  })

  test('Lozenge tints by tone and defaults to neutral', () => {
    const { getByText } = render(
      <>
        <Lozenge tone="bad">Overdue</Lozenge>
        <Lozenge>Draft</Lozenge>
      </>,
    )
    expect(getByText('Overdue').className).toContain('bg-bad-tint')
    expect(getByText('Draft').className).toContain('bg-selected')
  })

  test('CountBadge caps at max and is neutral until attention', () => {
    const { getByText } = render(
      <>
        <CountBadge count={120} />
        <CountBadge count={5} attention />
        <CountBadge count={7} max={9} />
      </>,
    )
    expect(getByText('99+').className).toContain('bg-selected')
    expect(getByText('5').className).toContain('bg-brand-fill')
    expect(getByText('7')).toBeTruthy()
  })
})

describe('DeltaBadge', () => {
  const read = (props: Parameters<typeof DeltaBadge>[0]): HTMLElement => {
    const { container } = render(<DeltaBadge {...props} />)
    return container.firstElementChild as HTMLElement
  }

  const matrix: Array<[Parameters<typeof DeltaBadge>[0], string, string]> = [
    [{ value: 12, polarity: 'up-good' }, 'up', 'good'],
    [{ value: -12, polarity: 'up-good' }, 'down', 'bad'],
    [{ value: 12, polarity: 'up-bad' }, 'up', 'bad'],
    [{ value: -12, polarity: 'up-bad' }, 'down', 'good'],
    [{ value: 12, polarity: 'neutral' }, 'up', 'neutral'],
    [{ value: -12, polarity: 'neutral' }, 'down', 'neutral'],
    [{ value: 0, polarity: 'up-good' }, 'zero', 'neutral'],
    [{ value: '+4.2%', polarity: 'up-good' }, 'up', 'good'],
    [{ value: '−3%', polarity: 'up-good' }, 'down', 'bad'],
    [{ value: '-3%', polarity: 'up-bad' }, 'down', 'good'],
    [{ value: '0%', polarity: 'up-bad' }, 'zero', 'neutral'],
  ]
  for (const [props, direction, tone] of matrix) {
    test(`${String(props.value)} ${props.polarity}: arrow ${direction}, verdict ${tone}`, () => {
      const el = read(props)
      cleanup()
      expect(el.getAttribute('data-direction')).toBe(direction)
      expect(el.getAttribute('data-tone')).toBe(tone)
    })
  }

  test('the verdict is in the words, not only the tint', () => {
    const el = read({ value: -3, polarity: 'up-good' })
    expect(el.textContent).toContain('Down, unfavourable')
  })

  test('the label rides along', () => {
    const el = read({ value: '+1', polarity: 'up-good', label: 'vs last week' })
    expect(el.textContent).toContain('vs last week')
  })
})
