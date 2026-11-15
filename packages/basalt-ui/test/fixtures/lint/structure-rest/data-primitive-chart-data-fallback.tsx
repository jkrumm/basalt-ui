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

// @invalid
const rows = q.data ?? []
const a = <Lines ariaLabel="Runs" data={rows} series={series} />

// @invalid
const rows = runs.data || []
const a = <Sparkline ariaLabel="Runs" data={rows} />

// @invalid
const { data = [] } = useRuns()
const a = <Bars ariaLabel="Runs" data={data} series={series} />

// @invalid
const { data: rows = [] } = useQuery(runsQuery)
const a = <Lines ariaLabel="Runs" data={rows} series={series} />

// @valid
const rows = q.data ?? previous
const a = <Lines ariaLabel="Runs" data={rows} series={series} />

// @valid
const rows = q.data ?? []
const a = <Table data={rows} />

// @valid
const rows = q.data ?? []
const a = <Lines ariaLabel="Runs" data={other} series={series} />

// @valid
const { data = [] } = props
const a = <Lines ariaLabel="Runs" data={data} series={series} />

// @valid
const { data } = useRuns()
const a = <Lines ariaLabel="Runs" data={data} state={{ pending }} series={series} />
