// expect: border-bad
// expect: text-good
// expect: bg-brand
// expect: shadow-line
// expect: bg-good-tint
// expect: bg-current
// expect: bg-brand-fill
// expect: text-good
// expect: border-brand
// expect: bg-info-tint
// expect: text-on-brand
import { useChartFocus } from 'basalt-ui/charts'

export const a = (
  <div className="border border-bad text-good bg-brand shadow-line bg-good-tint bg-current" />
)

export const banner = <div className="bg-brand-fill" />

export function Track({ spans }) {
  const focus = useChartFocus(spans, { announce: String })
  return (
    <div {...focus.target}>
      <div {...focus.item(0)} className="text-good">
        <span className="border-brand" />
      </div>
    </div>
  )
}

export const unbound = <div {...other.item(0)} className="bg-info-tint" />

export const loose = <span className="text-on-brand">2 s</span>
