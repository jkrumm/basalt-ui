import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { IntlScope } from '../core/provider-props'
import { Slider, sliderParts } from './slider'

afterEach(cleanup)

const slots = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot') ?? '')

const inputs = (root: ParentNode): HTMLInputElement[] => [
  ...root.querySelectorAll<HTMLInputElement>('input[type="range"]'),
]

describe('slider module', () => {
  test('renders with no provider; every part carries data-slot and sliderParts lists them', () => {
    const { container } = render(<Slider aria-label="Volume" defaultValue={30} />)
    expect([...new Set(slots(container))].toSorted()).toEqual([...sliderParts].toSorted())
  })

  test('server render keeps the slots', () => {
    const html = renderToString(<Slider aria-label="Volume" defaultValue={30} />)
    for (const part of sliderParts) expect(html).toContain(`data-slot="${part}"`)
  })

  test('a number is one thumb, an array is two', () => {
    expect(inputs(render(<Slider aria-label="V" defaultValue={30} />).container)).toHaveLength(1)
    cleanup()
    expect(
      inputs(render(<Slider aria-label="V" defaultValue={[20, 80]} />).container),
    ).toHaveLength(2)
  })

  test('the name and the thumb labels reach the range inputs', () => {
    const { container } = render(
      <Slider defaultValue={[20, 80]} thumbLabels={['Minimum', 'Maximum']} />,
    )
    expect(inputs(container).map((i) => i.getAttribute('aria-label'))).toEqual([
      'Minimum',
      'Maximum',
    ])
    cleanup()
    const single = render(<Slider aria-label="Volume" defaultValue={30} />)
    expect(inputs(single.container)[0]?.getAttribute('aria-label')).toBe('Volume')
  })

  test('with no provider the value text is English; de-DE renders a comma', () => {
    const en = render(<Slider aria-label="V" defaultValue={1.5} step={0.5} max={5} />)
    expect(inputs(en.container)[0]?.getAttribute('aria-valuetext')).toBe('1.5')
    cleanup()
    const de = render(
      <IntlScope locale="de-DE">
        <Slider aria-label="V" defaultValue={1.5} step={0.5} max={5} />
      </IntlScope>,
    )
    expect(inputs(de.container)[0]?.getAttribute('aria-valuetext')).toBe('1,5')
    expect(
      renderToString(
        <IntlScope locale="de-DE">
          <Slider aria-label="V" defaultValue={1.5} step={0.5} max={5} />
        </IntlScope>,
      ),
    ).toContain('aria-valuetext="1,5"')
  })

  test('format takes Intl options', () => {
    const { container } = render(
      <IntlScope locale="de-DE">
        <Slider
          aria-label="V"
          defaultValue={0.25}
          max={1}
          step={0.05}
          format={{ style: 'percent' }}
        />
      </IntlScope>,
    )
    expect(inputs(container)[0]?.getAttribute('aria-valuetext')).toBe('25\u00a0%')
  })

  test('the keyboard steps the value and reports it as a commit', () => {
    const changed: number[] = []
    const committed: number[] = []
    const { container } = render(
      <Slider
        aria-label="V"
        defaultValue={5}
        onValueChange={(v) => changed.push(v)}
        onValueCommitted={(v) => committed.push(v)}
      />,
    )
    const input = inputs(container)[0]!
    input.focus()
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    expect(changed.at(-1)).toBe(6)
    expect(committed.at(-1)).toBe(6)
  })
})
