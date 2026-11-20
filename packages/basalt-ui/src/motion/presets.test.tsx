/**
 * Each preset collapses under reduced motion (Issue 2529 acceptance): no movement, no scale, no fade, no
 * delay. The pure form is checked per preset; the hook is checked through `MotionConfig`, which is
 * how an app or the OS (motion's `reducedMotion="user"` default) reaches it.
 */
import { describe, expect, test } from 'bun:test'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MotionConfig } from 'motion/react'
import { MOTION_DURATION, MOTION_EASE_ENTER, MOTION_SPRING, staggerDelay } from '../tokens/motion'
import { motionPreset, useMotionPreset } from './index'
import type { MotionPresetProps } from './index'

const PRESETS = ['overlay', 'item', 'card'] as const

function expectCollapsed(props: MotionPresetProps): void {
  expect(props.initial).toBe(false)
  expect(props.animate).toEqual({ opacity: 1, y: 0, scale: 1 })
  expect(props.transition).toEqual({ duration: 0 })
  expect(props.exit.transition).toEqual({ duration: 0 })
  expect(props.exit.y).toBeUndefined()
  expect(props.exit.scale).toBeUndefined()
}

const wrapper =
  (reducedMotion: 'always' | 'never') =>
  ({ children }: { children: ReactNode }) => (
    <MotionConfig reducedMotion={reducedMotion}>{children}</MotionConfig>
  )

describe('motion presets', () => {
  for (const name of PRESETS) {
    test(`${name} collapses under reduced motion, even with an index`, () => {
      expectCollapsed(motionPreset(name, { reduced: true }))
      expectCollapsed(motionPreset(name, { reduced: true, index: 7 }))
    })

    test(`${name} collapses through useMotionPreset when motion is reduced`, () => {
      const { result } = renderHook(() => useMotionPreset(name, { index: 3 }), {
        wrapper: wrapper('always'),
      })
      expectCollapsed(result.current)
    })

    test(`${name} animates through useMotionPreset when motion is allowed`, () => {
      const { result } = renderHook(() => useMotionPreset(name), { wrapper: wrapper('never') })
      expect(result.current).toEqual(motionPreset(name))
      expect(result.current.initial).not.toBe(false)
    })
  }

  test('overlay enters on the fast step and exits scaled', () => {
    const p = motionPreset('overlay')
    expect(p.initial).toEqual({ opacity: 0, y: 0, scale: 0.96 })
    expect(p.transition).toEqual({
      duration: MOTION_DURATION.fast,
      ease: MOTION_EASE_ENTER,
      delay: 0,
    })
    expect(p.exit).toMatchObject({ opacity: 0, scale: 0.96 })
  })

  test('item rises 4 px on the base step and waits its stagger', () => {
    const p = motionPreset('item', { index: 4 })
    expect(p.initial).toEqual({ opacity: 0, y: 4, scale: 1 })
    expect(p.transition).toEqual({
      duration: MOTION_DURATION.base,
      ease: MOTION_EASE_ENTER,
      delay: staggerDelay(4),
    })
  })

  test('card lands on the standard spring and every exit fades on the fast step', () => {
    const p = motionPreset('card')
    expect(p.transition).toEqual({ ...MOTION_SPRING.standard, delay: 0 })
    for (const name of PRESETS) {
      expect(motionPreset(name).exit.transition?.duration).toBe(MOTION_DURATION.fast)
    }
  })
})
