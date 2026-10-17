/**
 * A `Sparkline` in a `StatCard` `sparkline` slot or a strip cell `visual` answers focus with its
 * readout. Round 1's board showed none there; real Chrome reads one in both slots (the board's hover
 * step had no target in them), so these pin that no slot wrapper ever takes the readout away.
 */
import { MantineProvider } from '@mantine/core'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, describe, expect, test } from 'bun:test'
import { Sparkline } from '../charts/Sparkline'
import { StatCard } from './stat-card'
import { StatGroup } from './stat-group'

const data = [10, 20, 30, 40, 50]
let root: Root | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

async function mount(node: React.ReactNode): Promise<HTMLElement> {
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () => {
    root?.render(<MantineProvider>{node}</MantineProvider>)
  })
  return el
}

async function focusReadout(el: HTMLElement): Promise<string | undefined> {
  await act(async () => {
    el.querySelector('svg')?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  })
  return el.querySelector('[data-basalt-sparkline-readout]')?.textContent ?? undefined
}

describe('Sparkline readout in a slot', () => {
  test('a StatCard sparkline slot', async () => {
    const el = await mount(
      <StatCard
        title="T"
        value="1"
        sparkline={<Sparkline ariaLabel="S" data={data} height={22} />}
      />,
    )
    expect(await focusReadout(el)).toContain('50')
  })
  test('a strip cell visual', async () => {
    const el = await mount(
      <StatGroup
        variant="strip"
        label="L"
        cells={[
          {
            key: 'a',
            caption: 'A',
            value: '1',
            visual: <Sparkline ariaLabel="S" data={data} height={28} reference="mean" />,
          },
        ]}
      />,
    )
    expect(await focusReadout(el)).toContain('50')
  })
})
