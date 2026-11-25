import { ChartCard, Lines } from "basalt-ui/charts";
import type { ReactElement } from "react";

type Week = { week: Date; deploys: number; rollbacks: number };

const START = Date.UTC(2026, 6, 6);
const WEEK_MS = 7 * 24 * 3_600_000;
const DEPLOYS = [14, 18, 17, 22, 19, 25, 24, 28, 26, 31, 29, 34];
const ROLLBACKS = [2, 1, 3, 1, 2, 1, 0, 2, 1, 1, 0, 1];
const DATA: Week[] = DEPLOYS.map((deploys, i) => ({
  week: new Date(START + i * WEEK_MS),
  deploys,
  rollbacks: ROLLBACKS[i] ?? 0,
}));

const token = (n: number): { light: string; dark: string } => ({
  light: `var(--basalt-chart-${n})`,
  dark: `var(--basalt-chart-${n})`,
});

/** What the island waits behind: the same card loading, as tall as the ready one at any width. */
export function DeploysChartFallback(): ReactElement {
  return (
    <ChartCard
      title="Deploys per week"
      figure={{ value: null, period: "week of 22 Sep" }}
      height="tall"
      phase="loading"
    />
  );
}

/** The one island on basalt-ui.com: a chart measures its box, so it renders on the client only. */
export function DeploysChart(): ReactElement {
  const last = DATA.at(-1);
  return (
    <ChartCard
      title="Deploys per week"
      figure={{ value: `${last?.deploys ?? 0}`, period: "week of 22 Sep" }}
      height="tall"
      chart={() => (
        <Lines
          label="Deploys and rollbacks per week"
          data={DATA}
          height="fill"
          x={{ value: (d) => d.week }}
          series={[
            {
              mark: "line",
              key: "deploys",
              label: "Deploys",
              color: token(1),
              y: (d) => d.deploys,
              area: "fade",
            },
            {
              mark: "line",
              key: "rollbacks",
              label: "Rollbacks",
              color: token(3),
              y: (d) => d.rollbacks,
            },
          ]}
        />
      )}
    />
  );
}
