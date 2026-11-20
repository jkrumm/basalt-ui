/**
 * The motion scale holds one value per role across its three forms: the CSS rows read `motion.ts`,
 * and the CSS springs are the curves `motion`'s own generator prints for the JS springs.
 */
import { describe, expect, test } from 'bun:test'
import { spring } from 'motion'
import {
  MOTION_DURATION,
  MOTION_DURATION_MS,
  MOTION_EASE_ENTER,
  MOTION_EASE_EXIT,
  MOTION_EASE_STANDARD,
  MOTION_SPRING,
  MOTION_SPRING_CSS,
  MOTION_STAGGER,
  cubicBezier,
  staggerDelay,
} from './motion'
import { tokenByName } from './table'

const css = (name: string): string => String(tokenByName(name).value({} as never))

describe('motion scale', () => {
  test('each CSS duration is the JS duration in milliseconds', () => {
    for (const step of ['fast', 'base', 'slow'] as const) {
      expect(css(`dur-${step}`)).toBe(`${MOTION_DURATION_MS[step]}ms`)
      expect(MOTION_DURATION[step] * 1000).toBe(MOTION_DURATION_MS[step])
    }
    expect(MOTION_DURATION).toEqual({ fast: 0.15, base: 0.25, slow: 0.4 })
  })

  test('each CSS easing is the JS bezier', () => {
    expect(css('ease')).toBe(cubicBezier(MOTION_EASE_STANDARD))
    expect(css('ease-enter')).toBe(cubicBezier(MOTION_EASE_ENTER))
    expect(css('ease-exit')).toBe(cubicBezier(MOTION_EASE_EXIT))
    expect(css('ease')).toBe('cubic-bezier(0.4, 0, 0.2, 1)')
  })

  test("each CSS spring is motion's own curve for the JS spring", () => {
    for (const name of ['standard', 'bouncy'] as const) {
      const { visualDuration, bounce } = MOTION_SPRING[name]
      expect(spring({ keyframes: [0, 1], visualDuration, bounce }).toString()).toBe(
        MOTION_SPRING_CSS[name],
      )
    }
    expect(css('spring')).toBe(MOTION_SPRING_CSS.standard)
    expect(css('spring-bouncy')).toBe(MOTION_SPRING_CSS.bouncy)
  })

  test('the stagger step is 30 ms and the delay stops at the slow step', () => {
    expect(css('stagger')).toBe('30ms')
    expect(MOTION_STAGGER).toBe(0.03)
    expect(staggerDelay(0)).toBe(0)
    expect(staggerDelay(3)).toBe(0.09)
    expect(staggerDelay(13)).toBe(0.39)
    expect(staggerDelay(14)).toBe(MOTION_DURATION.slow)
    expect(staggerDelay(500)).toBe(MOTION_DURATION.slow)
    expect(staggerDelay(-2)).toBe(0)
  })
})
