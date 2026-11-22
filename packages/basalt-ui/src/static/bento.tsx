import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { BLOCK_FRAME, BlockHead } from './blocks'
import type { Slot } from './types'

export type SiteBentoProps = {
  /** The section's `h2`. */
  title?: Slot
  description?: Slot
  /** The tiles: `SiteFeature` elements. */
  children: Slot
  className?: string
}

/**
 * A grid of feature tiles of mixed size. The grid keys on its own container: one column, two from
 * 40rem, three from 64rem; a `wide` tile spans two columns and a `tall` one two rows, and the grid
 * packs the gaps densely.
 *
 * @useWhen a landing page shows what a product does, each claim with a real part as its picture
 * @neverWhen the tiles are records or figures of an app (use `CardGrid` with cards)
 *
 * @example
 * <SiteBento title="What you get">
 *   <SiteFeature title="Static parts" description="Zero client JavaScript." span="wide">
 *     <SiteCodeBlock copyLabel="Copy" copiedLabel="Copied"><pre><code>bun add basalt-ui</code></pre></SiteCodeBlock>
 *   </SiteFeature>
 * </SiteBento>
 */
export function SiteBento({
  title,
  description,
  children,
  className,
}: SiteBentoProps): ReactElement {
  return (
    <section data-slot="site-bento" className={cn('@container', className)}>
      <div className={cn(BLOCK_FRAME, 'flex flex-col gap-8 py-12 @[64rem]:py-16')}>
        <BlockHead title={title} description={description} />
        <div className="grid grid-flow-row-dense grid-cols-[minmax(0,1fr)] gap-4 @[40rem]:grid-cols-2 @[64rem]:grid-cols-3">
          {children}
        </div>
      </div>
    </section>
  )
}

export type SiteFeatureProps = {
  /** The tile's `h3`. */
  title: Slot
  description?: Slot
  /** The tile's body: a real part, an image or an island, set in an inset well under the text. */
  children?: Slot
  /** `wide` spans two columns, `tall` two rows, `large` both; from the grid's two-column size. */
  span?: 'wide' | 'tall' | 'large'
  className?: string
}

const SPAN = {
  wide: '@[40rem]:col-span-2',
  tall: '@[40rem]:row-span-2',
  large: '@[40rem]:col-span-2 @[40rem]:row-span-2',
} as const

/**
 * One tile of a `SiteBento`: a title, a line of text and a body slot for the real thing the claim
 * is about. Inert: a tile is never a link, so the part in its body keeps its own controls.
 *
 * @useWhen a bento tile states one claim and shows it
 * @neverWhen the tile is a record an app opens (use `Card`)
 *
 * @example
 * <SiteFeature title="Your words" description="Every label is a prop."><ThemeSwitch {...labels} /></SiteFeature>
 */
export function SiteFeature({
  title,
  description,
  children,
  span,
  className,
}: SiteFeatureProps): ReactElement {
  return (
    <article
      data-slot="site-feature"
      className={cn(
        'flex min-w-0 flex-col gap-4 rounded-card bg-card p-4 shadow-card @[40rem]:p-5',
        span !== undefined && SPAN[span],
        className,
      )}
    >
      <div className="flex flex-col gap-1.5">
        <h3 className="font-head text-md font-semibold text-foreground">{title}</h3>
        {description !== undefined && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children !== undefined && (
        <div className="flex min-w-0 flex-1 flex-col justify-center rounded-inset bg-inset p-3 @[40rem]:p-4">
          {children}
        </div>
      )}
    </article>
  )
}
