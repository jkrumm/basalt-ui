// Pure comparison of an oracle measurement (Mantine) against an after measurement (codemod output
// on the v3 theme). Geometry is compared on the line-height-pinned pass, font-size on the natural one,
// and the line-height and radius differences are handed to `valueshifts`.
import { decode } from './measure.ts'
import type { Measured } from './measure.ts'

/** Sub-pixel noise between two Chrome builds drawing the same face; a real shift is a whole pixel or more. */
const EPSILON = 0.25

export type Mismatch = { sig: number; width: number; reason: string }
export type Shift = {
  kind: 'line-height' | 'radius'
  from: number
  to: number
  sig: number
  width: number
}

export function compareGeometry(
  oracle: Measured,
  pinned: Measured,
  widths: readonly number[],
): Mismatch[] {
  const out: Mismatch[] = []
  oracle.forEach((bySig, wi) =>
    bySig.forEach((flat, sig) => {
      const width = widths[wi]!
      const before = decode(flat)
      const after = decode(pinned[wi]?.[sig] ?? [])
      if (before.length !== after.length) {
        out.push({ sig, width, reason: `${before.length} nodes before, ${after.length} after` })
        return
      }
      before.forEach((b, ni) => {
        const a = after[ni]!
        for (const key of ['x', 'y', 'w', 'h'] as const) {
          if (Math.abs(a[key] - b[key]) > EPSILON)
            out.push({ sig, width, reason: `node ${ni} ${key}: ${b[key]} -> ${a[key]}` })
        }
      })
    }),
  )
  return out
}

export function compareFontSize(
  oracle: Measured,
  natural: Measured,
  widths: readonly number[],
): Mismatch[] {
  const out: Mismatch[] = []
  oracle.forEach((bySig, wi) =>
    bySig.forEach((flat, sig) => {
      const before = decode(flat)
      const after = decode(natural[wi]?.[sig] ?? [])
      before.forEach((b, ni) => {
        const a = after[ni]
        if (a && Math.abs(a.fs - b.fs) > 0.01)
          out.push({ sig, width: widths[wi]!, reason: `node ${ni} font-size: ${b.fs} -> ${a.fs}` })
      })
    }),
  )
  return out
}

/** Every line-height and radius that differs between the oracle and the natural after pass. */
export function observedShifts(
  oracle: Measured,
  natural: Measured,
  widths: readonly number[],
): Shift[] {
  const out: Shift[] = []
  oracle.forEach((bySig, wi) =>
    bySig.forEach((flat, sig) => {
      const after = decode(natural[wi]?.[sig] ?? [])
      decode(flat).forEach((b, ni) => {
        const a = after[ni]
        if (!a) return
        const width = widths[wi]!
        if (Math.abs(a.lh - b.lh) > 0.01)
          out.push({ kind: 'line-height', from: b.lh, to: a.lh, sig, width })
        if (Math.abs(a.br - b.br) > 0.01)
          out.push({ kind: 'radius', from: b.br, to: a.br, sig, width })
      })
    }),
  )
  return out
}
