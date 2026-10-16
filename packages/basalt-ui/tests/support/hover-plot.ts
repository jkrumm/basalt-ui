/** Test helper: a pointer move over a chart's svg, then the settle the engine's frame needs. */
import { act } from 'react'

/** Long enough for the engine to resolve focus and publish the shared cursor. */
const HOVER_SETTLE_MS = 30

export async function hoverPlot(svg: Element | null | undefined): Promise<void> {
  if (!svg) throw new Error('hoverPlot: no chart svg to hover')
  await act(async () => {
    svg.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 300, clientY: 100, bubbles: true }),
    )
    await new Promise((r) => setTimeout(r, HOVER_SETTLE_MS))
  })
}
