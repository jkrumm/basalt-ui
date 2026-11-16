// Fixture: primitive-bypass/raw-table
// @invalid
const a = (
  <table>
    <tbody>
      <tr>
        <td>1</td>
      </tr>
    </tbody>
  </table>
)
// @invalid
const a = <table className="w-full" />
// @valid
const a = (
  <Table>
    <TableBody />
  </Table>
)
// @valid
const a = <DataTable rows={rows} columns={columns} />
// @invalid
const a = (
  <dl className="grid grid-cols-2">
    <dt>Owner</dt>
    <dd>ops</dd>
  </dl>
)
// @valid
const a = <div className="table-fixed table-auto" />
// @valid
const a = <Facts rows={rows} />
// @invalid
const a = (
  <dl>
    <dt>Name</dt>
    <dd>{r.name}</dd>
  </dl>
)
// @invalid
const a = (
  <div className="table w-full">
    <div className="table-row">
      <div className="table-cell">{r.name}</div>
    </div>
  </div>
)
// @invalid
const a = <span className="table-cell">x</span>
// @valid
const a = <TableCell className="table-cell">x</TableCell>
// @invalid
const a = (
  <ul className="inline-table">
    <li>{r.name}</li>
  </ul>
)
// @valid
const a = <ul className="inline-flex">x</ul>
