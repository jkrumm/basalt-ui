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
