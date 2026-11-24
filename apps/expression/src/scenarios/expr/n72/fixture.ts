/** Spam filter fixture: a seeded log of form submissions, each judged by a first classifier and mostly by a second one. */

export type Verdict = 'legit' | 'spam' | 'marketing'

/** The case a dot or a row stands for, in the order the focus steps through them. */
export type Kind = 'delivered' | 'sure' | 'other' | 'agree'

export type Submission = {
  id: string
  n: number
  at: number
  form: string
  first: Verdict
  firstConf: number
  second: Verdict | null
  secondConf: number | null
  secondFailed: boolean
  held: boolean
  kind: Kind
  firstText: string
  secondText: string
  pair: string
  outcome: 'Held' | 'Delivered'
}

/** A verdict at or over this confidence is sure. */
export const SURE = 80

export const VERDICT_WORD: Record<Verdict, string> = {
  legit: 'Legit',
  spam: 'Spam',
  marketing: 'Marketing',
}

const FORMS = ['Contact', 'Quote request', 'Newsletter', 'Support'] as const
const COUNT = 250
const DAY = 86_400_000
const START = Date.UTC(2026, 10, 3)

type Spec = {
  first: Verdict
  fc: number
  second: Verdict
  sc: number
  form: string
  held?: boolean
}

/** The twelve disagreements: four where both are sure, one spam message delivered, seven more held or passed. */
const SPECS: readonly Spec[] = [
  { first: 'legit', fc: 92, second: 'marketing', sc: 84, form: 'Newsletter' },
  { first: 'marketing', fc: 88, second: 'legit', sc: 91, form: 'Contact' },
  { first: 'spam', fc: 95, second: 'marketing', sc: 81, form: 'Support' },
  { first: 'legit', fc: 87, second: 'spam', sc: 83, form: 'Quote request' },
  { first: 'spam', fc: 91, second: 'legit', sc: 62, form: 'Contact', held: false },
  { first: 'legit', fc: 71, second: 'spam', sc: 88, form: 'Support' },
  { first: 'marketing', fc: 64, second: 'legit', sc: 83, form: 'Newsletter' },
  { first: 'legit', fc: 58, second: 'marketing', sc: 77, form: 'Contact' },
  { first: 'spam', fc: 76, second: 'legit', sc: 90, form: 'Quote request' },
  { first: 'marketing', fc: 82, second: 'spam', sc: 55, form: 'Newsletter' },
  { first: 'legit', fc: 66, second: 'marketing', sc: 79, form: 'Support' },
  { first: 'marketing', fc: 59, second: 'legit', sc: 94, form: 'Quote request' },
]

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v: number): number => Math.min(99, Math.max(50, v))

function kindOf(
  s: Pick<Submission, 'first' | 'second' | 'firstConf' | 'secondConf' | 'held'>,
): Kind {
  if (!s.held && (s.first === 'spam' || s.second === 'spam')) return 'delivered'
  if (s.second === null || s.secondConf === null || s.second === s.first) return 'agree'
  return s.firstConf >= SURE && s.secondConf >= SURE ? 'sure' : 'other'
}

type Draft = Omit<Submission, 'kind' | 'firstText' | 'secondText' | 'pair' | 'outcome'>

function finish(d: Draft): Submission {
  return {
    ...d,
    kind: kindOf(d),
    firstText: `${VERDICT_WORD[d.first]} ${d.firstConf} %`,
    secondText: d.second === null ? '–' : `${VERDICT_WORD[d.second]} ${d.secondConf} %`,
    pair:
      d.second === null
        ? `${VERDICT_WORD[d.first]} ${d.firstConf} / –`
        : `${VERDICT_WORD[d.first]} ${d.firstConf} / ${d.second} ${d.secondConf}`,
    outcome: d.held ? 'Held' : 'Delivered',
  }
}

