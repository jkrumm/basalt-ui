import { StatCard, StatCell, StatGroup } from "basalt-ui/cards";
import { Sparkline } from "basalt-ui/charts";
import type { ReactElement } from "react";

const DEPLOYS = [14, 18, 17, 22, 19, 25, 24, 28, 26, 31, 29, 34];
const BUILD = [212, 205, 198, 201, 190, 186, 181, 184, 179, 176, 178, 174];

/**
 * The hero's picture: two basalt dashboard cards, rendered to HTML at build time with no client
 * directive. The sparklines are drawn at rest, so the page still ships no JavaScript.
 */
export function HeroConsole(): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-4 @regular:grid-cols-2">
      <StatCard
        title="Deploys"
        subtitle="this week"
        value={34}
        delta={{ value: "+17%", polarity: "up-good" }}
        chart={(box) => <Sparkline points={DEPLOYS} height={box.height} label="Deploys per week" />}
        axisLabels={["Jul", "Aug", "Sep"]}
        footer={[
          { label: "Rollbacks", value: 1 },
          { label: "Services", value: 6 },
        ]}
      />
      <StatCard
        title="Median build"
        subtitle="this week"
        value={174}
        unit="s"
        delta={{ value: "-4 s", polarity: "up-bad" }}
        chart={(box) => (
          <Sparkline points={BUILD} height={box.height} label="Median build per week" />
        )}
        axisLabels={["Jul", "Aug", "Sep"]}
        footer={[
          { label: "Cache hits", value: "92%" },
          { label: "Runners", value: 3 },
        ]}
      />
    </div>
  );
}

/** A strip of three figures for the bento's dashboard tile, static like the hero's cards. */
export function FleetStrip(): ReactElement {
  return (
    <StatGroup variant="strip" label="Fleet this week">
      <StatCell
        title="Services healthy"
        value="6 / 6"
        status={{ tone: "good", label: "all up" }}
        chart={(box) => (
          <Sparkline
            points={[5, 6, 6, 5, 6, 6, 6]}
            height={box.height}
            reference={6}
            label="Healthy services per day"
          />
        )}
      />
      <StatCell
        title="Deploys"
        value={34}
        delta={{ value: "+17%", polarity: "up-good", label: "vs last week" }}
      />
      <StatCell
        title="Median build"
        value={174}
        unit="s"
        delta={{ value: "-4 s", polarity: "up-bad", label: "vs last week" }}
      />
    </StatGroup>
  );
}
