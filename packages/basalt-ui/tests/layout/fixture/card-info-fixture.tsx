import type { ReactElement } from 'react'
import { Card, CardBand, Inset } from '../../../src/ui/card'

const INFO =
  'Pull requests merged into the default branch in the selected range, counted once per pull ' +
  'request even when it was reverted and merged again.'

/**
 * `ui/card` info probes (S11), each in a `data-testid` box:
 * - `card-info-left`: a card on the left edge, the popover opens down and to the right;
 * - `card-info-right`: a narrow card pushed to the right edge, the popover must flip and stay in view;
 * - `card-info-link`: a stretched-link card (an overlay `<a>`), the glyph must still be the target;
 * - `card-info-outside`: a plain focusable button, the light-dismiss click target.
 */
export function CardInfoFixture(): ReactElement {
  return (
    // theme-allow -- the wrappers are the probe's payload (card at either edge of the viewport)
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="card-info-left">
        <Card flush>
          <CardBand title="Shipped" subtitle="vs last week" info={INFO} />
          <Inset>388</Inset>
        </Card>
      </div>
      <div className="flex justify-end">
        <div data-testid="card-info-right" className="w-48">
          <Card flush>
            <CardBand title="Merged" info={INFO} />
          </Card>
        </div>
      </div>
      <div data-testid="card-info-link">
        <Card flush className="relative">
          <a
            href="#stretched"
            aria-label="Open Shipped"
            className="absolute inset-0 z-0"
            data-testid="card-info-link-target"
          />
          <CardBand title="Reviews" info={INFO} />
        </Card>
      </div>
      <button type="button" data-testid="card-info-outside">
        Outside
      </button>
      <p data-testid="card-info-text">Plain text outside every card.</p>
    </div>
  )
}
