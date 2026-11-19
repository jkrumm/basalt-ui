/**
 * A `Heatmap` cell's label ink, chosen against the fill the cell draws in its state. The ink is
 * black or white by `inkOn` (the lightness switch the bar labels use), evaluated on the opaque
 * composite of the paint over the card. A dimmed cell's label draws at `DIMMED_TEXT`, the kit's
 * dimmed-text opacity, and the ink is chosen on the dimmed composite. `kit-expr13-heatmap-ink.test.ts`
 * holds every ramp step, dimmed or not, to its floor in both schemes.
 */
import { alpha } from '../../tokens'
import { CV, DIMMED, DIMMED_TEXT } from '../core/theme'
import { barOnCard, inkOn } from '../marks'

/** `alpha(token, a)` as the kit writes it: a token at a share, over transparent. */
const ALPHA_MIX = /^color-mix\(in srgb, (var\(--basalt-[a-z0-9-]+\)) (\d+)%, transparent\)$/

/** The label itself: the ink, at the dimmed-text opacity when its cell dims. */
const labelOn = (surface: string, dimmed: boolean): string =>
  dimmed ? alpha(inkOn(surface), DIMMED_TEXT) : inkOn(surface)

/** The ink of a value or absent cell: its flat `color` at `opacity` over the card, dimmed or not. */
export function flatInk(color: string, opacity: number, dimmed: boolean): string {
  const share = opacity * (dimmed ? DIMMED : 1)
  return labelOn(`color-mix(in srgb, ${color} ${Math.round(share * 100)}%, ${CV.surface})`, dimmed)
}

/**
 * The ink of a stated cell: its state fill at `strength` in the bar's own rest or dimmed paint. An
 * `alpha()` fill folds its share into the strength, so the composite is the one the cell draws.
 */
export function stateInk(fill: string, strength: number, dimmed: boolean): string {
  const mixed = ALPHA_MIX.exec(fill)
  const color = mixed ? (mixed[1] as string) : fill
  const own = mixed ? (Number(mixed[2]) / 100) * strength : strength
  return labelOn(barOnCard(color, own, dimmed ? 'dimmed' : 'rest'), dimmed)
}
