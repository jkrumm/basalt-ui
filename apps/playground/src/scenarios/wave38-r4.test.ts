/**
 * Wave 38 round 4: bodies that draw their own loading keep the card out of its bar-chart ghost.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'bun:test'
import { AgentsScenario } from './S3Agents'
import { TrainingScenario } from './S2Training'

afterEach(cleanup)

const mount = (Scenario: typeof TrainingScenario) =>
  render(createElement(MantineProvider, null, createElement(Scenario, { shotState: 'loading' })))
    .container
const anchor = (c: HTMLElement, name: string) =>
  c.querySelector<HTMLElement>(`[data-shot="${name}"]`)

describe('W38 r4 loading shapes', () => {
  it.each(['goal', 'session-mix'])('%s: loading draws the body, not the plot ghost', (name) => {
    const card = anchor(mount(TrainingScenario), name)
    expect(card).not.toBeNull()
    expect(card?.querySelector('[data-basalt-plot-ghost]')).toBeNull()
    expect(card?.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('item-flow: a line chart loads as a line ghost', () => {
    const card = anchor(mount(AgentsScenario), 'item-flow')
    expect(card?.querySelector('[data-basalt-plot-ghost]')).not.toBeNull()
  })
})
