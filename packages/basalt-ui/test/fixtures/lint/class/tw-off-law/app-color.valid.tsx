import { useChartFocus } from 'basalt-ui/charts'

export const a = (
  <div className="border-l-4 text-current fill-current stroke-current text-foreground bg-background" />
)

export function Track({ spans }) {
  const focus = useChartFocus(spans, { announce: String })
  return (
    <div {...focus.target} className="flex flex-col gap-1">
      {spans.map((s, i) => (
        <div key={s} {...focus.item(i)} className="grid grid-cols-4">
          <div className="relative col-span-3 h-5">
            <div className="absolute inset-y-0 bg-brand-fill" />
            <div className="absolute inset-y-0 bg-chart-2 fill-seq-3 stroke-dim-bar" />
            <div className="absolute inset-y-0 bg-info-tint" />
            <span className="data-[spot=inside]:text-on-brand">2 s</span>
            <div className="absolute inset-y-0 w-px bg-brand" />
          </div>
        </div>
      ))}
    </div>
  )
}

export const focusRings = (
  <div className="focus-visible:outline-brand data-focused:outline-brand group-data-focused:outline-brand data-focused:ring-brand focus:ring-brand focus-within:ring-brand focus-visible:ring-offset-brand group-focus-visible:ring-brand peer-focus-visible:outline-brand has-focus-visible:ring-brand" />
)
