// Fixture: primitive-bypass/list-rows
// @invalid
const a = rows.map((r) => (
  <div key={r.id} className="flex justify-between border-b px-3 py-2 text-sm">
    {r.label}
  </div>
))
// @invalid
const a = rows.map((r) => {
  return (
    <li key={r.id} className="flex gap-2 border-b border-grid">
      {r.label}
    </li>
  )
})
// @invalid
const a = (
  <ul className="m-0 divide-y">
    {issues.map((i) => (
      <li key={i.id}>{i.title}</li>
    ))}
  </ul>
)
// @invalid
const a = rows.map((r) => (
  <div key={r.id} className={cn('flex px-3', first && 'border-t')}>
    {r.label}
  </div>
))
// @invalid
const a = rows.map((r) => (
  <div key={r.id} className="flex data-focused:bg-selected md:border-b-2">
    {r.label}
  </div>
))
// @valid
const a = <RowList title="Open issues" items={items} focus={focus} />
// @valid
const a = <RowList title="Open issues" items={items} separator="hairline" />
// @valid
const a = rows.map((r) => (
  <div key={r.id} className="flex gap-2 px-3 py-2">
    {r.label}
  </div>
))
// @valid
const a = rows.map((r) => (
  <div key={r.id} className="rounded-card border p-3">
    {r.label}
  </div>
))
// @valid
const a = rows.map((r) => (
  <div key={r.id} className="border-b-0 border-l-2 last:border-b-0">
    {r.label}
  </div>
))
// @valid
const NAV = ['a', 'b']
const a = NAV.map((n) => (
  <div key={n} className="border-b">
    {n}
  </div>
))
// @valid
const a = [1, 2].map((n) => (
  <li key={n} className="border-b">
    {n}
  </li>
))
// @valid
const a = (
  <div className="divide-y">
    <p>one</p>
    <p>two</p>
  </div>
)
// @valid
const a = groups.map((g) => (
  <ul key={g.id} className="border-t pt-2">
    {g.name}
  </ul>
))
// @valid
const a = <div className="border-b">{rows.length}</div>
