/**
 * OKLab / OKLCH and colour-vision-deficiency simulation — Mantine-free, dependency-free.
 *
 * OKLab is Ottosson's definition (https://bottosson.github.io/posts/oklab/); the CVD matrices are
 * Machado, Oliveira & Fernandes (2009), "A Physiologically-based Model for Simulation of Color
 * Vision Deficiency", severity 1.0, applied to LINEAR sRGB. `deltaEOk` is the Euclidean OKLab
 * distance ×100, the unit the series-palette guard's thresholds are written in.
 */

export type Oklab = { L: number; a: number; b: number }
export type Oklch = { L: number; C: number; h: number }
export type CvdKind = 'protan' | 'deutan'

type Rgb = readonly [number, number, number]
type Matrix = readonly [Rgb, Rgb, Rgb]

const MACHADO: Record<CvdKind, Matrix> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
}

function hexToLinear(hex: string): Rgb {
  const raw = hex.replace('#', '')
  const full = raw.length === 3 ? [...raw].map((c) => c + c).join('') : raw.slice(0, 6)
  const channel = (i: number) => {
    const c = Number.parseInt(full.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return [channel(0), channel(2), channel(4)]
}

function linearToHex([r, g, b]: Rgb): string {
  const encode = (c: number) => {
    const v = Math.min(1, Math.max(0, c))
    const s = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055
    return Math.round(s * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${encode(r)}${encode(g)}${encode(b)}`
}

function linearToOklab([r, g, b]: Rgb): Oklab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}

export function hexToOklab(hex: string): Oklab {
  return linearToOklab(hexToLinear(hex))
}

export function hexToOklch(hex: string): Oklch {
  const { L, a, b } = hexToOklab(hex)
  const h = (Math.atan2(b, a) * 180) / Math.PI
  return { L, C: Math.hypot(a, b), h: h < 0 ? h + 360 : h }
}

/** Euclidean OKLab distance ×100 between two hex colours. */
export function deltaEOk(hexA: string, hexB: string): number {
  const x = hexToOklab(hexA)
  const y = hexToOklab(hexB)
  return 100 * Math.hypot(x.L - y.L, x.a - y.a, x.b - y.b)
}

/** What a dichromat sees for `hex`, still in clamped linear RGB (Machado 2009, severity 1.0). */
function simulateCvdLinear(hex: string, kind: CvdKind): Rgb {
  const [r, g, b] = hexToLinear(hex)
  const [row0, row1, row2] = MACHADO[kind]
  const mix = (row: Rgb) => Math.min(1, Math.max(0, row[0] * r + row[1] * g + row[2] * b))
  return [mix(row0), mix(row1), mix(row2)]
}

/** The hex a dichromat sees for `hex` — for display and tests; the checks stay in linear RGB. */
export function simulateCvd(hex: string, kind: CvdKind): string {
  return linearToHex(simulateCvdLinear(hex, kind))
}

/** OKLab ΔE×100 between two colours as a dichromat sees them — no 8-bit round trip. */
export function deltaEOkCvd(hexA: string, hexB: string, kind: CvdKind): number {
  const x = linearToOklab(simulateCvdLinear(hexA, kind))
  const y = linearToOklab(simulateCvdLinear(hexB, kind))
  return 100 * Math.hypot(x.L - y.L, x.a - y.a, x.b - y.b)
}
