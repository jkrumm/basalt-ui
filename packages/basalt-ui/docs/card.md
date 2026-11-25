---
name: Card
use when: 'a group of content needs a surface of its own in a hand-built layout'
never when: 'a part already frames the content (ChartCard, StatCard, Section), or the content is page text (no surface)'
subpath: basalt-ui/ui/card
peers: ['@base-ui/react']
slots: [card, card-band, card-info, icon-tile, inset, card-phase]
---

# Card

The base card: a surface with a radius and a ring. Works with no provider; polymorphism only
through `render`.

## Props

### `Card`

```ts
Card({ flush, className, render, ref, ...props }: CardProps): ReactElement
  flush?: boolean | null
  className?: string  // Layout only (`w-full`, `col-span-2`, `mt-4`)
```

### `Inset`

A recessed region of a flush card: one surface step down, inside the card's gutter
(`--card-gutter`, 4 px), with the concentric inset radius, so the shell shows as a frame around
it. Its content still starts on the shared left edge (`--card-edge`) the bands use. The last
inset of a card keeps the gutter below it too.

```ts
Inset({ className, ...props }: PartProps<"div">): ReactElement
  className?: string  // Layout only (`w-full`, `col-span-2`, `mt-4`)
```

### `IconTile`

The neutral tile behind a band icon. It has no tone: color belongs to a verdict, not to a card.

```ts
IconTile({ className, ...props }: PartProps<"span">): ReactElement
  className?: string  // Layout only (`w-full`, `col-span-2`, `mt-4`)
```

### `CardInfo`

The definition glyph: a button that opens a native popover (`popover` + `popovertarget`), so the
browser owns Escape, light dismiss and focus return, and no overlay library enters the closure.
Click opens it, never hover.

```ts
CardInfo({ label, children, className, ...props }: CardInfoProps): ReactElement
  className?: string  // Layout only
  label: string  // Names the glyph button for assistive tech (`About Shipped`)
  children: ReactNode  // The definition: one sentence on what the card measures
```

### `CardBand`

The header row every frame shares: `icon`, `title`, `subtitle`, `info` and `end` on the card's
left edge.

```ts
CardBand({ icon: Icon, title, subtitle, info, end, className, ...props }: CardBandProps): ReactElement
  className?: string  // Layout only (`w-full`, `col-span-2`, `mt-4`)
  icon?: IconComponent
  title: string
  subtitle?: string
  info?: string  // The definition behind the glyph: one sentence on what the card measures
  end?: ReactNode  // Trailing controls; a menu or a filter slot
```

### `CardPhase`

Renders the phase for every frame: the skeleton, the error arm, the empty arm and the stale line
around the body, inside one box. A throwing box slot renders the error arm and leaves the
neighbouring cards alone; Retry runs the slot again. Frames given one `retry` function (one query
result, one `Phase`) draw Retry once, on the first frame to mount; the others show their message alone.

```ts
CardPhase({ phase, empty, height, skeleton, children, arms, staleLine, className, style, }: CardPhaseProps): ReactElement
  phase?: Phase | QueryStateLike
  empty?: Empty | null
  height?: number | "fill"  // The box height the body gets and every other phase holds; `fill` takes the card's remainder
  skeleton?: ReactElement<unknown, string | React.JSXElementConstructor<any>> | { rows: number; } | { height: number; }  // The loading shape, at the final box
  children: ReactNode | BoxSlot  // The body
  arms?: Arms  // How the empty and error arms sit: `stack` (default) centres them in a box at least 96 px tall; `line` draws each as one row on the card's left edge, for a box as short as one figure row
  staleLine?: "body" | "corner"  // `corner` (default) draws the stale line over the body's top-right corner; `body` leaves it to the body, which places it in its own flow (the stat card's figure row)
  className?: string
  style?: CSSProperties  // Replaces the inline `height` a numeric `height` sets, for a height CSS decides (a calc on a token)
```

## `cardVariants`

Part `card`.

- `flush`: `true`, `false` (default `false`)

## Slots

- `card`
- `card-band`
- `card-info`
- `icon-tile`
- `inset`
- `card-phase`
