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
// @invalid
const a = (
  <DataPanel
    title="Share"
    body={() => (
      <>
        <Lines ariaLabel="share" data={rows} x="at" series={['share']} />
      </>
    )}
  />
)
// @valid
const a = (
  <DataPanel
    title="Rows"
    body={() => (
      <>
        <DataTable rows={rows} columns={columns} />
      </>
    )}
  />
)
// @invalid
const a = (
  <section>
    <Lines data={data} ariaLabel="Load" />
  </section>
)
// @valid
const a = (
  <div className="flex">
    <Lines data={data} ariaLabel="Load" />
  </div>
)
// @invalid
const a = (
  <main>
    <div>
      <Donut data={data} ariaLabel="Mix" />
    </div>
  </main>
)
// @valid
const a = (
  <section>
    <ChartCard title="Load" chart={<Lines data={data} ariaLabel="Load" />} />
  </section>
)
// @valid
const a = (
  <div>
    <Card>
      <Lines data={data} ariaLabel="Load" />
    </Card>
  </div>
)
// @valid
const a = (
  <div>
    <DataPanel title="Load" body={<Table />}>
      <Bars data={data} ariaLabel="Load" />
    </DataPanel>
  </div>
)
// @valid
const Spark = () => <Sparkline data={data} ariaLabel="Load" />
// @valid
const a = (
  <Stack>
    <Lines data={data} ariaLabel="Load" />
  </Stack>
)
// @invalid
import { Section } from 'basalt-ui/page'
const a = (
  <Section title="Usage">
    <Bars data={rows} ariaLabel="Usage" />
  </Section>
)
// @invalid
import { Page as Frame } from 'basalt-ui/page'
const a = (
  <Frame>
    <Lines data={rows} ariaLabel="Load" />
  </Frame>
)
// @valid
import { Section } from 'basalt-ui/page'
const a = (
  <Section title="Usage">
    <ChartCard title="Usage" chart={<Bars data={rows} ariaLabel="Usage" />} />
  </Section>
)
// @valid
import { Section } from './my-section'
const a = (
  <Section title="Usage">
    <Bars data={rows} ariaLabel="Usage" />
  </Section>
)
// @invalid
import * as P from 'basalt-ui/page'
const a = (
  <P.Section title="Trend">
    <Lines data={rows} x="at" y="value" />
  </P.Section>
)
// @valid
import * as P from 'basalt-ui/page'
const a = (
  <P.Section title="Trend">
    <ChartCard title="Trend" chart={<Lines data={rows} x="at" y="value" />} />
  </P.Section>
)
// @valid
import * as P from './my-page'
const a = (
  <P.Section title="Trend">
    <Lines data={rows} x="at" y="value" />
  </P.Section>
)
// @valid
import { Section } from 'basalt-ui/page'
const a = (
  <Section title="Activity">
    <StatGroup>
      <StatCell
        label="Sessions"
        value={12}
        chart={(box) => <Sparkline height={box.height} label="Sessions per day" series={daily} />}
      />
    </StatGroup>
  </Section>
)
// @valid
import { Page } from 'basalt-ui/page'
const a = (
  <Page>
    <StatGroup>
      <StatCell label="Load" value={3} chart={<Lines data={data} ariaLabel="Load" />} />
    </StatGroup>
  </Page>
)
// @invalid
import { Section } from 'basalt-ui/page'
const a = (
  <Section title="Activity">
    <StatGroup>
      <StatCell label="Sessions" value={12} />
    </StatGroup>
    <Sparkline height={28} label="Sessions per day" series={daily} />
  </Section>
)
