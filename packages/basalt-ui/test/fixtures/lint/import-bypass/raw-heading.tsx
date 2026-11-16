// Fixture: primitive-bypass/raw-heading
// @invalid
const a = <h1>Dashboard</h1>
// @invalid
const a = <h3 className="text-sm">Totals</h3>
// @invalid
const a = <h6>Note</h6>
// @valid
const a = <Section title="Totals" />
// @valid
const a = <PageBar title="Dashboard" />
// @valid
const a = <header>Top</header>
// @valid
const a = (
  <div>
    {columns.map((col) => (
      <section key={col.id} aria-label={col.label}>
        <h3 className="text-sm">{col.label}</h3>
      </section>
    ))}
  </div>
)
// @valid
const a = (
  <ul>
    {groups.map((g) => {
      return (
        <li key={g.id}>
          <h4>{g.name}</h4>
        </li>
      )
    })}
  </ul>
)
// @invalid
const a = (
  <section aria-label="Totals">
    <h3>Totals</h3>
  </section>
)
// @invalid
const a = (
  <div>
    {columns.map((col) => (
      <Card key={col.id}>
        <h3>{col.label}</h3>
      </Card>
    ))}
  </div>
)
// @invalid
const a = (
  <div>
    {columns.map((col) => (
      <section key={col.id}>
        <div>
          <h3>{col.label}</h3>
        </div>
      </section>
    ))}
  </div>
)
// @invalid
const a = (
  <main>
    <h1>Settings</h1>
  </main>
)
// @invalid
const Tag = level === 2 ? 'h2' : 'h3'
const a = <Tag>Title</Tag>
// @invalid
const H = `h${level}`
const a = <H>Title</H>
// @valid
const Tag = 'div'
const a = <Tag>Title</Tag>
// @invalid
const a = (
  <div role="heading" aria-level={2}>
    Runs
  </div>
)
// @valid
const a = (
  <div role="group" aria-level={2}>
    Runs
  </div>
)
