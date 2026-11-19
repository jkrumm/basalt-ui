import { forecastsFor } from './fixture'
import type { Forecast, Night, Site, Slot } from './fixture'

/** A slot is clear under this share of covered sky, in %. */
export const CLEAR = 30
/** A night is worth the drive from this many usable hours. */
export const WORTH = 4
/** Clear dark hours that make a moonlit night worth naming. */
const MOONLIT_CLEAR = 4

export type Cell = {
  id: string
  night: Night
  site: Site
  slots: readonly Slot[]
  /** False when the site has no forecast for the night. */
  forecast: boolean
  /** Hours dark, clear and moon down. */
  usable: number
  /** Runs of usable slots, as hour spans. */
  spells: readonly (readonly [number, number])[]
  /** Clear and dark, but the moon is up for all or most of it. */
  moonlit: boolean
}

const isUsable = (s: Slot): boolean => s.total <= CLEAR && !s.moonUp

function spellsOf(slots: readonly Slot[]): [number, number][] {
  const out: [number, number][] = []
  for (const s of slots) {
    if (!isUsable(s)) continue
    const last = out.at(-1)
    if (last !== undefined && last[1] === s.at) last[1] = s.at + 0.5
    else out.push([s.at, s.at + 0.5])
  }
  return out
}

export function cellsOf(fixture: string | undefined): Cell[] {
  return forecastsFor(fixture).map((f: Forecast) => {
    const spells = spellsOf(f.slots)
    const usable = f.slots.filter(isUsable).length / 2
    const clear = f.slots.filter((s) => s.total <= CLEAR).length / 2
    return {
      id: `${f.night.id}:${f.site.id}`,
      night: f.night,
      site: f.site,
      slots: f.slots,
      forecast: f.slots.length > 0,
      usable,
      spells,
      moonlit: clear >= MOONLIT_CLEAR && usable < 1,
    }
  })
}

/** More usable hours first, then the shorter drive. */
const better = (a: Cell, b: Cell): Cell =>
  a.usable > b.usable || (a.usable === b.usable && a.site.drive <= b.site.drive) ? a : b

/** The cell with the most usable hours, the nearest site on a tie; null with no forecast at all. */
export function topCell(cells: readonly Cell[]): Cell | null {
  return cells
    .filter((c) => c.forecast)
    .reduce<Cell | null>((top, c) => (top === null ? c : better(top, c)), null)
}

export const longest = (
  spells: readonly (readonly [number, number])[],
): readonly [number, number] | null =>
  spells.reduce<readonly [number, number] | null>(
    (best, s) => (best === null || s[1] - s[0] > best[1] - best[0] ? s : best),
    null,
  )
