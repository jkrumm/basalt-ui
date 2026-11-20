import { Card, CardBand, CardInfo, CardPhase, IconTile, Inset } from 'basalt-ui/ui/card'
import type { ReactElement } from 'react'

function ServerGlyph({ className }: { className?: string }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01" />
    </svg>
  )
}

export function Demo(): ReactElement {
  return (
    <div className="grid max-w-xl gap-4">
      <Card flush>
        <CardBand
          icon={ServerGlyph}
          title="Services"
          subtitle="6 monitored"
          info="Services that answered their last health check."
        />
        <Inset>
          <CardPhase phase="ready" height={72}>
            <p className="m-0 text-sm">5 healthy, 1 degraded since Friday.</p>
          </CardPhase>
        </Inset>
      </Card>
      <Card>
        <div className="flex items-center gap-3">
          <IconTile>
            <ServerGlyph className="size-4" />
          </IconTile>
          <p className="m-0 flex-1 text-sm">Shipped this week</p>
          <CardInfo label="About Shipped">Orders that left the warehouse since Monday.</CardInfo>
        </div>
      </Card>
    </div>
  )
}
