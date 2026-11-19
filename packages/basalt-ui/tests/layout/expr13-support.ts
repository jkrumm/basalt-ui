/**
 * The geometry of the expression cycle 13 kit-fix fixtures (`kit-expr13-*-fixture.tsx`): every SVG
 * mark the fixture's charts draw, as boxes in the chart's own px (from the chart's top left). Used by
 * the `kit-expr13-*.layout.test.ts` files, which build their documents with `buildExpr12Document`.
 */
import type { LayoutPage } from './harness'

export type Box = { l: number; r: number; t: number; b: number }
export type Mark = { key: string; tag: string; text: string; box: Box }
export type Chart = { id: string; marks: Mark[] }

/** Whether two boxes share any area. */
export const meet = (a: Box, b: Box): boolean => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b

/** The marks of each chart in `ids`, read from the page's SVG. */
export async function charts(page: LayoutPage, ids: readonly string[]): Promise<Chart[]> {
  return page.raw.evaluate(
    (testIds: string[]) =>
      testIds.map((id) => {
        const svg = document.querySelector(`[data-testid="${id}"] svg.ts-chart`)
        if (svg === null) return { id, marks: [] }
        const origin = svg.getBoundingClientRect()
        const marks = [...svg.querySelectorAll('[data-ts-key]')].flatMap((el) => {
          if (el.tagName !== 'text' && el.tagName !== 'rect' && el.tagName !== 'line') return []
          const r = el.getBoundingClientRect()
          return [
            {
              key: el.getAttribute('data-ts-key') ?? '',
              tag: el.tagName,
              text: el.textContent ?? '',
              box: {
                l: Math.round(r.left - origin.left),
                r: Math.round(r.right - origin.left),
                t: Math.round(r.top - origin.top),
                b: Math.round(r.bottom - origin.top),
              },
            },
          ]
        })
        return { id, marks }
      }),
    ids as string[],
  ) as Promise<Chart[]>
}

export type Pt = { x: number; y: number }
export type Path = { key: string; points: Pt[] }

/** The stroked paths of a chart (series lines), sampled every 2 px along their length, in the chart's own px. */
export async function paths(page: LayoutPage, id: string): Promise<Path[]> {
  return page.raw.evaluate((testId: string) => {
    const svg = document.querySelector(`[data-testid="${testId}"] svg.ts-chart`)
    if (svg === null) return []
    const origin = svg.getBoundingClientRect()
    return [...svg.querySelectorAll('path[data-ts-key]')].flatMap((el) => {
      const path = el as SVGPathElement
      const style = getComputedStyle(path)
      if (style.fill !== 'none' || style.stroke === 'none') return []
      const ctm = path.getScreenCTM()
      if (ctm === null) return []
      const total = path.getTotalLength()
      const points: { x: number; y: number }[] = []
      for (let at = 0; at <= total; at += 2) {
        const p = path.getPointAtLength(at).matrixTransform(ctm)
        points.push({ x: p.x - origin.left, y: p.y - origin.top })
      }
      const last = path.getPointAtLength(total).matrixTransform(ctm)
      points.push({ x: last.x - origin.left, y: last.y - origin.top })
      return [{ key: path.getAttribute('data-ts-key') ?? '', points }]
    })
  }, id) as Promise<Path[]>
}

/** Whether any sampled point of `path` lies inside `box`. */
export const strikes = (path: Path, box: Box): boolean =>
  path.points.some((p) => p.x > box.l && p.x < box.r && p.y > box.t && p.y < box.b)
