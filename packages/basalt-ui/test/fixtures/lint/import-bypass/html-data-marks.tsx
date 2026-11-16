// Fixture: primitive-bypass/html-data-marks (one report per map call)
// @invalid
const a = (
  <div>
    {rows.map((d) => (
      <div key={d.id} style={{ width: `${d.share * 100}%` }} />
    ))}
  </div>
)
// @invalid
const a = (
  <ul>
    {rows.map(({ id, share }) => (
      <li key={id}>
        <span style={{ left: `${share}%`, top: 0 }} />
      </li>
    ))}
  </ul>
)
// @invalid
const a = (
  <div>
    {rows.map((d) => (
      <i key={d.id} style={{ height: d.value }} />
    ))}
  </div>
)
// @invalid
const focus = useChartFocus(rows)
const a = (
  <div>
    {rows.map((d, i) => (
      <div key={d.id} style={{ width: d.share }} {...focus.item(i)} />
    ))}
  </div>
)
// @valid
const focus = useChartFocus(rows)
const a = (
  <div {...focus.target}>
    {rows.map((d, i) => (
      <div key={d.id} style={{ width: `${d.share * 100}%` }} {...focus.item(i)} />
    ))}
  </div>
)
// @valid
const focus = useChartFocus(rows)
const a = (
  <div {...focus.target}>
    {rows.map((d, i) => (
      <div key={d.id} {...focus.item(i)}>
        <span style={{ height: d.h }} />
      </div>
    ))}
  </div>
)
// @valid
const a = <div style={{ width: '50%', height: 4 }} />
// @valid
const a = (
  <div>
    {rows.map((d) => (
      <div key={d.id} style={{ color: d.tone }} />
    ))}
  </div>
)
// @valid
const a = (
  <div>
    {rows.map((d) => (
      <div key={d.id} style={{ width: '100%' }} />
    ))}
  </div>
)
// @valid
const a = <BarList rows={rows} />
// @valid
const a = (
  <div>
    {rows.map((d, i) => (
      <div key={d.id} style={{ top: i * 24 }} />
    ))}
  </div>
)
// @invalid
const a = (
  <div>
    {rows.map((r) => (
      <div key={r.name} className="h-2 w-(--w) bg-chart-1" style={{ '--w': `${r.pct}%` }} />
    ))}
  </div>
)
// @invalid
const a = (
  <div>
    {rows.map((r) => (
      <div key={r.name} className="h-(--h)" style={{ '--h': r.h }} />
    ))}
  </div>
)
// @invalid
const a = (
  <div>
    {rows.map((r) => (
      <div key={r.name} className="h-2 w-[var(--w)]" style={{ '--w': `${r.pct}%` }} />
    ))}
  </div>
)
// @valid
const a = (
  <div>
    {rows.map((r) => (
      <div key={r.name} className="bg-(--tone)" style={{ '--tone': r.tone }} />
    ))}
  </div>
)
// @valid
const a = (
  <div>
    {rows.map((r) => (
      <div key={r.name} className="h-2" style={{ '--w': `${r.pct}%` }} />
    ))}
  </div>
)
// @valid
const a = <div className="w-(--w)" style={{ '--w': `${pct}%` }} />
// @valid
const focus = useChartFocus(rows)
const a = (
  <div {...focus.target}>
    {rows.map((r, i) => (
      <div key={r.name} className="w-(--w)" style={{ '--w': `${r.pct}%` }} {...focus.item(i)} />
    ))}
  </div>
)
// @invalid
const a = (
  <div className="h-2 bg-inset">
    <div className="h-full bg-brand-fill" style={{ width: `${used * 100}%` }} />
  </div>
)
// @invalid
const a = <div style={{ width: pct + '%' }} />
// @valid
const a = <div style={{ width: '50%' }} />
// @valid
const a = <Progress value={used} />
// @invalid
const a = (
  <div className="flex h-2">
    {rows.map((r) => (
      <div key={r.id} style={{ flexGrow: r.value }} />
    ))}
  </div>
)
// @invalid
const a = (
  <div className="flex h-2">
    {rows.map((r) => (
      <div key={r.id} style={{ flex: `${r.value} 1 0` }} />
    ))}
  </div>
)
// @invalid
const a = (
  <div className="flex h-2">
    {rows.map((r) => (
      <div key={r.id} className="grow-(--g)" style={{ '--g': r.value }} />
    ))}
  </div>
)
// @invalid
const a = (
  <div className="flex h-2">
    {rows.map((r) => (
      <div key={r.id} className="basis-(--b)" style={{ '--b': `${r.share}%` }} />
    ))}
  </div>
)
// @valid
const a = (
  <div className="flex">
    {rows.map((r) => (
      <div key={r.id} style={{ flexGrow: 1 }} />
    ))}
  </div>
)
