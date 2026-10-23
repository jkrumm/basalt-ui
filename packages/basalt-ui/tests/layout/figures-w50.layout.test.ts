/**
 * Wave 50 figures: the S7 one-cell strip gives its Meter the card's width, and the Meter reading tick
 * contrasts with the fill beneath it in both schemes.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const spec: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  w50Figures: true,
}

layout('Wave 50 figures', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test.each([
    ['1440', DESKTOP_1440],
    ['390', PHONE],
  ] as const)('%s: a one-cell strip Meter track fills the card', async (_, viewport) => {
    const p = await openFixture(spec, viewport)
    await p.settle()
    const m = await p.raw.evaluate(() => {
      const host = document.querySelector('[data-testid="w50-one-cell"]') as HTMLElement
      const section = host.querySelector('section') as HTMLElement
      const track = host.querySelector('[data-meter-track]') as HTMLElement
      const content = section.querySelector('[data-strip-head]')?.parentElement as HTMLElement
      const cs = getComputedStyle(content)
      const inner =
        content.getBoundingClientRect().width -
        parseFloat(cs.paddingLeft) -
        parseFloat(cs.paddingRight)
      const chain: string[] = []
      for (let el: HTMLElement | null = track; el && el !== section; el = el.parentElement)
        chain.push(`${el.className.split(' ')[0]}:${el.getBoundingClientRect().width}`)
      return {
        track: track.getBoundingClientRect().width,
        inner,
        section: section.getBoundingClientRect().width,
        cell: (content.parentElement as HTMLElement).getBoundingClientRect().width,
        chain,
      }
    })
    expect(m.cell, m.chain.join(' > ')).toBeGreaterThanOrEqual(m.section - 1)
    expect(m.track, m.chain.join(' > ')).toBeGreaterThanOrEqual(m.inner * 0.95)
  })

  const dark = { ...spec, colorScheme: 'dark' } satisfies FixtureSpec
  // The marker is a panel core in an ink ring: the core must meet an ink fill, the ring a light one.
  test.each([
    ['light', spec, 'w50-ink', 'core'],
    ['dark', dark, 'w50-ink', 'core'],
    ['light', spec, 'w50-light', 'ring'],
    ['dark', dark, 'w50-light', 'ring'],
  ] as const)(
    '%s: the reading tick contrasts 3:1 with the fill (%s, %s)',
    async (_, fixture, host, part) => {
      const p = await openFixture(fixture, DESKTOP_1440)
      await p.settle()
      const ratio = await p.raw.evaluate(
        ([id, which]) => {
          const rgb = (css: string): [number, number, number] => {
            const ctx = document.createElement('canvas').getContext('2d', {
              willReadFrequently: true,
            }) as CanvasRenderingContext2D
            ctx.fillStyle = css
            ctx.fillRect(0, 0, 1, 1)
            const d = ctx.getImageData(0, 0, 1, 1).data
            return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0]
          }
          const lum = ([r, g, b]: [number, number, number]) => {
            const f = (v: number) => {
              const c = v / 255
              return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
            }
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
          }
          const contrast = (a: string, b: string) => {
            const [hi, lo] = [lum(rgb(a)), lum(rgb(b))].sort((x, y) => y - x) as [number, number]
            return (hi + 0.05) / (lo + 0.05)
          }
          const host = document.querySelector(`[data-testid="${id}"]`) as HTMLElement
          const tick = host.querySelector('[data-meter-tick="marker"]') as HTMLElement
          const probe = document.createElement('span')
          probe.style.color = id === 'w50-ink' ? 'var(--vx-ink)' : 'var(--vx-surface-subtle)'
          host.append(probe)
          const fill = getComputedStyle(probe).color
          probe.remove()
          const cs = getComputedStyle(tick)
          const ring = cs.boxShadow.split(/\s+0px 0px 0px/)[0] ?? ''
          return contrast(which === 'core' ? cs.backgroundColor : ring, fill)
        },
        [host, part] as const,
      )
      expect(ratio).toBeGreaterThanOrEqual(3)
    },
  )

  test.each([
    ['1440', DESKTOP_1440],
    ['390', PHONE],
  ] as const)('%s: strip reference labels clear the line', async (_, viewport) => {
    const p = await openFixture(spec, viewport)
    await p.settle()
    const rows = await p.raw.evaluate(
      ({ step, ink, inkH }) =>
        [
          ...document.querySelectorAll(
            '[data-testid="w50-mean"] [data-basalt-sparkline], [data-testid="w50-pr"] [data-basalt-sparkline]',
          ),
        ].map((root) => {
          const svg = root.querySelector('svg')
          const label = [...root.querySelectorAll('text')].find((t) =>
            /^(PR|12 wk mean)$/.test(t.textContent ?? ''),
          )
          const path = root.querySelector<SVGPathElement>('[data-ts-key^="line"] path')
          if (!svg || !path) throw new Error('LAYOUT: missing svg or line path')
          // Out of the plot, in the caption row, no line can reach it.
          if (!label) {
            const key = root.parentElement?.querySelector('[data-basalt-sparkline-key]')
            if (!key) throw new Error('LAYOUT: reference label neither in the plot nor the row')
            return { text: key.textContent, hits: 0 }
          }
          const r = label.getBoundingClientRect()
          const fs = parseFloat(getComputedStyle(label).fontSize)
          const mid = (r.top + r.bottom) / 2
          const box = {
            left: r.left,
            right: r.right,
            top: mid - (fs * inkH) / 2,
            bottom: mid + (fs * inkH) / 2,
          }
          const m = path.getScreenCTM()
          if (!m) throw new Error('LAYOUT: no CTM')
          let hits = 0
          const len = path.getTotalLength()
          for (let at = 0; at <= len; at += step) {
            const pt = path.getPointAtLength(at).matrixTransform(m)
            if (
              pt.x + ink >= box.left &&
              pt.x - ink <= box.right &&
              pt.y + ink >= box.top &&
              pt.y - ink <= box.bottom
            )
              hits += 1
          }
          return { text: label.textContent, hits }
        }),
      { step: 0.5, ink: 4.75, inkH: 0.75 },
    )
    expect(rows.length).toBe(6)
    for (const r of rows) expect(r.hits, r.text ?? '').toBe(0)
  })

  test.each([
    ['1440', DESKTOP_1440],
    ['390', PHONE],
  ] as const)('%s: a dated strip sparkline states its window at rest', async (_, viewport) => {
    const p = await openFixture(spec, viewport)
    await p.settle()
    const rows = await p.raw.evaluate(() =>
      [...document.querySelectorAll('[data-testid="w50-mean"] [data-basalt-sparkline]')].map(
        (root) => {
          const svg = (root.querySelector('svg') as SVGElement).getBoundingClientRect()
          const cap = root.parentElement?.querySelector(
            '[data-basalt-sparkline-window]',
          ) as HTMLElement | null
          if (!cap) return { text: '', gap: -99, visible: false }
          const c = cap.getBoundingClientRect()
          return {
            text: cap.textContent ?? '',
            gap: c.top - svg.bottom,
            visible: c.width > 0 && getComputedStyle(cap).visibility !== 'hidden',
          }
        },
      ),
    )
    expect(rows.length).toBe(4)
    for (const r of rows) {
      expect(r.text).toMatch(/\d.*–.*\d/)
      expect(r.visible).toBe(true)
      expect(r.gap).toBeGreaterThanOrEqual(0)
    }
  })

  test('390: every kicker qualifier sits under its caption', async () => {
    const p = await openFixture(spec, PHONE)
    await p.settle()
    const rows = await p.raw.evaluate(() =>
      [...document.querySelectorAll('[data-testid="w50-kickers"] [data-strip-head]')].map(
        (head) => {
          const q = head.querySelector('[class*="qualifier"]') as HTMLElement
          const c = head.querySelector('[class*="caption_"]') as HTMLElement
          return { under: q.getBoundingClientRect().top >= c.getBoundingClientRect().bottom - 0.5 }
        },
      ),
    )
    expect(rows.length).toBe(4)
    for (const r of rows) expect(r.under).toBe(true)
  })

  test.each([
    ['1440', DESKTOP_1440],
    ['390', PHONE],
  ] as const)('%s: a footer under a cell keeps the cell inset below it', async (_, viewport) => {
    const p = await openFixture(spec, viewport)
    await p.settle()
    const m = await p.raw.evaluate(() => {
      const host = document.querySelector('[data-testid="w50-under"]') as HTMLElement
      const foot = [...host.querySelectorAll('div')].find(
        (d) => d.textContent === 'Set a goal weight' && d.children.length <= 1,
      ) as HTMLElement
      const section = host.querySelector('section') as HTMLElement
      const cell = foot.closest('[class*="cell_"]') as HTMLElement
      return {
        below: cell.getBoundingClientRect().bottom - foot.getBoundingClientRect().bottom,
        sectionBelow: section.getBoundingClientRect().bottom - foot.getBoundingClientRect().bottom,
      }
    })
    // The strip cell's own inset is `stack-md`: 12px at the default density.
    expect(m.below).toBeGreaterThanOrEqual(8)
    expect(m.sectionBelow).toBeGreaterThanOrEqual(8)
  })

  test.each([
    ['1440', DESKTOP_1440],
    ['390', PHONE],
  ] as const)(
    '%s: a bleed StatCard sparkline caption clears the footer and the card edge',
    async (_, viewport) => {
      const p = await openFixture(spec, viewport)
      await p.settle()
      const m = await p.raw.evaluate(() => {
        const card = document.querySelector(
          '[data-testid="w50-bleed"] .mantine-Card-root',
        ) as HTMLElement
        const cap = card.querySelector('[data-basalt-sparkline-window]') as HTMLElement | null
        const foot = card.querySelector('p[title]') as HTMLElement
        if (!cap) return null
        const c = cap.getBoundingClientRect()
        const f = foot.getBoundingClientRect()
        const k = card.getBoundingClientRect()
        return {
          text: cap.textContent,
          capBottom: c.bottom,
          footTop: f.top,
          cardBottom: k.bottom,
          capRight: c.right,
          cardRight: k.right,
        }
      })
      expect(m).not.toBeNull()
      expect(m?.text).toMatch(/\d.*–.*\d/)
      expect(m!.footTop - m!.capBottom).toBeGreaterThanOrEqual(0)
      expect(m!.cardBottom - m!.capBottom).toBeGreaterThanOrEqual(0)
      expect(m!.cardRight - m!.capRight).toBeGreaterThanOrEqual(0)
    },
  )
})
