/**
 * headingSlug + readingTime — small, pure, zero-dep utils for the content surface.
 *
 * `headingSlug` follows the github-slugger algorithm (lowercase, strip punctuation, spaces → `-`)
 * so headings authored in `<Prose>`, markdown, or MDX land on the SAME anchor ids GitHub itself
 * would produce. `SlugTracker` dedupes repeated headings within one document the same way
 * (`-1`, `-2`, … suffixes on the second/third occurrence of an identical slug).
 */

/** Anything that is not a letter, number, mark, space, or hyphen is stripped. */
const PUNCTUATION_RE = /[^\p{L}\p{M}\p{N}\- ]+/gu
const WHITESPACE_RE = /\s+/g
const EDGE_HYPHENS_RE = /^-+|-+$/g
const REPEAT_HYPHENS_RE = /-+/g

/** Slugify a heading string (github-slugger algorithm — lowercase, punctuation-stripped, `-`-joined). */
export function headingSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(PUNCTUATION_RE, '')
    .replace(WHITESPACE_RE, '-')
    .replace(REPEAT_HYPHENS_RE, '-')
    .replace(EDGE_HYPHENS_RE, '')
}

/**
 * Dedupes repeated slugs within one document — the second occurrence of a slug gets `-1`, the
 * third `-2`, and so on (matches github-slugger's own collision behavior). Create one instance
 * per document/render pass; it carries no global state.
 */
export class SlugTracker {
  private readonly counts = new Map<string, number>()

  /** Slugify `text` and dedupe against every slug seen so far on this instance. */
  slug(text: string): string {
    const base = headingSlug(text)
    const seen = this.counts.get(base) ?? 0
    this.counts.set(base, seen + 1)
    return seen === 0 ? base : `${base}-${seen}`
  }
}

/** The distilled reading-time estimate for a body of text. */
export type ReadingTime = {
  readonly minutes: number
  readonly words: number
}

const WORDS_PER_MINUTE = 225

/** Estimate reading time at 225 wpm, rounded up to the nearest whole minute. */
export function readingTime(text: string): ReadingTime {
  const words = text.trim().split(WHITESPACE_RE).filter(Boolean).length
  const minutes = Math.ceil(words / WORDS_PER_MINUTE)
  return { minutes, words }
}
