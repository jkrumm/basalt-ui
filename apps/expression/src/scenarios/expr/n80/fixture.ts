/**
 * Speech samples for expr-n80: three presets, five models, four samples each (60). A blind listen
 * ranks the five models of one listening set 1 to 5; the first sets of each preset were ranked (40
 * samples). The numbers are seeded and fixed, so every run draws the same page.
 */

export const PRESETS = ['chat', 'briefing', 'podcast'] as const
export type Preset = (typeof PRESETS)[number]

export type Sample = {
  id: string
  preset: Preset
  model: string
  voice: string
  /** Milliseconds to the first audio; null where the sample logged no latency. */
  ttfaMs: number | null
  totalMs: number | null
  durationS: number
  costPerMin: number
  /** The speech-to-text round trip returned the text word for word. */
  verbatim: boolean
  /** The blind rank of its listening set, 1 best; null where it was not ranked. */
  rank: number | null
}

type ModelDef = {
  name: string
  /** US dollars a minute of audio. */
  rate: number
  ttfaMs: number
  /** Synthesis time as a share of the audio's own length. */
  rtf: number
  voices: Record<Preset, string>
  /** Verbatim samples out of four, per preset. */
  verbatim: Record<Preset, number>
}

/** Cheapest first; Orate costs ten times Tern. */
export const MODELS: readonly ModelDef[] = [
  {
    name: 'Tern',
    rate: 0.015,
    ttfaMs: 140,
    rtf: 0.09,
    voices: { chat: 'Wren', briefing: 'Wren', podcast: 'Finch' },
    verbatim: { chat: 3, briefing: 2, podcast: 0 },
  },
  {
    name: 'Voxa',
    rate: 0.024,
    ttfaMs: 190,
    rtf: 0.12,
    voices: { chat: 'Coral', briefing: 'Slate', podcast: 'Coral' },
    verbatim: { chat: 4, briefing: 3, podcast: 2 },
  },
  {
    name: 'Lumen',
    rate: 0.048,
    ttfaMs: 260,
    rtf: 0.16,
    voices: { chat: 'Ash', briefing: 'Marlow', podcast: 'Marlow' },
    verbatim: { chat: 4, briefing: 4, podcast: 4 },
  },
  {
    name: 'Aria 2',
    rate: 0.09,
    ttfaMs: 380,
    rtf: 0.22,
    voices: { chat: 'Juniper', briefing: 'Juniper', podcast: 'Sage' },
    verbatim: { chat: 4, briefing: 4, podcast: 3 },
  },
  {
    name: 'Orate',
    rate: 0.15,
    ttfaMs: 620,
    rtf: 0.3,
    voices: { chat: 'Reed', briefing: 'Reed', podcast: 'Onyx' },
    verbatim: { chat: 4, briefing: 4, podcast: 4 },
  },
]

/** Seconds of audio of the four texts of each preset. */
const DURATIONS: Record<Preset, readonly number[]> = {
  chat: [6.2, 9.1, 11.8, 7.4],
  briefing: [32, 41, 48, 38],
  podcast: [92, 118, 131, 104],
}

/** Billing per character: a preset that speaks denser costs a little more a minute. */
const PRESET_COST: Record<Preset, number> = { chat: 1, briefing: 1.04, podcast: 0.96 }

/**
 * Blind ranks per preset: one row per ranked listening set, one rank per model in MODELS order.
 * Briefing ends with Lumen and Orate on the same mean rank.
 */
const RANKS: Record<Preset, readonly (readonly number[])[]> = {
  chat: [
    [5, 1, 4, 3, 2],
    [5, 1, 3, 2, 4],
    [5, 2, 3, 4, 1],
  ],
  briefing: [
    [5, 4, 1, 2, 3],
    [5, 3, 2, 4, 1],
    [4, 5, 2, 3, 1],
  ],
  podcast: [
    [5, 4, 3, 2, 1],
    [4, 5, 2, 3, 1],
  ],
}

/** Samples that logged no latency: preset, model and set. */
const NO_LATENCY = new Set(['chat-Voxa-1', 'briefing-Lumen-3', 'podcast-Tern-0', 'podcast-Orate-2'])

