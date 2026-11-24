/**
 * The naming glossary as data: one name per concept, and the names a part must not use for it
 * (`docs/v3/ARCHITECTURE.md` section 6 holds the words; this list holds the prop names). Where the
 * glossary is silent the name most parts already use wins and gets a row here.
 *
 * `glossary.test.ts` reads the generated prop lists (`docs/<name>.md`, written by `gen-docs`) and
 * fails when a part names a concept by a rejected word.
 */

export type Concept = {
  /** What the name means, in a line. */
  readonly concept: string
  /** The one prop name for it. */
  readonly name: string
  /** Names no part takes for it. */
  readonly rejected: readonly string[]
  /** Parts that keep a rejected word because it means something else there, with why. */
  readonly except?: Readonly<Record<string, string>>
}

export const GLOSSARY: readonly Concept[] = [
  {
    concept: 'the heading of a card, stat, section or page bar',
    name: 'title',
    rejected: ['heading', 'headline'],
  },
  {
    concept: 'the line under a card or stat title',
    name: 'subtitle',
    rejected: ['qualifier', 'subheading', 'tagline'],
  },
  {
    concept: 'the label row under a small chart (start, middle, end)',
    name: 'axisLabels',
    rejected: ['xLabels', 'tickLabels'],
  },
  {
    concept: "a card's chart box height",
    name: 'height',
    rejected: ['chartHeight', 'plotHeight', 'boxHeight'],
  },
  { concept: 'the accessible name of a chart', name: 'label', rejected: ['ariaLabel'] },
  {
    concept: 'the points one sparkline draws',
    name: 'points',
    rejected: ['datapoints', 'samples'],
  },
  {
    concept: 'a callback with the new value',
    name: 'onValueChange',
    rejected: ['onChange'],
    except: {
      NativeSelect: "the native select's DOM change event; its value callback is onValueChange",
    },
  },
  { concept: 'a bound control handle', name: 'state', rejected: ['handle'] },
  { concept: 'the record a part stars', name: 'favorite', rejected: ['favourite', 'favourites'] },
  { concept: 'a series or state color', name: 'color', rejected: ['colour', 'colours'] },
]

/** One part's props, as its generated doc lists them. */
export type PropList = { readonly part: string; readonly props: readonly string[] }

export type SecondName = {
  readonly part: string
  readonly prop: string
  readonly name: string
  readonly concept: string
}

/** Every prop that names a glossary concept by a rejected word. */
export function secondNames(
  lists: readonly PropList[],
  glossary: readonly Concept[] = GLOSSARY,
): SecondName[] {
  const byWord = new Map(glossary.flatMap((c) => c.rejected.map((word) => [word, c] as const)))
  return lists.flatMap(({ part, props }) =>
    props.flatMap((prop) => {
      const c = byWord.get(prop)
      if (c === undefined || c.except?.[part] !== undefined) return []
      return [{ part, prop, name: c.name, concept: c.concept }]
    }),
  )
}

const SIGNATURE = /^([A-Za-z_$][\w$]*)(?:<[^(]*>)?\((.*)\)\s*:/
const PROP_LINE = /^ {2}([A-Za-z_$][\w$]*)\??:/

/** The destructured names of a signature's first parameter: `({ a, b: c, "aria-x": y, ...rest })` gives a, b. */
function destructured(params: string): string[] {
  const open = params.indexOf('{')
  const close = params.lastIndexOf('}')
  if (!params.trimStart().startsWith('{') || open === -1 || close <= open) return []
  return params
    .slice(open + 1, close)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '' && !s.startsWith('...') && !s.startsWith('"'))
    .map((s) => s.split(/[:=]/)[0]!.trim())
    .filter((s) => /^[A-Za-z_$][\w$]*$/.test(s))
}

/** The parts and their props in one generated doc: every `ts` fence's signature line and the prop lines under it. */
export function propListsOf(markdown: string): PropList[] {
  const found: { part: string; props: Set<string> }[] = []
  for (const fence of markdown.matchAll(/```ts\n([\s\S]*?)```/g)) {
    let current: { part: string; props: Set<string> } | undefined
    for (const line of fence[1]!.split('\n')) {
      const sig = SIGNATURE.exec(line)
      if (sig) {
        current = { part: sig[1]!, props: new Set(destructured(sig[2]!)) }
        found.push(current)
        continue
      }
      const prop = PROP_LINE.exec(line)
      if (prop && current) current.props.add(prop[1]!)
    }
  }
  return found.map(({ part, props }) => ({ part, props: [...props] }))
}
