/**
 * The pseudo-locale (quality-contract section 4): the English catalog with every letter accented,
 * 40 percent longer and wrapped in `[...]`, so a hard-coded string shows up unbracketed and a box
 * that fits only the English length overflows. Internal to the matrix, not an export.
 */
import { en } from '../../../src/core/messages'
import type { BasaltMessages } from '../../../src/core/messages'

const ACCENTED: Record<string, string> = {
  a: 'à',
  b: 'ƀ',
  c: 'ç',
  d: 'ð',
  e: 'é',
  f: 'ƒ',
  g: 'ĝ',
  h: 'ĥ',
  i: 'î',
  j: 'ĵ',
  k: 'ķ',
  l: 'ļ',
  m: 'ɱ',
  n: 'ñ',
  o: 'ô',
  p: 'þ',
  q: 'ǫ',
  r: 'ŕ',
  s: 'š',
  t: 'ţ',
  u: 'û',
  v: 'ṽ',
  w: 'ŵ',
  x: 'ẋ',
  y: 'ý',
  z: 'ž',
  A: 'À',
  B: 'Ɓ',
  C: 'Ç',
  D: 'Ð',
  E: 'É',
  F: 'Ƒ',
  G: 'Ĝ',
  H: 'Ĥ',
  I: 'Î',
  J: 'Ĵ',
  K: 'Ķ',
  L: 'Ļ',
  M: 'Ṁ',
  N: 'Ñ',
  O: 'Ô',
  P: 'Þ',
  Q: 'Ǫ',
  R: 'Ŕ',
  S: 'Š',
  T: 'Ţ',
  U: 'Û',
  V: 'Ṽ',
  W: 'Ŵ',
  X: 'Ẋ',
  Y: 'Ý',
  Z: 'Ž',
}

export interface PseudoOptions {
  /** Added length as a fraction of the original. Default 0.4. */
  expand?: number
}

/** One string, accented and padded with a trailing run of `~` to the target length, in brackets. */
export function pseudo(text: string, expand = 0.4): string {
  if (text === '') return text
  const accented = Array.from(text, (ch) => ACCENTED[ch] ?? ch).join('')
  const extra = Math.ceil(text.length * expand)
  return `[${accented}${'~'.repeat(extra)}]`
}

/** The whole catalog, pseudo-localised; function messages are wrapped so their output is too. */
export function pseudoMessages(options: PseudoOptions = {}): BasaltMessages {
  const expand = options.expand ?? 0.4
  const out: Record<string, unknown> = {}
  for (const [key, message] of Object.entries(en)) {
    out[key] =
      typeof message === 'function'
        ? (f: unknown, ...args: unknown[]) =>
            pseudo((message as (...a: unknown[]) => string)(f, ...args), expand)
        : pseudo(message as string, expand)
  }
  return out as unknown as BasaltMessages
}
