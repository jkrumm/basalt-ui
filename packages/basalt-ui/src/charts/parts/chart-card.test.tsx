/**
 * `ChartCard`: the phase matrix (the slot runs in ready and stale only), the Suspense arm, the
 * figure, footer, controls and menu anatomy, the height classes, a throwing slot, and the closure
 * that keeps Base UI out of `./charts`. Real geometry (equal heights, the 2x slot) is
 * `tests/layout/charts-card.layout.test.ts`.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import type { BoxSlot, ControlsSlot } from '../../core/ports'
import { useInChartCard } from '../card-context'
import type { ChartCardProps } from '../contract'
import { ChartCard } from './chart-card'

let root: ReturnType<typeof createRoot> | undefined
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
    root?.render(node)
  })
  return el
}

const html = (node: React.ReactNode): HTMLElement => {
  const el = document.createElement('div')
  el.innerHTML = renderToString(node)
  return el
}

const phases: readonly [string, Pick<ChartCardProps, 'phase' | 'empty'>][] = [
  ['ready', { phase: 'ready' }],
  ['loading', { phase: 'loading' }],
  ['stale', { phase: 'stale' }],
  ['error', { phase: { tag: 'error' } }],
  ['empty', { empty: { cause: 'No requests yet' } }],
]

function counted(): { slot: BoxSlot; calls: () => number; boxes: () => unknown[] } {
  const seen: unknown[] = []
  return {
    slot: (box) => {
      seen.push(box)
      return <svg data-testid="plot" />
    },
    calls: () => seen.length,
    boxes: () => seen,
  }
}

describe('phase matrix', () => {
  for (const [name, input] of phases) {
    test(`${name}: data-phase prints it, the slot runs only in ready and stale`, () => {
      const c = counted()
      const el = html(<ChartCard title="Requests" chart={c.slot} {...input} />)
      expect(el.querySelector('[data-slot="chart-box"]')?.getAttribute('data-phase')).toBe(name)
      expect(el.querySelector('[data-slot="card"]')?.getAttribute('data-phase')).toBe(name)
      expect(c.calls()).toBe(name === 'ready' || name === 'stale' ? 1 : 0)
    })
  }

  test('the box carries the same height class in every phase', () => {
    const classes = phases.map(([, input]) => {
      const el = html(<ChartCard title="R" chart={() => null} {...input} />)
      return el
        .querySelector('[data-slot="chart-box"]')
        ?.className.split(' ')
        .filter((c) => c.startsWith('h-') || c.startsWith('min-h-') || c === 'flex-1')
    })
    expect(new Set(classes.map((c) => c?.join(' '))).size).toBe(1)
  })

  test('the slot is handed a fill box and its phase', () => {
    const ready = counted()
    html(<ChartCard title="R" chart={ready.slot} />)
    expect(ready.boxes()).toEqual([{ height: 'fill', phase: 'ready' }])
    const stale = counted()
    html(<ChartCard title="R" chart={stale.slot} phase="stale" />)
    expect(stale.boxes()).toEqual([{ height: 'fill', phase: 'stale' }])
  })

  test('empty wins over ready, and loading over empty', () => {
    const c = counted()
    const empty = { cause: 'Nothing' }
    expect(html(<ChartCard title="R" chart={c.slot} empty={empty} />).textContent).toContain(
      'Nothing',
    )
    const el = html(<ChartCard title="R" chart={c.slot} empty={empty} phase="loading" />)
    expect(el.querySelector('[data-slot="chart-box"]')?.getAttribute('data-phase')).toBe('loading')
    expect(c.calls()).toBe(0)
  })

  test('a refetch error keeps the chart and says it is old', () => {
    const query = { isPending: false, isError: true, isRefetchError: true, error: new Error('x') }
    const c = counted()
    const el = html(<ChartCard title="R" chart={c.slot} phase={query} />)
    expect(c.calls()).toBe(1)
    expect(el.querySelector('output')?.textContent).toBe('Could not refresh. Showing earlier data.')
  })

  test('the error arm offers Retry and a 403 offers none', () => {
    const retry = (): void => {}
    const withRetry = html(
      <ChartCard title="R" chart={() => null} phase={{ tag: 'error', retry }} />,
    )
    expect(withRetry.querySelector('[role="alert"] button')?.textContent).toBe('Retry')
    const forbidden = html(
      <ChartCard title="R" chart={() => null} phase={{ tag: 'error', kind: 'forbidden', retry }} />,
    )
    expect(forbidden.querySelector('[role="alert"] button')).toBeNull()
    expect(forbidden.textContent).toContain('You do not have access to this.')
  })

  test('the filtered empty state offers Clear filters', () => {
    const el = html(
      <ChartCard
        title="R"
        chart={() => null}
        empty={{ cause: 'No results', filtered: { reset: () => {} } }}
      />,
    )
    expect(el.querySelector('button')?.textContent).toBe('Clear filters')
  })
})

describe('Suspense arm', () => {
  test('loading with no chart and no title draws the frame, a title bar and the skeleton', () => {
    const el = html(
      <ChartCard phase="loading" figure={{ value: null }} footer={[{ label: 'a', value: 1 }]} />,
    )
    expect(el.querySelector('[data-slot="chart-box"]')?.getAttribute('data-phase')).toBe('loading')
    expect(el.querySelector('[data-slot="chart-skeleton"]')).not.toBeNull()
    expect(el.querySelector('[data-slot="chart-figure"] [aria-hidden]')).not.toBeNull()
    expect(el.querySelector('[data-slot="chart-footer"]')).not.toBeNull()
  })

  test('it is the same box as the ready card', () => {
    const boxClass = (node: React.ReactNode): string | undefined =>
      html(node).querySelector('[data-slot="chart-box"]')?.className
    expect(boxClass(<ChartCard phase="loading" />)).toBe(
      boxClass(<ChartCard title="R" chart={() => null} />),
    )
  })
})

describe('anatomy', () => {
  const controls: ControlsSlot = {
    kind: 'controls-slot',
    count: 1,
    render: () => <button>Range</button>,
  }

  test('figure: value, unit, delta, period and status on one row', () => {
    const el = html(
      <ChartCard
        title="Requests"
        chart={() => null}
        figure={{
          value: 12840,
          unit: 'req',
          delta: { value: '+8%', polarity: 'up-good' },
          period: 'vs prior',
          status: { tone: 'good', label: 'On target' },
        }}
      />,
    )
    const row = el.querySelector('[data-slot="chart-figure"]')
    expect(row?.textContent).toContain('12,840req')
    expect(row?.querySelector('[data-slot="delta-badge"]')?.getAttribute('data-tone')).toBe('good')
    expect(row?.textContent).toContain('vs prior')
    expect(row?.querySelector('[data-slot="chart-status"]')?.textContent).toBe('On target')
  })

  test('a null or non-finite figure is a dash, never NaN or zero', () => {
    for (const value of [null, Number.NaN, Number.POSITIVE_INFINITY]) {
      const el = html(<ChartCard title="R" chart={() => null} figure={{ value }} />)
      expect(el.querySelector('[data-slot="chart-figure"]')?.textContent).toBe('–')
    }
  })

  test('no figure, no figure row', () => {
    expect(
      html(<ChartCard title="R" chart={() => null} />).querySelector('[data-slot="chart-figure"]'),
    ).toBeNull()
  })

  test('footer caps at two facts and drops null', () => {
    const el = html(
      <ChartCard title="R" chart={() => null} footer={[null, { label: 'Peak', value: 1200 }]} />,
    )
    const dt = [...el.querySelectorAll('[data-slot="chart-footer"] dt')].map((d) => d.textContent)
    expect(dt).toEqual(['Peak'])
    expect(el.querySelector('[data-slot="chart-footer"] dd')?.textContent).toBe('1,200')
    expect(
      html(<ChartCard title="R" chart={() => null} footer={[null]} />).querySelector(
        '[data-slot="chart-footer"]',
      ),
    ).toBeNull()
  })

  test('header: title, subtitle, info glyph, controls once, menu slot', () => {
    const el = html(
      <ChartCard
        title="Requests"
        subtitle="last 30 days"
        info="Requests served."
        controls={controls}
        menu={() => <button>More</button>}
        chart={() => null}
      />,
    )
    expect(el.querySelector('[data-slot="card-band"] p')?.textContent).toBe('Requests')
    expect(el.textContent).toContain('last 30 days')
    expect(el.querySelector('[data-slot="card-info"]')?.getAttribute('aria-label')).toBe(
      'About Requests',
    )
    expect(el.querySelectorAll('[data-slot="chart-controls"] button')).toHaveLength(1)
    expect(el.querySelector('[data-slot="chart-menu"]')?.textContent).toBe('More')
  })

  test('the card has no Base UI polymorphism: a plain div with the card surface', () => {
    const card = html(<ChartCard title="R" chart={() => null} />).querySelector(
      '[data-slot="card"]',
    )
    expect(card?.tagName).toBe('DIV')
    expect(card?.getAttribute('data-surface')).toBe('card')
  })
})

describe('height', () => {
  const boxOf = (height: 'auto' | 'short' | 'fill' | undefined): string | undefined =>
    html(
      <ChartCard title="R" chart={() => null} {...(height !== undefined && { height })} />,
    ).querySelector('[data-slot="chart-box"]')?.className

  test('auto and short state a height in CSS, fill takes the remainder', () => {
    expect(boxOf(undefined)).toContain('h-[clamp(10rem,50cqw,26.25rem)]')
    expect(boxOf('auto')).toBe(boxOf(undefined))
    expect(boxOf('short')).toContain('h-40')
    expect(boxOf('fill')).toContain('flex-1')
    expect(boxOf('fill')?.split(' ')).not.toContain('h-40')
  })

  test('the card is a container, and fill also fills its parent', () => {
    const root = (h: 'auto' | 'fill'): string =>
      html(<ChartCard title="R" chart={() => null} height={h} />).querySelector(
        '[data-slot="chart-card"]',
      )?.className ?? ''
    expect(root('auto')).toContain('@container')
    expect(root('auto')).not.toContain('h-full')
    expect(root('fill')).toContain('h-full')
  })
})

describe('a throwing slot', () => {
  test('lands in the error arm, the card stays, Retry runs the slot again', async () => {
    let fail = true
    const original = console.error
    console.error = () => {}
    try {
      const el = await mount(
        <ChartCard
          title="Requests"
          chart={() => {
            if (fail) throw new Error('boom')
            return <svg data-testid="plot" />
          }}
        />,
      )
      expect(el.querySelector('[role="alert"]')).not.toBeNull()
      expect(el.querySelector('[data-slot="card-band"]')?.textContent).toContain('Requests')
      fail = false
      await act(async () => {
        el.querySelector<HTMLButtonElement>('[role="alert"] button')?.click()
      })
      expect(el.querySelector('[data-testid="plot"]')).not.toBeNull()
    } finally {
      console.error = original
    }
  })
})

describe('chart context', () => {
  test('a chart inside the card knows it', () => {
    function Probe(): React.ReactNode {
      return <i data-in-card={String(useInChartCard())} />
    }
    const inside = html(<ChartCard title="R" chart={() => <Probe />} />)
    expect(inside.querySelector('i')?.getAttribute('data-in-card')).toBe('true')
    expect(
      html(<Probe />)
        .querySelector('i')
        ?.getAttribute('data-in-card'),
    ).toBe('false')
  })
})

describe('closure', () => {
  /** Every package a module reaches through its relative imports (a source walk, like `check-dist-layering`). */
  function bareImports(entry: string): Set<string> {
    const bare = new Set<string>()
    const seen = new Set<string>()
    const walk = (file: string): void => {
      if (seen.has(file)) return
      seen.add(file)
      const src = readFileSync(file, 'utf8')
      for (const [, spec] of src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
        if (spec === undefined) continue
        if (!spec.startsWith('.')) {
          bare.add(spec)
          continue
        }
        const target = resolve(dirname(file), spec)
        for (const candidate of [`${target}.tsx`, `${target}.ts`, join(target, 'index.ts')]) {
          try {
            readFileSync(candidate)
            walk(candidate)
            break
          } catch {}
        }
      }
    }
    walk(entry)
    return bare
  }

  test('ChartCard reaches no @base-ui/react and no @mantine', () => {
    const bare = [...bareImports(join(import.meta.dirname, 'chart-card.tsx'))]
    expect(
      bare.filter(
        (s) => s.startsWith('@base-ui/') || s.startsWith('@mantine/') || s.startsWith('@visx/'),
      ),
    ).toEqual([])
  })
})
