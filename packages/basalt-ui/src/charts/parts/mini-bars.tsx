import type { ReactElement } from 'react'
import { barGeometry, capValues } from '../core/compile-spark'
import type { MiniBarsProps } from '../contract'
import { cn } from '../../core/cn'
import {
  BAR_CAP,
  OFF_SCALE_CARET,
  SparkFrame,
  announceOf,
  pool,
  readoutOf,
  summaryOf,
  toRows,
  useSparkFormat,
} from './sparkline-shared'

/**
 * A row of bars from a zero baseline: dim ink, one lit. The lit bar is `highlight` (an index, or
 * `'last'`, the default) and moves to the bar under a pointer or a key. Bars are at most 24 px wide
 * with a 3 px gap and a rounded data end. No `tone`, no `color`: the lit bar reads `--spark-now`,
 * which the frame sets from its delta or status and is neutral outside a frame.
 *
 * @useWhen a card or a strip shows a small count per period and one period matters (today, now)
 * @neverWhen the bars need axes, a legend, several series or a stack (use a bar chart)
 *
 * @example
 * <MiniBars points={perDay} height={72} axisLabels={['Mon', 'Today', 'Sun']} label="Shipped per day" />
 */
export function MiniBars(props: MiniBarsProps): ReactElement {
  const { points, height, width, axisLabels, format, cap, highlight = 'last' } = props
  const ariaLabel = props.label
  const { f, fmt } = useSparkFormat(format)
  const rows = pool(toRows(points), BAR_CAP, 'bar')
  const lit = highlight === 'last' ? rows.length - 1 : highlight
  const { values, over } = capValues(
    rows.map((r) => r.v),
    cap,
  )
  const capped = new Set(over)
  // Percent space: only the vertical part is read, the flex row places the bars across.
  const rects = barGeometry({ values, width: 100, height: 100, gap: 0 })

  return (
    <SparkFrame
      slot="mini-bars"
      ariaLabel={ariaLabel}
      summary={props.summary ?? summaryOf(rows, fmt)}
      height={height}
      width={width}
      axisLabels={axisLabels}
      rows={rows}
      readout={(row) => readoutOf(row, fmt, f)}
      announce={(row) => announceOf(row, fmt, f)}
      indexAt={(clientX, plot) => {
        let best = rows.length - 1
        let distance = Number.POSITIVE_INFINITY
        for (const el of plot.querySelectorAll<HTMLElement>('[data-index]')) {
          const box = el.getBoundingClientRect()
          const d = Math.abs(box.left + box.width / 2 - clientX)
          if (d < distance) {
            distance = d
            best = Number(el.getAttribute('data-index'))
          }
        }
        return best
      }}
    >
      {(active) => {
        const on = active ?? lit
        return (
          <div
            className={cn(
              'absolute inset-x-0 bottom-0 flex items-stretch justify-center gap-0.75',
              // A capped bar keeps the room its off-scale caret takes over it.
              capped.size === 0 ? 'top-0' : 'top-1.5',
            )}
          >
            {rects.map((r, i) => (
              <span
                // Rows are positional and never reorder.
                // oxlint-disable-next-line react/no-array-index-key
                key={i}
                data-index={i}
                className="relative h-full max-w-6 min-w-px flex-1"
              >
                {r === null || r.height === 0 ? null : (
                  <span
                    data-slot="spark-bar"
                    data-lit={i === on ? '' : undefined}
                    className={cn(
                      'absolute inset-x-0',
                      // The data end is rounded: the top of a bar above zero, the bottom of one below.
                      (rows[i]?.v ?? 0) < 0 ? 'rounded-b-[3px]' : 'rounded-t-[3px]',
                      i === on ? '' : 'bg-foreground/34 dark:bg-foreground/38',
                    )}
                    style={{
                      top: `${r.y}%`,
                      height: `${r.height}%`,
                      ...(i === on
                        ? { background: 'var(--spark-now, var(--color-foreground))' }
                        : {}),
                    }}
                  />
                )}
                {capped.has(i) && r !== null && (
                  <span
                    data-slot="spark-caret"
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-full text-[6px] leading-none text-muted-foreground"
                    style={{ top: `${r.y}%` }}
                  >
                    {OFF_SCALE_CARET}
                  </span>
                )}
              </span>
            ))}
          </div>
        )
      }}
    </SparkFrame>
  )
}
