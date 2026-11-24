/**
 * The fact count of a page's `.tsx` files: a TypeScript port, stage by stage, of the shell pipeline the
 * design skill's copy reference used to carry (rg | perl | sed | perl | awk | sort), so the same files
 * give the same counts. `facts.test.ts` pins the output that pipeline printed.
 *
 * A viewer string is JSX text, or a quoted or template string that holds a space or starts with a capital.
 * `${…}` is a `#` placeholder, a `${UPPER_CASE}` a use of that constant, and a `const` string read in
 * two or more places a `=name` count. A string counts a word once.
 */

export type FactKind = 'word' | 'phrase' | 'constant'

export type FactCount = { kind: FactKind; text: string; count: number }

export type FactFile = { path: string; text: string }

/** The awk's stop list: a word in it is never counted, and no phrase holds one. */
const STOP_WORDS: ReadonlySet<string> = new Set(
  'the|and|for|with|from|this|that|are|was|not|has|have|per|its|all|one|any|more|than|into|off|out|you|your|each|when|over|only|here|there|what|which|been|were|will|then|them|they|their|also|just|some|such|very|about|after|before|between'.split(
    '|',
  ),
)

/** The awk's shorter list: a number's neighbour in it keeps the phrase out ('3 the' is no phrase). */
const NUMBER_NEIGHBOUR_STOP: ReadonlySet<string> = new Set(
  'the|and|for|with|from|that|are|was|not|has|have|its|you|your|when|here|there|what|which|been|were|will|then|them|they|their|also|just|some|such|very|about|after|before|between|at|to|in|on|by|is|as|or|vs'.split(
    '|',
  ),
)

