// Blocks: see colour-literal.tsx.

// @invalid
const a = <Lines ariaLabel="Runs" data={runs.data ?? []} series={series} />

// @invalid
const a = <CartesianChart ariaLabel="Runs" data={data || []} series={series} />

// @invalid
const a = <Sparkline ariaLabel="Runs" data={query.data ?? []} />

// @valid
const a = <Lines ariaLabel="Runs" data={runs} state={{ pending, error, empty }} series={series} />

// @valid
const a = <Lines ariaLabel="Runs" data={runs.data ?? previous} series={series} />

// @valid
const a = <Table data={rows ?? []} />

// @valid
const a = <Lines ariaLabel="Runs" rows={runs.data ?? []} />
