/**
 * `catalog.Block`: the per-block boundary keeps siblings mounted, a refused spec never reaches
 * `render`, and the phase reaches the composite at the root of a render.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import type { ReactElement } from 'react'
import { z } from 'zod'
import { StatCard } from '../../cards/stat-card'
import type { Phase } from '../../core/ports'
import type { BlockEvent } from '../contract'
import { defineBlock, defineCatalog } from './define'

afterEach(cleanup)

const UNAVAILABLE = 'This could not be displayed.'

const stat = defineBlock({
  name: 'stat',
  description: 'One headline number with a delta. Never for lists.',
  props: z.object({ label: z.string().max(40), value: z.number(), delta: z.number().optional() }),
  sample: [{ label: 'Shipped', value: 388, delta: 12 }],
  render: (p) => (
    <StatCard
      title={p.label}
      value={p.value}
      {...(p.delta !== undefined && { delta: { value: p.delta, polarity: 'up-good' } })}
    />
  ),
})

const boom = defineBlock({
  name: 'boom',
  description: 'Throws while rendering.',
  props: z.object({ label: z.string() }),
  sample: [{ label: 'x' }],
  render: (): ReactElement => {
    throw new Error('render failed')
  },
})

let rendered: unknown[] = []
const link = defineBlock({
  name: 'link',
  description: 'A link.',
  props: z.object({ href: z.string() }),
  sample: [{ href: '/a' }],
  render: (p) => {
    rendered.push(p.href)
    return null
  },
})

const catalog = defineCatalog([stat, boom, link])
const { Block } = catalog

/** React logs the caught render error; the boundary's behaviour is what the test reads. */
function quiet<T>(fn: () => T): T {
  const spy = spyOn(globalThis.console, 'error').mockImplementation(() => undefined)
  try {
    return fn()
  } finally {
    spy.mockRestore()
  }
}

describe('Block', () => {
  test('a throwing render shows the unavailable text and siblings stay mounted', () => {
    const events: BlockEvent[] = []
    const { container, getByText } = quiet(() =>
      render(
        <>
          <Block spec={{ block: 'stat', label: 'Before', value: 1 }} phase="ready" />
          <Block
            spec={{ block: 'boom', label: 'x' }}
            phase="ready"
            onEvent={(e) => events.push(e)}
          />
          <Block spec={{ block: 'stat', label: 'After', value: 2 }} phase="ready" />
        </>,
      ),
    )
    expect(getByText(UNAVAILABLE)).toBeTruthy()
    expect(getByText('Before')).toBeTruthy()
    expect(getByText('After')).toBeTruthy()
    expect(container.querySelectorAll('[data-slot="stat-card"]')).toHaveLength(2)
    expect(events).toEqual([{ block: 'boom', type: 'error', payload: 'render failed' }])
  })

  test('a refused spec never reaches render and reports why', () => {
    rendered = []
    const events: BlockEvent[] = []
    const { getByText } = render(
      <Block
        spec={{ block: 'link', href: 'javascript:alert(1)' }}
        phase="ready"
        onEvent={(e) => events.push(e)}
      />,
    )
    expect(getByText(UNAVAILABLE)).toBeTruthy()
    expect(rendered).toEqual([])
    expect(events[0]?.type).toBe('invalid')
    expect(String(events[0]?.payload)).toContain('href')
  })

  test('a hostile spec still streaming in renders the sample skeleton, never the hostile value', () => {
    rendered = []
    render(<Block spec={{ block: 'link', href: '//h' }} phase="loading" />)
    expect(rendered).toEqual(['/a'])
  })

  test('the phase reaches the composite: loading draws its skeleton, error its error arm', () => {
    const spec = { block: 'stat', label: 'Shipped', value: 388 }
    const phases: Phase[] = ['ready', 'stale', 'loading', { tag: 'error', message: 'down' }]
    for (const phase of phases) {
      const { container } = render(<Block spec={spec} phase={phase} />)
      const tag = typeof phase === 'string' ? phase : phase.tag
      expect(container.querySelector('[data-slot="ai-block"]')?.getAttribute('data-phase')).toBe(
        tag,
      )
      expect(container.querySelector('[data-slot="stat-card"]')).not.toBeNull()
      expect(container.textContent?.includes('388')).toBe(phase === 'ready' || phase === 'stale')
      cleanup()
    }
  })

  test('an unknown or half-streamed block is a placeholder while loading, unavailable once ready', () => {
    const loading = render(<Block spec={{ blo: 1 }} phase="loading" />)
    expect(loading.queryByText(UNAVAILABLE)).toBeNull()
    cleanup()
    const ready = render(<Block spec={{ block: 'chart' }} phase="ready" />)
    expect(ready.getByText(UNAVAILABLE)).toBeTruthy()
  })
})
