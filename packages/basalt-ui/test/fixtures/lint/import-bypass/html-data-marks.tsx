// Fixture: primitive-bypass/html-data-marks (one report per map call)
// @invalid
const a = <div>{rows.map((d) => <div key={d.id} style={{ width: `${d.share * 100}%` }} />)}</div>
// @invalid
const a = <ul>{rows.map(({ id, share }) => <li key={id}><span style={{ left: `${share}%`, top: 0 }} /></li>)}</ul>
// @invalid
const a = <div>{rows.map((d) => <i key={d.id} style={{ 'height': d.value }} />)}</div>
// @invalid
const focus = useChartFocus(rows)
const a = <div>{rows.map((d, i) => <div key={d.id} style={{ width: d.share }} {...focus.item(i)} />)}</div>
// @valid
const focus = useChartFocus(rows)
const a = <div {...focus.target}>{rows.map((d, i) => <div key={d.id} style={{ width: `${d.share * 100}%` }} {...focus.item(i)} />)}</div>
// @valid
const focus = useChartFocus(rows)
const a = <div {...focus.target}>{rows.map((d, i) => <div key={d.id} {...focus.item(i)}><span style={{ height: d.h }} /></div>)}</div>
// @valid
const a = <div style={{ width: '50%', height: 4 }} />
// @valid
const a = <div>{rows.map((d) => <div key={d.id} style={{ color: d.tone }} />)}</div>
// @valid
const a = <div>{rows.map((d) => <div key={d.id} style={{ width: '100%' }} />)}</div>
// @valid
const a = <BarList rows={rows} />
// @valid
const a = <div>{rows.map((d, i) => <div key={d.id} style={{ top: i * 24 }} />)}</div>
