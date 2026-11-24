import { describe, expect, test } from 'bun:test'

import { countFacts } from './facts'
import type { FactCount, FactFile } from './facts'

/** Three page files. The expectation below was captured from the original pipeline run on these same files. */
const PAGE: FactFile[] = [
  {
    path: 'a.tsx',
    text: 'import { Page } from \'basalt-ui/ui\'\n// a comment that mentions bananas and must not count\n/* block comment with shipped words */\nconst AHEAD = \'Ahead\'\nconst ETA = `Shipped in ${weeks} weeks`\nconst BUDGET = \'Budget left\'\n\nexport function Overview({ a, b, rows }: Props) {\n  return (\n    <Page title="Overview" className="overview-page" data-testid="overview">\n      <Figure label="Median latency" value={a.latency} unit="ms" />\n      <p>Median latency over the last 3 h.</p>\n      <span>{AHEAD}, median is steady</span>\n      <span>{AHEAD} for {rows.length} rows</span>\n      <Note>Battery low over 75 days</Note>\n      <Limit>Up to 3 h and 3 h more</Limit>\n      <Limit>Up to 3 h for everyone</Limit>\n      <Note>{\'Low \' + b.battery}</Note>\n      <Note>{ETA}</Note>\n      <Note>{\'Low \' + a.battery}</Note>\n      <Note>{BUDGET} over 75 ms</Note>\n      <Footer aria-label="Shipped count" key="footer" type="button">Shipped {a.count} of {b.count}</Footer>\n      <Hint>{`Median of ${n} samples and ${MAX_ROWS} rows`}</Hint>\n    </Page>\n  )\n}\n',
  },
  {
    path: 'b.tsx',
    text: 'import { Card } from \'basalt-ui/ui\'\n\nexport function Detail({ item }: Props) {\n  return (\n    <Card role="region" variant="quiet" href="/x" style={{ color: \'red\' }}>\n      <h2>Median review</h2>\n      <p>Shipped {item.n} items, median 42 ms.</p>\n      <Status tone="good">Budget left {item.left}</Status>\n      <Status tone="warn">{BUDGET} is 12 h</Status>\n      <p>Median is {item.median} with {AHEAD} items</p>\n      <Tag>{\'Ahead of schedule\'}</Tag>\n    </Card>\n  )\n}\n',
  },
  {
    path: 'c.tsx',
    text: 'export const Empty = () => <p>Nothing shipped yet, median not set.</p>\nexport const Hint2 = () => <p>Median not set over 75 days</p>\nexport const Days = ({ n, m }: Props) => <p>{`Lasted ${n} days`}</p>\nexport const Days2 = ({ m }: Props) => <p>{`Lasted ${m} days`}</p>\n',
  },
]

/**
 * The original shell pipeline's output (references/copy.md: rg | perl | sed | perl | awk | sort) on PAGE,
 * captured once in a temp dir and pasted here; it is not derived from facts.ts. The shell breaks ties by the
 * locale's collation, so both sides are compared in one canonical order.
 */
const ORIGINAL = [
  '6 median',
  '4 days',
  '4 ahead',
  '3 =ahead',
  '3 [3 h]',
  '2 =budget',
  '2 [over 75]',
  '2 [median latency]',
  '2 [low #]',
  '2 [lasted #]',
  '2 [budget left]',
  '2 [75 days]',
  '2 [# days]',
]

const toLine = (fact: FactCount): string =>
  fact.kind === 'word'
    ? `${fact.count} ${fact.text}`
    : fact.kind === 'phrase'
      ? `${fact.count} [${fact.text}]`
      : `${fact.count} =${fact.text}`

const countOf = (line: string): number => Number(line.slice(0, line.indexOf(' ')))

const canonical = (lines: readonly string[]): string[] =>
  lines.toSorted((a, b) => countOf(b) - countOf(a) || (a < b ? -1 : a > b ? 1 : 0))

describe('countFacts', () => {
  test('matches the original pipeline line for line', () => {
    expect(canonical(countFacts(PAGE).map(toLine))).toEqual(canonical(ORIGINAL))
  })

  test('the most-said fact comes first', () => {
    const counts = countFacts(PAGE).map((fact) => fact.count)
    expect(counts).toEqual(counts.toSorted((a, b) => b - a))
  })

  test('imports and comments say nothing', () => {
    expect(
      countFacts([
        { path: 'x.tsx', text: "import { Page } from 'basalt-ui/ui'\n// Median median median\n" },
      ]),
    ).toEqual([])
  })
})