/** Stage 1 (rg -v): import lines, the close of a multi-line import, and comment lines are no viewer text. */
const SKIP_LINE = /^\s*(import |\} from |\/\/|\*|\/\*)/
/** Stage 2 (perl): a `const` string with its value, and the same declaration without it. */
const CONST_WITH_VALUE =
  /\bconst\s+(\w+)\s*(?::\s*string\s*)?=\s*(["\x27\x60])((?:(?!\2)[^\\\n]|\\.)*)\2[ \t]*(?:as const)?[ \t]*\n/g
const CONST_DECL =
  /\bconst\s+(\w+)\s*(?::\s*string\s*)?=\s*(["\x27\x60])(?:(?!\2)[^\\\n]|\\.)*\2[ \t]*(?:as const)?[ \t]*\n/g
/** A quote, then `+ expression` (a concatenated value): the expression becomes a placeholder. */
const CONCAT = /(["\x27])\s*\+\s*[A-Za-z_][\w.]*(\([^)]*\))?/g
/** Stage 3 (sed): an attribute whose value is no viewer text. */
const ATTRIBUTE =
  /(className|key|id|type|role|variant|size|tone|href|style|field|accessorKey|data-[a-z-]+|aria-[a-z]+)=("[^"]*"|\{[^}]*\})/g
/** Stage 4 (perl -nle): a double, single or template string, or JSX text between `>` and `<`. */
const VIEWER_TEXT =
  /"(?:[^"\\]|\\.)*"|(?<![A-Za-z])\x27(?:[^\x27\\]|\\.)*\x27|\x60[^\x60]*\x60|(?<![=-])>[^<>{}]{3,}</g
/** Stage 5 (awk): the word split, and a number. */
const WORD_SPLIT = /[^a-z0-9_%]+/
const NUMBER = /^[0-9]+$/

const bump = (counts: Map<string, number>, key: string): void => {
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

/** Lines as rg prints them: a trailing newline is no line, an import or comment line is dropped. */
function viewerLines(text: string): string[] {
  const lines = text.split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines.filter((line) => !SKIP_LINE.test(line))
}

/** The constants the awk counts: a string with a capital or a symbol, and two letters once the placeholders go. */
function constantsOf(source: string): Map<string, { quote: string; value: string }> {
  const constants = new Map<string, { quote: string; value: string }>()
  for (const [, name = '', quote = '', value = ''] of source.matchAll(CONST_WITH_VALUE)) {
    const viewer = /^[A-Z]/.test(value) || /[^\w\\-]/.test(value)
    if (viewer && /[A-Za-z]{2}/.test(value.replace(/\$\{[^}]*\}/g, '')))
      constants.set(name, { quote, value })
  }
  return constants
}

/** The output of stage 2 (perl) with the constant reads rewritten; the constant declarations become blank lines. */
function substituteConstants(source: string): string {
  const constants = constantsOf(source)
  let text = source.replace(CONST_DECL, (match, name: string) =>
    constants.has(name) ? '\n' : match,
  )
  for (const [name, { quote, value }] of constants) {
    text = text.replace(
      new RegExp(String.raw`\$\{\s*${name}\s*\}`, 'g'),
      () => ` uu_${name} ${value} `,
    )
    text = text.replace(
      new RegExp(String.raw`(?<![\w.$])\b${name}\b`, 'g'),
      () => `${quote} uu_${name} ${value} ${quote}`,
    )
    text = text.replace(CONCAT, (_match, q: string) => ` nn_${q}`)
  }
  return text
}

/** Stage 3 (sed), per line: `${UPPER}` a constant use, other `${…}` a placeholder, attributes and `%` spaced off. */
function sedLine(line: string): string {
  return line
    .replace(/\$\{([A-Z][A-Z0-9_]*)\}/g, (_match, name: string) => ` vv_${name} `)
    .replace(/\$\{[^}]*\}/g, () => ' nn_ ')
    .replace(ATTRIBUTE, '')
    .replace(/%/g, ' % ')
}

/** Stage 4 (perl -nle): the viewer strings, one per item; a quoted string keeps only a capital or a space. */
function viewerItems(text: string): string[] {
  const items: string[] = []
  for (const line of text.split('\n')) {
    for (const [match] of line.matchAll(VIEWER_TEXT)) {
      const quote = match[0]
      if (quote !== '"' && quote !== "'") {
        items.push(match)
        continue
      }
      const inner = match.slice(1, -1)
      if (/^[A-Z]/.test(inner) || /\s/.test(inner)) items.push(inner)
    }
  }
  return items
}

/** The awk's lowercase: ASCII only, as the shell's tolower is on these files. */
const lowerAscii = (text: string): string => text.replace(/[A-Z]/g, (c) => c.toLowerCase())

/** The awk's per-item counts: a word once per string, a phrase once per string, a constant read once per string. */
function tally(items: readonly string[]): {
  words: Map<string, number>
  phrases: Map<string, number>
  constants: Map<string, number>
} {
  const words = new Map<string, number>()
  const phrases = new Map<string, number>()
  const constants = new Map<string, number>()
  for (const item of items) {
    const w = lowerAscii(item).split(WORD_SPLIT)
    const seen = new Set<string>()
    for (const x of w) {
      if (x.startsWith('uu_')) {
        if (!seen.has(x)) bump(constants, x)
        seen.add(x)
      } else if (x.startsWith('vv_')) {
        if (!seen.has(x)) bump(words, `{${x.slice(3)}}`)
        seen.add(x)
      } else if (x.length >= 4 && !STOP_WORDS.has(x) && !seen.has(x)) {
        seen.add(x)
        bump(words, x)
      }
    }
    const seenPhrases = new Set<string>()
    for (let j = 0; j + 1 < w.length; j++) {
      const x = w[j] ?? ''
      const y = w[j + 1] ?? ''
      const xNum = NUMBER.test(x)
      const yNum = NUMBER.test(y)
      if (/^[uv][uv]_/.test(x) || /^[uv][uv]_/.test(y) || x === '' || y === '') continue
      if ((xNum && yNum) || (x === 'nn_' && y === 'nn_')) continue
      if (xNum || yNum) {
        const beside = xNum ? y : x
        if (NUMBER_NEIGHBOUR_STOP.has(beside) || beside === 'nn_') continue
      } else if (STOP_WORDS.has(x) || STOP_WORDS.has(y) || x.length < 3 || y.length < 3) {
        continue
      }
      const phrase = `${x} ${y}`
      if (seenPhrases.has(phrase)) continue
      seenPhrases.add(phrase)
      bump(phrases, phrase)
    }
  }
  return { words, phrases, constants }
}

/** The line `sort -rn` prints for a fact: the count, then the word, the [phrase] or the =constant. */
const lineOf = (fact: FactCount): string =>
  fact.kind === 'word'
    ? `${fact.count} ${fact.text}`
    : fact.kind === 'phrase'
      ? `${fact.count} [${fact.text}]`
      : `${fact.count} =${fact.text}`

/** The most-said first, ties in reverse line order as `sort -rn` leaves them under the C locale. */
const byCount = (a: FactCount, b: FactCount): number => {
  if (a.count !== b.count) return b.count - a.count
  const [x, y] = [lineOf(a), lineOf(b)]
  return x < y ? 1 : x > y ? -1 : 0
}

/**
 * The facts a page says more than once: each word of four or more letters said in four or more strings,
 * each two-word phrase said in two or more, each constant read in two or more places.
 */
export function countFacts(files: readonly FactFile[]): FactCount[] {
  const source = files.flatMap((file) => viewerLines(file.text).map((line) => `${line}\n`)).join('')
  const text = substituteConstants(source).split('\n').map(sedLine).join('\n')
  const { words, phrases, constants } = tally(viewerItems(text))
  const facts: FactCount[] = [
    ...[...words]
      .filter(([, n]) => n >= 4)
      .map(([text, count]) => ({ kind: 'word' as const, text, count })),
    ...[...phrases]
      .filter(([, n]) => n >= 2)
      .map(([text, count]) => ({
        kind: 'phrase' as const,
        text: text.replaceAll('nn_', '#'),
        count,
      })),
    ...[...constants]
      .filter(([, n]) => n >= 2)
      .map(([key, count]) => ({ kind: 'constant' as const, text: key.slice(3), count })),
  ]
  return facts.toSorted(byCount)
}
