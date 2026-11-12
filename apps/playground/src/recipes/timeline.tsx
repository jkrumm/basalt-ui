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
        <div className="grid auto-rows-8 grid-cols-[8rem_repeat(24,var(--col-w))] gap-y-2 overflow-x-auto px-(--card-edge) [--col-w:2.5rem]">
          <div className="col-span-full grid grid-cols-subgrid text-xs text-muted-foreground">
            {HOURS.map((h) => (
              <span key={h} className="col-start-auto first:col-start-2">
                {h}
              </span>
            ))}
          </div>
          {bars.map((bar) => (
            <div key={bar.id} className="col-span-full grid grid-cols-subgrid items-center text-sm">
              <span className="truncate">{bar.row}</span>
              {/* theme-allow hidden-inline-style — a bar's span is data, not a class */}
              <span
                className="truncate rounded-chip bg-info-tint px-2"
                style={{ gridColumn: `${bar.from + 2} / ${bar.to + 2}` }}
              >
                {bar.label}
              </span>
            </div>
          ))}
          <div className="pointer-events-none relative col-start-2 col-span-24 row-start-1 row-span-full">
            {/* theme-allow hidden-inline-style — the now line sits at a data position */}
            <div
              aria-hidden="true"
              className="absolute inset-y-0 w-px bg-brand"
              style={{ left: `${(now / 24) * 100}%` }}
            />
          </div>
        </div>
      )}
    />
  )
}
// #endregion
