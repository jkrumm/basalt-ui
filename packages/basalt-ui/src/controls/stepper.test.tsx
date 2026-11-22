/** `Stepper`: every step named, the current marked, done steps reachable, upcoming never. */
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Stepper, stepperParts } from './stepper'

afterEach(cleanup)

const STEPS = [
  { label: 'Basics', description: 'Name and owner' },
  { label: 'Schedule' },
  { label: 'Review' },
] as const

describe('Stepper', () => {
  test('a named list; the current step is aria-current="step" in both forms', () => {
    const { getByRole, container } = render(<Stepper steps={STEPS} current={1} />)
    expect(getByRole('navigation', { name: 'Progress' })).toBeTruthy()
    const current = container.querySelectorAll('[aria-current="step"]')
    expect(current.length).toBe(2)
    for (const node of current) expect(node.textContent).toContain('Schedule')
  })

  test('each step says its state to assistive technology', () => {
    const { container } = render(<Stepper steps={STEPS} current={1} />)
    const steps = [...container.querySelectorAll('[data-slot="stepper-step"]')]
    expect(steps.map((s) => s.getAttribute('data-status'))).toEqual(['done', 'current', 'upcoming'])
    expect(steps[0]!.textContent).toContain('done')
    expect(steps[2]!.textContent).toContain('not started')
  })

  test('with onStepChange a done step is a button back to it; current and upcoming are not', () => {
    const seen: number[] = []
    const { getAllByRole } = render(
      <Stepper steps={STEPS} current={2} onStepChange={(i) => void seen.push(i)} />,
    )
    const buttons = getAllByRole('button')
    expect(buttons.length).toBe(2)
    fireEvent.click(buttons[1]!)
    expect(seen).toEqual([1])
  })

  test('without onStepChange no step is a button', () => {
    const { queryAllByRole } = render(<Stepper steps={STEPS} current={2} />)
    expect(queryAllByRole('button').length).toBe(0)
  })

  test('the compact form counts the steps; the forms switch on the container, never the viewport', () => {
    const { container } = render(<Stepper steps={STEPS} current={0} />)
    const compact = container.querySelector('[data-slot="stepper-compact"]')!
    expect(compact.textContent).toContain('Step 1 of 3')
    expect(compact.className).toContain('@regular:hidden')
    expect(container.querySelector('[data-slot="stepper-list"]')!.className).toContain(
      '@regular:flex',
    )
    expect(container.querySelector('[data-slot="stepper"]')!.className).toContain('@container')
  })

  test('an out-of-range current is clamped', () => {
    const { container } = render(<Stepper steps={STEPS} current={9} />)
    expect(container.querySelector('[data-slot="stepper-compact"]')!.textContent).toContain(
      'Step 3 of 3',
    )
  })

  test('server render holds every slot', () => {
    const html = renderToString(<Stepper steps={STEPS} current={1} />)
    for (const slot of stepperParts.filter(
      (s) => !s.startsWith('stepper-bar') && s !== 'stepper-segment',
    ))
      expect(html).toContain(`data-slot="${slot}"`)
  })

  test('the bar variant is one named segment per step with the current one marked', () => {
    const { container, getByRole } = render(<Stepper steps={STEPS} current={1} variant="bar" />)
    expect(getByRole('navigation', { name: 'Progress' })).toBeTruthy()
    const segments = [...container.querySelectorAll('[data-slot="stepper-segment"]')]
    expect(segments.map((s) => s.getAttribute('data-status'))).toEqual([
      'done',
      'current',
      'upcoming',
    ])
    expect(segments[1]!.getAttribute('aria-current')).toBe('step')
    expect(segments[2]!.textContent).toBe('Review, not started')
    expect(container.querySelector('[data-slot="stepper-list"]')).toBeNull()
  })
})