function build(name: string | undefined): readonly Submission[] {
  const rand = mulberry32(72)
  const conf = (): number => clamp(99 - Math.floor(Math.pow(rand(), 2.4) * 49))
  const specs =
    name === 'clean'
      ? SPECS.slice(4).map((s, i) => (i === 0 ? { ...s, held: undefined } : s))
      : SPECS
  const drafts: Draft[] = Array.from({ length: COUNT }, (_, i) => {
    const r = rand()
    const first: Verdict = r < 0.72 ? 'legit' : r < 0.86 ? 'marketing' : 'spam'
    const firstConf = conf()
    const missing = i % 10 === 1
    const second = missing ? null : first
    const secondConf = missing ? null : clamp(firstConf + Math.round((rand() - 0.5) * 24))
    return {
      id: `#${4200 + i}`,
      n: i,
      at: START + Math.floor(((i + rand()) / COUNT) * 14 * DAY),
      form: FORMS[Math.floor(rand() * FORMS.length)] ?? 'Contact',
      first,
      firstConf,
      second,
      secondConf,
      secondFailed: i === 11,
      held: first === 'spam',
    }
  })
  const offset = name === 'clean' ? 4 : 0
  specs.forEach((s, k) => {
    const slot = drafts[13 + 20 * (k + offset)]
    if (slot === undefined) return
    drafts[13 + 20 * (k + offset)] = {
      ...slot,
      form: s.form,
      first: s.first,
      firstConf: s.fc,
      second: s.second,
      secondConf: s.sc,
      held: s.held ?? (s.first === 'spam' || s.second === 'spam'),
    }
  })
  if (name === 'wave') {
    for (let i = 200; i < 230; i++) {
      const slot = drafts[i]
      if (slot === undefined || i % 20 === 13) continue
      drafts[i] = {
        ...slot,
        form: 'Support',
        first: 'spam',
        firstConf: 90 + (i % 10),
        second: 'spam',
        secondConf: 85 + ((i * 3) % 15),
        held: i >= 214,
      }
    }
  }
  return drafts.map(finish)
}

const cache = new Map<string, readonly Submission[]>()

/** The log of a `?fixture=` name: `clean` has no sure disagreement and nothing delivered, `wave` a spam burst the filter let through. */
export function fixtureRows(name: string | undefined): readonly Submission[] {
  const key = name === 'clean' || name === 'wave' ? name : 'default'
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const rows = build(key)
  cache.set(key, rows)
  return rows
}

const ORDER: Record<Kind, number> = { delivered: 0, sure: 1, other: 2, agree: 3 }

// cycle-expression-15: a cartesian host keys its focus by x, so dots that share a confidence cannot be stepped to one by one; each dot gets its own x, a millionth of a point apart.
export const xOf = (s: Submission): number => s.firstConf + s.n / 1_000_000

/** The submissions the second classifier judged, left to right: the order the chart's focus steps in. */
export function judgedRows(rows: readonly Submission[]): readonly Submission[] {
  return rows.filter((s) => s.second !== null).toSorted((a, b) => xOf(a) - xOf(b))
}

/** The messages worth a look: spam delivered, then every disagreement. */
export function flaggedRows(rows: readonly Submission[]): readonly Submission[] {
  return rows
    .filter((s) => s.kind !== 'agree')
    .toSorted((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.at - b.at)
}

export type Stats = {
  surePairs: number
  sureSplit: number
  unsurePairs: number
  unsureSplit: number
  delivered: number
  noSecond: number
  failed: number
}

export function statsOf(rows: readonly Submission[]): Stats {
  const judged = rows.filter((s) => s.second !== null && s.secondConf !== null)
  const sure = judged.filter((s) => s.firstConf >= SURE && (s.secondConf ?? 0) >= SURE)
  const split = (list: readonly Submission[]): number =>
    list.filter((s) => s.second !== s.first).length
  return {
    surePairs: sure.length,
    sureSplit: split(sure),
    unsurePairs: judged.length - sure.length,
    unsureSplit: split(judged) - split(sure),
    delivered: rows.filter((s) => s.kind === 'delivered').length,
    noSecond: rows.length - judged.length,
    failed: rows.filter((s) => s.secondFailed).length,
  }
}
