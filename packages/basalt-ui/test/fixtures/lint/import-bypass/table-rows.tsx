// Fixture: primitive-bypass/table-rows
// @invalid
const a = <TableBody>{rows.sort(by).map((r) => <TableRow key={r.id} />)}</TableBody>
// @invalid
const a = <TableBody>{rows.slice(0, 10).map((r) => <TableRow key={r.id} />)}</TableBody>
// @invalid
const a = <TableBody>{rows.filter(keep).toSorted(by).slice(0, 5).map((r) => <TableRow key={r.id} />)}</TableBody>
// @invalid
const a = <TableHead onClick={() => setSort("name")}>Name</TableHead>
// @valid
const a = <TableBody>{rows.map((r) => <TableRow key={r.id} />)}</TableBody>
// @valid
const a = <TableBody>{rows.filter(keep).map((r) => <TableRow key={r.id} />)}</TableBody>
// @valid
const a = <ul>{rows.sort(by).map((r) => <li key={r.id} />)}</ul>
// @valid
const a = <TableHead>Name</TableHead>