function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function build(): Sample[] {
  const rand = seeded(80)
  const out: Sample[] = []
  for (const preset of PRESETS) {
    for (let set = 0; set < 4; set += 1) {
      MODELS.forEach((m, mi) => {
        const duration = (DURATIONS[preset][set] ?? 0) * (0.97 + rand() * 0.06)
        const ttfa = m.ttfaMs * (0.85 + rand() * 0.3)
        const total = ttfa + duration * 1000 * m.rtf * (0.9 + rand() * 0.2)
        const key = preset + '-' + m.name + '-' + set
        const timed = !NO_LATENCY.has(key)
        out.push({
          id: key,
          preset,
          model: m.name,
          voice: m.voices[preset],
          ttfaMs: timed ? Math.round(ttfa) : null,
          totalMs: timed ? Math.round(total) : null,
          durationS: Math.round(duration * 10) / 10,
          costPerMin:
            Math.round(m.rate * PRESET_COST[preset] * (0.98 + rand() * 0.04) * 10000) / 10000,
          verbatim: set < m.verbatim[preset],
          rank: RANKS[preset][set]?.[mi] ?? null,
        })
      })
    }
  }
  return out
}

const SAMPLES: readonly Sample[] = build()

/** One model in one preset, over its four samples. */
export type Candidate = {
  id: string
  preset: Preset
  model: string
  voice: string
  /** Mean blind rank, 1 best; null where no sample of it was ranked. */
  meanRank: number | null
  listens: number
  ttfaMs: number | null
  totalMs: number | null
  costPerMin: number
  verbatimPct: number
}

const present = (xs: readonly (number | null)[]): number[] =>
  xs.filter((x): x is number => x !== null)
const round = (x: number, digits: number): number => Math.round(x * 10 ** digits) / 10 ** digits
const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length
const median = (xs: readonly number[]): number | null => {
  if (xs.length === 0) return null
  const s = xs.toSorted((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? (s[mid] ?? null) : Math.round(((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2)
}

/** The fixture variants a URL names: the default, a podcast nobody ranked, a model that answers slowly. */
export function samplesFor(fixture: string | undefined): readonly Sample[] {
  if (fixture === 'unranked')
    return SAMPLES.map((s) => (s.preset === 'podcast' ? { ...s, rank: null } : s))
  if (fixture === 'slow')
    return SAMPLES.map((s) =>
      s.model === 'Orate' && s.ttfaMs !== null && s.totalMs !== null
        ? { ...s, ttfaMs: s.ttfaMs * 12, totalMs: s.totalMs + s.ttfaMs * 11 }
        : s,
    )
  return SAMPLES
}

/** Every model in every preset, in preset order and best rank first within a preset. */
export function candidatesOf(samples: readonly Sample[]): Candidate[] {
  const out: Candidate[] = []
  for (const preset of PRESETS) {
    const rows = MODELS.flatMap((m): Candidate[] => {
      const own = samples.filter((s) => s.preset === preset && s.model === m.name)
      const first = own[0]
      if (first === undefined) return []
      const ranks = present(own.map((s) => s.rank))
      return [
        {
          id: preset + '-' + m.name,
          preset,
          model: m.name,
          voice: first.voice,
          meanRank: ranks.length === 0 ? null : round(mean(ranks), 2),
          listens: ranks.length,
          ttfaMs: median(present(own.map((s) => s.ttfaMs))),
          totalMs: median(present(own.map((s) => s.totalMs))),
          costPerMin: round(mean(own.map((s) => s.costPerMin)), 4),
          verbatimPct: round((own.filter((s) => s.verbatim).length / own.length) * 100, 0),
        },
      ]
    })
    out.push(
      ...rows.toSorted(
        (a, b) =>
          (a.meanRank ?? Infinity) - (b.meanRank ?? Infinity) || a.costPerMin - b.costPerMin,
      ),
    )
  }
  return out
}

/** The candidates a preset's blind listen puts first: one, or every one on a tied mean rank. */
export function winnersOf(candidates: readonly Candidate[], preset: Preset): Candidate[] {
  const own = candidates.filter((c) => c.preset === preset && c.meanRank !== null)
  const best = Math.min(...own.map((c) => c.meanRank ?? Infinity))
  return own.filter((c) => c.meanRank === best).toSorted((a, b) => a.costPerMin - b.costPerMin)
}
