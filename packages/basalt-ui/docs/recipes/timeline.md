---
name: timeline
use-when: dated bars on a shared time axis, read-only, in a card frame
---

A timeline is a `DataPanel` whose body is a CSS grid in a horizontal `ScrollArea`: a label column, then one column per hour, with `min-w-6xl` keeping the hours legible in a narrow container. Each row is a subgrid, so the hour header and every bar share the columns. A bar's span and the now line's position are data, passed as CSS custom properties (`--at`, `--now`) that the classes read; a bar's color is the `--bar` property, set once on the grid to the theme variable `--color-info-tint` (`--basalt-info-tint` is not a token, and a status color class is not app code's to use). The now line is one absolutely placed element in a column-spanning cell. Put a range control in the panel's `toolbar`. The panel owns the phase, so the body runs only when there is data.

```tsx
import { DataPanel } from 'basalt-ui/cards'
import { ScrollArea } from 'basalt-ui/ui/scroll-area'

const HOURS = Array.from({ length: 24 }, (_, h) => h)

/** `from`, `to` and `now` are hours of the day; column 1 holds the row label. */
export function Timeline({ bars, now }: { bars: Bar[]; now: number }) {
  return (
    <DataPanel
      title="Deploys"
      subtitle="Today, UTC"
      legend={LEGEND}
      bodySize={{ height: (bars.length + 1) * 40 - 8 }} // the hour row plus one row per bar: 32 px rows, 8 px apart
      body={() => (
        <ScrollArea aria-label="Deploys by hour" orientation="horizontal">
          <div
            className="grid min-w-6xl auto-rows-8 grid-cols-[auto_repeat(24,minmax(0,1fr))] gap-y-2 px-(--card-edge)"
            style={{ '--bar': 'var(--color-info-tint)' } as React.CSSProperties}
          >
            <div className="col-span-full grid grid-cols-subgrid text-xs text-muted-foreground">
              {HOURS.map((h) => (
                <span key={h} className="col-start-auto first:col-start-2">
                  {h}
                </span>
              ))}
            </div>
            {bars.map((bar) => (
              <div
                key={bar.id}
                className="col-span-full grid grid-cols-subgrid items-center text-sm"
                style={{ '--at': `${bar.from + 2} / ${bar.to + 2}` } as React.CSSProperties}
              >
                <span className="truncate">{bar.row}</span>
                <span className="col-(--at) truncate rounded-chip bg-(--bar) px-2">
                  {bar.label}
                </span>
              </div>
            ))}
            <div
              className="pointer-events-none relative col-span-24 col-start-2 row-span-full row-start-1"
              style={{ '--now': `${(now / 24) * 100}%` } as React.CSSProperties}
            >
              <div aria-hidden className="absolute inset-y-0 left-(--now) w-px bg-foreground" />
            </div>
          </div>
        </ScrollArea>
      )}
    />
  )
}
```
