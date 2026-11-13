// Fixture: primitive-bypass/raw-table
// @invalid
const a = <table><tbody><tr><td>1</td></tr></tbody></table>
// @invalid
const a = <table className="w-full" />
// @valid
const a = <Table><TableBody /></Table>
// @valid
const a = <DataTable rows={rows} columns={columns} />
