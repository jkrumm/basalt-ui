// Fixture: primitive-bypass/chart-body-root
// @invalid
const a = <DataPanel title="Load" body={<Lines data={data} ariaLabel="Load" />} />
// @invalid
const a = <DataPanel title="Mix" body={<Donut data={data} ariaLabel="Mix" />} />
// @invalid
const a = <DataPanel title="Load" body={() => <CartesianChart data={data} ariaLabel="Load" />} />
// @invalid
const a = (
  <DataPanel title="Load" body={ready ? <Bars data={data} ariaLabel="Load" /> : <Skeleton />} />
)
// @valid
const a = <ChartCard title="Load" chart={<Lines data={data} ariaLabel="Load" />} />
// @valid
const a = <DataPanel title="Rows" body={<DataTable rows={rows} columns={columns} />} />
// @valid
const a = (
  <DataPanel
    title="Rows"
    body={
      <Stack>
        <Lines data={data} ariaLabel="Load" />
      </Stack>
    }
  />
)
// @invalid
const a = (
  <DataPanel
    title="Load"
    body={() => (
      <div className="h-64">
        <Lines data={data} ariaLabel="Load" />
      </div>
    )}
  />
)
// @invalid
const a = (
  <DataPanel
    title="Load"
    body={
      <div>
        <div>
          <Bars data={data} ariaLabel="Load" />
        </div>
      </div>
    }
  />
)
// @valid
const a = (
  <DataPanel
    title="Rows"
    body={() => (
      <div className="h-64">
        <DataTable rows={rows} columns={columns} />
      </div>
    )}
  />
)
