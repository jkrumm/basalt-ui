/** The shapes scripts/measure.ts writes and scripts/matrix.ts reads. */
import type { Mode } from '../src/parts/registry'

/** The four pictures of a part: width and scheme. */
export const VIEWS = ['1440-light', '1440-dark', '390-light', '390-dark'] as const
export type View = (typeof VIEWS)[number]

export type ModeResult = {
  /** Every island on the page hydrated within the wait (true on a page with no island). */
  hydrated: boolean
  /** `<script` tags in the HTML as built, and in the document once it settled. */
  htmlScriptTags: number
  scriptTags: number
  /** Gzip bytes of every script the page ran: the files plus the inline scripts. */
  js: number
  jsInline: number
  /** Gzip bytes of every stylesheet plus the inline styles. */
  css: number
  cls: number
  lcp: number
  errors: string[]
  hydrationErrors: number
}

export type Picture = {
  /** Pixels that differ between the static page and the client:only page. */
  changed: number
  /** Their share of the section. */
  ratio: number
  /** The measured section, width and height, on each page. */
  static: [number, number]
  only: [number, number]
}

export type PartResult = {
  id: string
  ssr: 'ok' | 'partial' | 'fail'
  ssrError: string
  /** Per mode; `further` is the gzip bytes of the files the page loads beyond the baseline island's. */
  modes: Record<Mode, ModeResult & { further: number }>
  views: Record<View, Picture>
  /** The static section's text equals the client:only section's at every view. */
  textMatch: boolean
}

export type FamilyResult = { family: string; parts: number; modes: Record<Mode, ModeResult> }

export type Results = {
  browser: string
  seconds: number
  baseline: Record<Mode, ModeResult>
  parts: PartResult[]
  families: FamilyResult[]
  index: ModeResult
}
