export type Kind = 'decision' | 'review' | 'chore'

/** One open item: the Issue it holds and how many Issues wait behind it. */
export type Item = { kind: Kind; issue: number; age: number; behind: number }

/** Reviews go ahead on their own after this many hours. */
export const REVIEW_LIMIT = 24

export const KIND_LABEL: Record<Kind, string> = {
  decision: 'Decision',
  review: 'Review',
  chore: 'Chore',
}

const BASE: readonly Item[] = [
  { kind: 'decision', issue: 2018, age: 71, behind: 9 },
  { kind: 'decision', issue: 1987, age: 30, behind: 4 },
  { kind: 'decision', issue: 2031, age: 5, behind: 2 },
  { kind: 'review', issue: 2024, age: 23, behind: 3 },
  { kind: 'review', issue: 2027, age: 19, behind: 1 },
  { kind: 'review', issue: 2029, age: 14, behind: 0 },
  { kind: 'review', issue: 2030, age: 9, behind: 6 },
  { kind: 'review', issue: 2033, age: 3, behind: 0 },
  { kind: 'review', issue: 2035, age: 1, behind: 2 },
  { kind: 'chore', issue: 1950, age: 52, behind: 0 },
  { kind: 'chore', issue: 1994, age: 26, behind: 1 },
  { kind: 'chore', issue: 2012, age: 8, behind: 0 },
]

/** `extreme`: one decision a week old holds 41 Issues. `calm`: nothing holds up other work. */
export function queueItems(fixture: string | undefined): readonly Item[] {
  const rows =
    fixture === 'extreme'
      ? BASE.map((i) => (i.issue === 2018 ? { ...i, age: 190, behind: 41 } : i))
      : fixture === 'calm'
        ? BASE.map((i) => ({ ...i, behind: 0 }))
        : BASE
  return [...rows].sort((a, b) => b.behind - a.behind || b.age - a.age)
}

export const itemName = (i: Item) => `${KIND_LABEL[i.kind]}, Issue ${i.issue}`

/** Hours until a review goes ahead on its own; null for kinds that wait for a person. */
export const goesAheadIn = (i: Item): number | null =>
  i.kind === 'review' ? REVIEW_LIMIT - i.age : null
