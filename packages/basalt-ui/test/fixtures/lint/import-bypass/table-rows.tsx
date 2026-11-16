// Fixture: primitive-bypass/table-rows
// @invalid
const a = (
  <TableBody>
    {[...runs].sort(by).map((r) => (
      <TableRow key={r.id} />
    ))}
  </TableBody>
)
// @invalid
const sorted = [...runs].sort(by)
const a = (
  <TableBody>
    {sorted.map((r) => (
      <TableRow key={r.id} />
    ))}
  </TableBody>
)
// @invalid
const a = (
  <TableBody>
    {rows.sort(by).map((r) => (
      <TableRow key={r.id} />
    ))}
  </TableBody>
)
// @invalid
const a = (
  <TableBody>
    {rows.slice(0, 10).map((r) => (
      <TableRow key={r.id} />
    ))}
  </TableBody>
)
// @invalid
const a = (
  <TableBody>
    {rows
      .filter(keep)
      .toSorted(by)
      .slice(0, 5)
      .map((r) => (
        <TableRow key={r.id} />
      ))}
  </TableBody>
)
// @invalid
const a = <TableHead onClick={() => setSort('name')}>Name</TableHead>
// @invalid
const a = (
  <TableBody>
    {runs.map((r) => (
      <TableRow key={r.id}>
        <TableCell>{r.name}</TableCell>
      </TableRow>
    ))}
  </TableBody>
)
// @invalid
const a = (
  <TableBody>
    {rows.filter(keep).map((r) => (
      <TableRow key={r.id} />
    ))}
  </TableBody>
)
// @invalid
const sorted = runs.toSorted((a, b) => a.ms - b.ms)
const a = (
  <TableBody>
    {sorted.map((r) => (
      <TableRow key={r.id} />
    ))}
  </TableBody>
)
// @invalid
const sorted = useMemo(() => runs.slice().sort(by), [runs])
const a = (
  <TableBody>
    {sorted.map((r) => (
      <TableRow key={r.id} />
    ))}
  </TableBody>
)
// @invalid
const a = (
  <TableBody>
    {q.data.map((r) => (
      <TableRow key={r.id}>
        {COLUMNS.map((c) => (
          <TableCell key={c}>{r[c]}</TableCell>
        ))}
      </TableRow>
    ))}
  </TableBody>
)
// @valid
const a = (
  <TableBody>
    {SHORTCUTS.map((r) => (
      <TableRow key={r.keys} />
    ))}
  </TableBody>
)
// @valid
const a = (
  <TableBody>
    {[1, 2, 3].map((r) => (
      <TableRow key={r} />
    ))}
  </TableBody>
)
// @valid
const a = (
  <TableBody>
    {SHORTCUTS.filter(keep).map((r) => (
      <TableRow key={r.keys} />
    ))}
  </TableBody>
)
// @valid
const sorted = SHORTCUTS.toSorted(by)
const a = (
  <TableBody>
    {sorted.map((r) => (
      <TableRow key={r.keys} />
    ))}
  </TableBody>
)
// @valid
const a = (
  <ul>
    {rows.sort(by).map((r) => (
      <li key={r.id} />
    ))}
  </ul>
)
// @valid
const a = <TableHead>Name</TableHead>
// @invalid
const a = (
  <TableBody>
    {Array.from(data ?? [], (r) => (
      <TableRow key={r.id}>
        <TableCell>{r.name}</TableCell>
      </TableRow>
    ))}
  </TableBody>
)
// @valid
const a = (
  <TableBody>
    {Array.from([a, b], (r) => (
      <TableRow key={r}>
        <TableCell>{r}</TableCell>
      </TableRow>
    ))}
  </TableBody>
)
// @valid
const a = <TableBody>{Array.from(data).length}</TableBody>
