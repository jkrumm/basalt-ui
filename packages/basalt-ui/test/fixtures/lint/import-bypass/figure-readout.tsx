// Fixture: primitive-bypass/figure-readout
// @invalid
const a = (
  <ChartCard
    title="Pace"
    figure={{ value: focus.readout(total, (d) => d.behind), period: 'whole run' }}
    chart={chart}
  />
)
// @invalid x2
const a = (
  <ChartCard
    title="Pace"
    figure={{
      value: focus.readout(total, (d) => d.behind),
      delta: focus.readout(restDelta, deltaOf),
    }}
    chart={chart}
  />
)
// @invalid
const a = (
  <ChartCard
    title="Rate"
    figure={
      ready
        ? { value: focus.readout(pct(rate), (h) => pct(h.rate)), unit: 'fell back' }
        : { value: null }
    }
    chart={chart}
  />
)
// @invalid
const a = (
  <ChartCard
    title="Rate"
    figure={{
      value: total,
      delta: { value: focus.readout('+3%', (d) => d.delta), polarity: 'up-good' },
    }}
    chart={chart}
  />
)
// @valid
const a = (
  <ChartCard
    title="Pace"
    figure={{
      value: total,
      period: focus.readout('whole run', (d) => d.name),
      status: focus.readout(restStatus, statusOf),
    }}
    chart={chart}
  />
)
// @valid
const a = <ChartCard title="Pace" figure={{ value: total }} footer={facts} chart={chart} />
