import { PreviewCard, PreviewCardContent, PreviewCardTrigger } from 'basalt-ui/ui/preview-card'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <PreviewCard>
      <PreviewCardTrigger href="/runs/morning-run" className="text-brand underline">
        Morning run
      </PreviewCardTrigger>
      <PreviewCardContent className="w-80">
        <p className="m-0 text-sm font-medium">Morning run</p>
        <p className="m-0 text-sm text-muted-foreground">12.4 km, 52 min, 14 Nov 2026</p>
      </PreviewCardContent>
    </PreviewCard>
  )
}
