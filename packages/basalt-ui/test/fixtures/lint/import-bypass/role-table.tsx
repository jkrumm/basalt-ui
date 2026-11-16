// Fixture: primitive-bypass/role-table
// @invalid
const a = <div role="table" />
// @invalid
const a = <div role="grid" />
// @invalid
const a = <div role={'grid'} />
// @invalid
const a = <div role="presentation grid" />
// @valid
const a = <div role="group" />
// @invalid
const a = <div role="row" />
// @valid
const a = <TableRow role="row" />
// @valid
const a = <div role={kind} />
// @invalid x2
const a = (
  <div role="rowgroup">
    <span role="columnheader">Name</span>
  </div>
)
// @invalid
const a = (
  <div role="table">
    <div role="rowgroup">
      <span role="columnheader">Name</span>
    </div>
  </div>
)
// @invalid x3
const a = (
  <>
    <div role="grid" />
    <div role="rowgroup">
      <span role="columnheader">Name</span>
    </div>
  </>
)
// @invalid
const a = <div role="treegrid" />
// @invalid x2
const a = (
  <div>
    <div role="row">
      <div role="gridcell">{r.name}</div>
    </div>
  </div>
)
// @invalid
const a = <div role="rowheader">{r.name}</div>
// @invalid
const a = <div role="cell">{r.name}</div>
// @invalid x2
const a = (
  <div>
    <span role="columnheader">Name</span>
    <span role="row" />
  </div>
)
// @valid
const a = <div role="list">{items}</div>
