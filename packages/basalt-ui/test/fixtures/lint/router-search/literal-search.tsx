// Blocks: a `// @valid` or `// @invalid` header starts one (see structure-rest/colour-literal.tsx).

// @invalid
const a = <Link to="/runs" search={{ range: '30d' }} />

// @invalid
const a = <Link to="/runs" search={(prev) => ({ ...prev, range: '30d' })} />

// @invalid
const a = <Link to="/runs" search={function (prev) { return { range: '30d' } }} />

// @valid
const a = <Link to="/runs" search={store.field.range.link()} />

// @valid
const a = <Link to="/runs" search={search} />

// @valid
const a = <Link to="/runs" search={(prev) => prev} />

// @valid
const a = <Link to="/runs" />

// @valid
const a = <a href="/runs" search={{ range: '30d' }} />
