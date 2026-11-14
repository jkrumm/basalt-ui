// Fixture: primitive-bypass/svg-data-marks (one report per map call)
// @invalid
const a = <svg>{data.map((d) => <rect key={d.id} x={d.x} height={d.h} />)}</svg>
// @invalid
const a = <svg><g>{points.map((p) => <circle key={p.id} cx={p.x} cy={p.y} r={2} />)}</g></svg>
// @invalid
const a = <svg>{rows.map((r) => <g key={r.id}><rect /><text>{r.label}</text></g>)}</svg>
// @valid
const a = <svg viewBox="0 0 16 16"><path d="M0 0h16" /><circle cx="8" cy="8" r="2" /></svg>
// @valid
const a = <ul>{data.map((d) => <li key={d.id}><rect /></li>)}</ul>
// @valid
const a = data.map((d) => <svg key={d.id}><path d="M0 0" /></svg>)
// @valid
const a = <ChartCard><Lines data={data} /></ChartCard>
// @valid
const focus = useChartFocus(data)
const a = <svg {...focus.target}>{data.map((d, i) => <rect key={d.id} x={d.x} height={d.h} {...focus.item(i)} />)}</svg>
// @valid
const focus = useChartFocus(rows)
const a = <div {...focus.target}><svg>{rows.map((r, i) => <g key={r.id} {...focus.item(i)}><rect x={r.x} /><text>{r.label}</text></g>)}</svg></div>
// @invalid
const focus = useChartFocus(data)
const a = <svg>{data.map((d, i) => <rect key={d.id} x={d.x} {...focus.item(i)} />)}</svg>
// @invalid
const focus = useChartFocus(data)
const a = <div><svg>{data.map((d, i) => <rect key={d.id} x={d.x} {...focus.item(i)} />)}</svg></div>
// @invalid
const focus = useChartFocus(data)
const a = <svg {...focus.target}>{data.map((d) => <rect key={d.id} x={d.x} />)}</svg>
// @invalid
const focus = useOther(data)
const a = <svg {...focus.target}>{data.map((d, i) => <rect key={d.id} x={d.x} {...focus.item(i)} />)}</svg>
