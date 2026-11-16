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
// @valid
const a = <div role="row" />
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
