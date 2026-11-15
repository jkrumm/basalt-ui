// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
export type Bar = { id: string; row: string; label: string; from: number; to: number }
export const LEGEND = [
  {
    key: 'deploy',
    label: 'Deploy window',
    color: { light: 'var(--vx-info)', dark: 'var(--vx-info)' },
  },
] as const

// #region recipe:timeline
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
      skeleton={{ rows: bars.length + 1 }} // the hour row plus one 32 px row per bar
      body={() => (
        <ScrollArea aria-label="Deploys by hour" orientation="horizontal">
          <div
            className="grid min-w-6xl auto-rows-8 grid-cols-[auto_repeat(24,minmax(0,1fr))] gap-y-2 px-(--card-edge)"
            style={{ '--bar': 'var(--vx-info-tint)' } as React.CSSProperties}
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
// #endregion
