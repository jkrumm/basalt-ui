/**
 * Each CSS enter preset collapses under `prefers-reduced-motion: reduce` (Issue 2529): every timing it
 * reads is a motion token, and `tokens.css` sets each of those to zero inside the reduce query, so the
 * animation ends on its first frame in the end state (`both` fill). The React twins are
 * `src/motion/presets.test.tsx`.
 */
import { describe, expect, test } from 'bun:test'
import { ENTER_ANIMATIONS, generateCss } from './generate'

const generated = generateCss()
const tokens = generated['tokens.css']
const tailwind = generated['tailwind.css']

/** The declarations of the `:root` block inside the reduce query of tokens.css. */
const reduced: Record<string, string> = (() => {
  const at = tokens.indexOf('@media (prefers-reduced-motion: reduce)')
  const body = tokens.slice(at, tokens.indexOf('}\n}', at))
  return Object.fromEntries(
    [...body.matchAll(/(--basalt-[a-z-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!]),
  )
})()

describe('CSS motion presets under reduced motion', () => {
  for (const [name, animation] of Object.entries(ENTER_ANIMATIONS)) {
    test(`animate-enter-${name} collapses: its every timing is a token that is zero under reduce`, () => {
      expect(tailwind).toContain(`--animate-enter-${name}: ${animation};`)
      expect(animation).not.toMatch(/\d+m?s\b/)
      expect(animation.endsWith(' both')).toBe(true)
      const timings = [...animation.matchAll(/var\((--basalt-(?:dur|spring)[a-z-]*)\)/g)].map(
        (m) => m[1]!,
      )
      expect(timings.length).toBeGreaterThan(0)
      for (const v of timings) expect(reduced[v], v).toMatch(/^0ms( linear)?$/)
    })
  }

  test('the stagger utility reads only stagger and slow, both zero under reduce', () => {
    expect(tailwind).toContain('@utility stagger {')
    expect(reduced['--basalt-stagger']).toBe('0ms')
    expect(reduced['--basalt-dur-slow']).toBe('0ms')
  })

  test('every duration, spring and stagger token is in the reduce block; easings are not', () => {
    for (const name of ['dur-fast', 'dur-base', 'dur-slow', 'spring', 'spring-bouncy', 'stagger']) {
      expect(reduced[`--basalt-${name}`], name).toBeDefined()
    }
    expect(reduced['--basalt-ease']).toBeUndefined()
  })

  test('the keyframes exist only when motion is allowed, so reduce attaches no animation at all', () => {
    for (const css of [generated['typography.css'], tailwind]) {
      const media = css.indexOf(
        '@media (prefers-reduced-motion: no-preference) {\n    @keyframes basalt-enter-',
      )
      expect(media).toBeGreaterThan(-1)
      for (const name of Object.keys(ENTER_ANIMATIONS)) {
        expect(css.indexOf(`@keyframes basalt-enter-${name} {`)).toBeGreaterThan(media)
      }
    }
  })

  test('typography.css ships the same keyframes for a page without Tailwind', () => {
    for (const name of Object.keys(ENTER_ANIMATIONS)) {
      expect(generated['typography.css']).toContain(`@keyframes basalt-enter-${name} {`)
      expect(tailwind).toContain(`@keyframes basalt-enter-${name} {`)
    }
  })
})
