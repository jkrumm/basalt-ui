/**
 * The box of a bottom sheet over its open and close transitions, one sample per painted frame. A
 * sheet that opens at its content's height keeps that height from its first frame to its last:
 * only its `top` moves. Run these with `reducedMotion: 'no-preference'`, so the transition plays.
 */
import type { LayoutPage } from './harness'

export type SheetFrame = { t: number; top: number; height: number; starting: boolean }

/**
 * Samples `selector` on every animation frame while `act` runs and for `afterMs` more, then
 * returns the frames in which it existed. The loop starts before `act`, so the frame the sheet
 * mounts in is the first sample.
 */
export async function recordFrames(
  page: LayoutPage,
  selector: string,
  act: () => Promise<void>,
  afterMs = 1100,
): Promise<SheetFrame[]> {
  await page.raw.evaluate((sel) => {
    const frames: SheetFrame[] = []
    const w = window as unknown as { __sheetFrames: SheetFrame[]; __sheetStop: boolean }
    w.__sheetFrames = frames
    w.__sheetStop = false
    const t0 = performance.now()
    const tick = (): void => {
      const el = document.querySelector<HTMLElement>(sel)
      if (el !== null) {
        const r = el.getBoundingClientRect()
        frames.push({
          t: Math.round(performance.now() - t0),
          top: r.top,
          height: r.height,
          starting: el.hasAttribute('data-starting-style'),
        })
      }
      if (!w.__sheetStop) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, selector)
  await act()
  await page.raw.waitForTimeout(afterMs)
  return page.raw.evaluate(() => {
    const w = window as unknown as { __sheetFrames: SheetFrame[]; __sheetStop: boolean }
    w.__sheetStop = true
    return w.__sheetFrames
  })
}

/** The frames' heights: every one the same, to half a pixel. */
export function heightSpread(frames: readonly SheetFrame[]): number {
  const heights = frames.map((f) => f.height)
  return Math.max(...heights) - Math.min(...heights)
}

/** Whether `top` only ever falls (an opening sheet rises), to a pixel of settling jitter. */
export function onlyRises(frames: readonly SheetFrame[]): boolean {
  return frames.every((f, i) => i === 0 || f.top <= frames[i - 1]!.top + 1)
}

/** Whether `top` only ever grows (a closing sheet sinks), to a pixel of settling jitter. */
export function onlySinks(frames: readonly SheetFrame[]): boolean {
  return frames.every((f, i) => i === 0 || f.top >= frames[i - 1]!.top - 1)
}
