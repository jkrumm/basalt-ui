// Blocks: see color-literal.tsx.

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

// @invalid
// @ts
const a = <Lines data={q.data || ([] as Row[])} />

// @invalid
// @ts
const a = <Bars data={q.data ?? ([] as Row[])} />

// @invalid
// @ts
const rows = q.data ?? ([] satisfies Row[])
const a = <Lines data={rows} />

// @valid
// @ts
const a = <Lines data={q.data ?? ([] as Row[]).concat(extra)} />

// @invalid
const EMPTY = []
const a = <Lines ariaLabel="Runs" data={q.data ?? EMPTY} series={series} />

// @invalid
// @ts
const EMPTY: Row[] = []
const a = <Bars ariaLabel="Runs" data={q.data ?? EMPTY} series={series} />

// @invalid
// @ts
const EMPTY = [] as const
const rows = q.data || EMPTY
const a = <Lines ariaLabel="Runs" data={rows} series={series} />

// @invalid
const rows = useMemo(() => q.data ?? [], [q.data])
const a = <Bars ariaLabel="Runs" data={rows} series={series} />

// @invalid
const rows = useMemo(() => {
  return q.data || []
}, [q.data])
const a = <Sparkline ariaLabel="Runs" data={rows} />

// @valid
const FALLBACK = previous
const a = <Lines ariaLabel="Runs" data={q.data ?? FALLBACK} series={series} />

// @valid
const EMPTY = []
const a = <Table data={q.data ?? EMPTY} />

// @valid
const rows = useMemo(() => q.data.map(toRow), [q.data])
const a = <Lines ariaLabel="Runs" data={rows} series={series} />

// @valid
const rows = useMemo(() => q.data ?? previous, [q.data])
const a = <Lines ariaLabel="Runs" data={rows} series={series} />

// @valid
const rows = useMemo(() => q.data ?? [], [q.data])
const a = <Table data={rows} />

// @invalid
const EMPTY = []
const a = <BarChart ariaLabel="Runs" data={q.data ?? EMPTY} />

// @invalid
const a = <BarChart ariaLabel="Runs" data={q.isSuccess ? q.data : []} />

// @invalid
const a = <BarChart ariaLabel="Runs" data={q.isPending ? [] : q.data} />

// @valid
const a = <BarChart ariaLabel="Runs" data={q.isSuccess ? q.data : previous} />

// @valid
const a = <Table data={q.isSuccess ? q.data : []} />

// @valid
const a = <Lines ariaLabel="Runs" data={shot === 'empty' ? [] : rows} series={series} />

// @valid
const hours = shot === 'empty' ? [] : all
const a = <Bars ariaLabel="Hours" data={hours} />

// @invalid
const a = <Lines ariaLabel="Runs" data={isLoading ? [] : data} />

// @invalid
// @ts
const a = <Lines ariaLabel="Runs" data={isLoading ? [] : (data as Row[])} />

// @invalid
const a = <Bars ariaLabel="Runs" data={data ?? Array.of()} />

// @invalid
// @ts
const a = <Bars ariaLabel="Runs" data={data ?? Array.of<Row>()} />

// @invalid
const a = <Bars ariaLabel="Runs" data={q.data ?? new Array()} />

// @invalid
const a = <Bars ariaLabel="Runs" data={q.data || Array()} />

// @valid
const a = <Bars ariaLabel="Runs" data={q.data ?? Array.of(first)} />

// @valid
const a = <Bars ariaLabel="Runs" data={q.data ?? new Array(3)} />

// @valid
const a = <Lines ariaLabel="Runs" data={isLoading ? [] : rows} />

// @invalid
// @ts
const a = <Bars ariaLabel="Runs" data={(q.data ?? []) as Row[]} />

// @invalid
// @ts
const a = <Bars ariaLabel="Runs" data={(q.data ?? []) satisfies Row[]} />

// @invalid
// @ts
const a = <Bars ariaLabel="Runs" data={(q.data || [])!} />

// @valid
// @ts
const a = <Bars ariaLabel="Runs" data={q.data as Row[]} />
