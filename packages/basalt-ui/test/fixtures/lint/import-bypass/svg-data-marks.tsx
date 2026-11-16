// Fixture: primitive-bypass/svg-data-marks (one report per map call)
// @invalid
const a = (
  <svg>
    {data.map((d) => (
      <rect key={d.id} x={d.x} height={d.h} />
    ))}
  </svg>
)
// @invalid
const a = (
  <svg>
    <g>
      {points.map((p) => (
        <circle key={p.id} cx={p.x} cy={p.y} r={2} />
      ))}
    </g>
  </svg>
)
// @invalid
const a = (
  <svg>
    {rows.map((r) => (
      <g key={r.id}>
        <rect />
        <text>{r.label}</text>
      </g>
    ))}
  </svg>
)
// @valid
const a = (
  <svg viewBox="0 0 16 16">
    <path d="M0 0h16" />
    <circle cx="8" cy="8" r="2" />
  </svg>
)
// @valid
const a = (
  <ul>
    {data.map((d) => (
      <li key={d.id}>
        <rect />
      </li>
    ))}
  </ul>
)
// @valid
const a = data.map((d) => (
  <svg key={d.id}>
    <path d="M0 0" />
  </svg>
))
// @valid
const a = (
  <ChartCard>
    <Lines data={data} />
  </ChartCard>
)
// @valid
const focus = useChartFocus(data)
const a = (
  <svg {...focus.target}>
    {data.map((d, i) => (
      <rect key={d.id} x={d.x} height={d.h} {...focus.item(i)} />
    ))}
  </svg>
)
// @valid
const focus = useChartFocus(rows)
const a = (
  <div {...focus.target}>
    <svg>
      {rows.map((r, i) => (
        <g key={r.id} {...focus.item(i)}>
          <rect x={r.x} />
          <text>{r.label}</text>
        </g>
      ))}
    </svg>
  </div>
)
// @invalid
const focus = useChartFocus(data)
const a = (
  <svg>
    {data.map((d, i) => (
      <rect key={d.id} x={d.x} {...focus.item(i)} />
    ))}
  </svg>
)
// @invalid
const focus = useChartFocus(data)
const a = (
  <div>
    <svg>
      {data.map((d, i) => (
        <rect key={d.id} x={d.x} {...focus.item(i)} />
      ))}
    </svg>
  </div>
)
// @invalid
const focus = useChartFocus(data)
const a = (
  <svg {...focus.target}>
    {data.map((d) => (
      <rect key={d.id} x={d.x} />
    ))}
  </svg>
)
// @invalid
const focus = useOther(data)
const a = (
  <svg {...focus.target}>
    {data.map((d, i) => (
      <rect key={d.id} x={d.x} {...focus.item(i)} />
    ))}
  </svg>
)
// @invalid
const d = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * 10},${20 - v}`).join(' ')
const a = (
  <svg viewBox="0 0 100 20">
    <path d={d} fill="none" />
  </svg>
)
// @invalid
const a = (
  <svg>
    <path d={pts.map((p) => `L${p.x},${p.y}`).join(' ')} />
  </svg>
)
// @invalid
const d = pts.reduce((acc, p) => `${acc}L${p.x},${p.y}`, 'M0,0')
const a = (
  <svg>
    <path d={d} />
  </svg>
)
// @valid
const a = (
  <svg>
    <path d="M0 0h16" />
  </svg>
)
// @valid
const ICON = 'M0 0h16'
const a = (
  <svg>
    <path d={ICON} />
  </svg>
)
// @valid
const d = `M0 0h${w}`
const a = (
  <svg>
    <path d={d} />
  </svg>
)
// @valid
const focus = useChartFocus(data)
const d = data.map((v, i) => `L${i},${v}`).join(' ')
const a = (
  <svg {...focus.target}>
    <path d={d} {...focus.item(0)} />
  </svg>
)
// @invalid
const points = rows.map((r, i) => `${i * 4},${40 - r.share}`).join(' ')
const a = (
  <svg aria-hidden="true">
    <polyline points={points} />
  </svg>
)
// @invalid
const a = (
  <svg>
    <polygon points={rows.map((r, i) => `${i},${r.share}`).join(' ')} />
  </svg>
)
// @valid
const a = (
  <svg>
    <polyline points="0,0 10,10" />
  </svg>
)
// @valid
function Rings({ rows, focus }) {
  return (
    <svg>
      {rows.map((r, i) => (
        <circle key={r.id} cx={r.x} {...focus.item(i)} />
      ))}
    </svg>
  )
}
// @valid
const Rings = (focus, rows) => (
  <svg>
    {rows.map((r, i) => (
      <g key={r.id} {...focus.item(i)}>
        <circle cx={r.x} />
      </g>
    ))}
  </svg>
)
// @invalid
function Rings({ rows, focus }) {
  return (
    <svg>
      {rows.map((r) => (
        <circle key={r.id} cx={r.x} />
      ))}
    </svg>
  )
}
// @invalid
const a = (
  <svg>
    {data.map((d, i) => (
      <rect key={d.id} x={d.x} {...d.item(i)} />
    ))}
  </svg>
)
