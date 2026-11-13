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
