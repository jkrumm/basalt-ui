import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'
import { CN_THEME } from './cn-theme'

/**
 * Class merge: `clsx`, then a conflict-aware drop of Tailwind 4 utilities. One function over one
 * conflict table (`resolveGroup` + `OVERRIDES`), written without `tailwind-merge`: the table
 * knows this theme, so `text-display` (size) and `text-red-500` (colour) both survive. To flip
 * `cn` to bare `clsx` (docs/v3/ARCHITECTURE.md F6), change `cn`'s last line to `return joined`.
 */
export type { ClassValue }

type Resolver = (rest: string) => string | undefined

const set = (list: readonly string[]): Set<string> => new Set(list)
const THEME = {
  sizes: set(CN_THEME.textSizes),
  radii: set([...CN_THEME.radii, 'full', 'none']),
  shadows: set([...CN_THEME.shadows, 'none']),
  fonts: set(CN_THEME.fonts),
  colors: set(CN_THEME.colors),
  durations: set(CN_THEME.durations),
  eases: set([...CN_THEME.eases, 'linear', 'in', 'out', 'in-out', 'initial']),
}

const SIDES = ['t', 'r', 'b', 'l'] as const
const AXES = { x: ['l', 'r', 's', 'e'], y: ['t', 'b'] } as const

/** Group -> earlier groups a later class of it clobbers. The reverse never applies. */
const OVERRIDES: Record<string, string[]> = {}
const addSpacing = (name: string, hasAxes = true): void => {
  const sides = ['t', 'r', 'b', 'l', 's', 'e'].map((s) => `${name}-${s}`)
  OVERRIDES[name] = [...sides, `${name}-x`, `${name}-y`]
  if (!hasAxes) return
  OVERRIDES[`${name}-x`] = AXES.x.map((s) => `${name}-${s}`)
  OVERRIDES[`${name}-y`] = AXES.y.map((s) => `${name}-${s}`)
}
for (const name of ['p', 'm', 'border', 'border-color']) addSpacing(name)
OVERRIDES['inset'] = ['inset-x', 'inset-y', 'top', 'right', 'bottom', 'left', 'start', 'end']
OVERRIDES['inset-x'] = ['left', 'right', 'start', 'end']
OVERRIDES['inset-y'] = ['top', 'bottom']
OVERRIDES['rounded'] = [
  ...SIDES.map((s) => `rounded-${s}`),
  ...['s', 'e', 'tl', 'tr', 'br', 'bl', 'ss', 'se', 'ee', 'es'].map((s) => `rounded-${s}`),
]
OVERRIDES['rounded-t'] = ['rounded-tl', 'rounded-tr']
OVERRIDES['rounded-r'] = ['rounded-tr', 'rounded-br']
OVERRIDES['rounded-b'] = ['rounded-br', 'rounded-bl']
OVERRIDES['rounded-l'] = ['rounded-tl', 'rounded-bl']
OVERRIDES['rounded-s'] = ['rounded-ss', 'rounded-es']
OVERRIDES['rounded-e'] = ['rounded-se', 'rounded-ee']
OVERRIDES['size'] = ['w', 'h']
OVERRIDES['gap'] = ['gap-x', 'gap-y']
OVERRIDES['overflow'] = ['overflow-x', 'overflow-y']
OVERRIDES['overscroll'] = ['overscroll-x', 'overscroll-y']
OVERRIDES['scale'] = ['scale-x', 'scale-y']
OVERRIDES['truncate'] = ['overflow', 'overflow-x', 'overflow-y', 'text-overflow', 'whitespace']
OVERRIDES['flex'] = ['grow', 'shrink', 'basis']
OVERRIDES['place-content'] = ['justify', 'content']
OVERRIDES['border-spacing'] = ['border-spacing-x', 'border-spacing-y']
OVERRIDES['touch'] = ['touch-pan-x', 'touch-pan-y', 'touch-pinch-zoom']
OVERRIDES['break-normal'] = ['word-break', 'overflow-wrap']

/** Whole-class names: group -> the bare utilities that set it. */
const EXACT: Record<string, string> = {}
const exact = (group: string, names: string): void => {
  for (const name of names.split(' ')) EXACT[name] = group
}
exact(
  'display',
  'hidden block inline inline-block inline-flex flex grid inline-grid table contents',
)
exact('display', 'flow-root list-item inline-table table-row table-cell table-caption')
exact('position', 'static fixed absolute relative sticky')
exact('visibility', 'visible invisible collapse')
exact('truncate', 'truncate')
exact('sr', 'sr-only not-sr-only')
exact('font-style', 'italic not-italic')
exact('text-transform', 'uppercase lowercase capitalize normal-case')
exact('text-decoration', 'underline no-underline line-through overline')
exact('box', 'box-border box-content')
exact('isolation', 'isolate isolation-auto')
exact('float', 'float-left float-right float-none float-start float-end')
exact('grow', 'grow grow-0')
exact('shrink', 'shrink shrink-0')
exact('transition', 'transition')
exact('antialiased', 'antialiased subpixel-antialiased')
exact('numeric', 'tabular-nums proportional-nums lining-nums oldstyle-nums normal-nums')
exact('ring-inset', 'ring-inset')
exact('border-collapse', 'border-collapse border-separate')

const LENGTH = /^\[(?:[-+]?[\d.]+[a-z%]*|(?:calc|min|max|clamp)\(.*)\]$/
const NUMBER = /^(?:\d+(?:\.\d+)?|px|\[.*\])$/
const STRICT_NUMBER = /^\d+(?:\.\d+)?$/
const PALETTE = /^(?:[a-z]+-\d{2,3}|black|white|transparent|current|inherit)$/
const BG_KEYWORD: Record<string, string> = {
  fixed: 'bg-attachment',
  local: 'bg-attachment',
  scroll: 'bg-attachment',
  auto: 'bg-size',
  cover: 'bg-size',
  contain: 'bg-size',
  none: 'bg-image',
  repeat: 'bg-repeat',
  'no-repeat': 'bg-repeat',
  'repeat-x': 'bg-repeat',
  'repeat-y': 'bg-repeat',
  'repeat-round': 'bg-repeat',
  'repeat-space': 'bg-repeat',
}
const BG_POSITION = /^(?:top|bottom|left|right|center)(?:-(?:left|right|top|bottom))?$/

/** `[length:...]` hint, else guessed from the value; `undefined` for a non-arbitrary name. */
function arbitraryKind(rest: string): string | undefined {
  if (!rest.startsWith('[')) return undefined
  const hint = /^\[([a-z-]+):/.exec(rest)
  if (hint) return hint[1]
  return LENGTH.test(rest) ? 'length' : 'color'
}

const isColor = (rest: string): boolean =>
  THEME.colors.has(rest) || PALETTE.test(rest) || arbitraryKind(rest) === 'color'

/** Any rest (including none) sets `group`. */
const always =
  (group: string): Resolver =>
  () =>
    group
/** Theme names, bare numbers and arbitrary values set `group`; anything else is not ours. */
const named =
  (group: string, names: Set<string>): Resolver =>
  (rest) =>
    names.has(rest) || STRICT_NUMBER.test(rest) || rest.startsWith('[') ? group : undefined
const either =
  (yes: string, no: string, test: (rest: string) => boolean): Resolver =>
  (rest) =>
    test(rest) ? yes : no
const isWidth = (rest: string): boolean => {
  const kind = arbitraryKind(rest)
  return rest === '' || NUMBER.test(rest) ? kind === undefined || kind === 'length' : false
}
const BORDER_STYLE = set(['solid', 'dashed', 'dotted', 'double', 'none', 'hidden'])
const side =
  (prefix: string, name: string): Resolver =>
  (rest) => {
    if (BORDER_STYLE.has(rest) && prefix === 'border') return 'border-style'
    return isWidth(rest) ? `${prefix}-${name}` : `${prefix}-color-${name}`
  }

const RULES = new Map<string, Resolver>()
const rule = (head: string, resolver: Resolver): void => {
  RULES.set(head, resolver)
}
for (const name of ['p', 'm']) {
  rule(name, always(name))
  for (const s of ['x', 'y', 't', 'r', 'b', 'l', 's', 'e'])
    rule(`${name}${s}`, always(`${name}-${s}`))
}
for (const name of [
  'inset',
  'inset-x',
  'inset-y',
  'top',
  'right',
  'bottom',
  'left',
  'start',
  'end',
])
  rule(name, always(name))
for (const name of ['gap', 'gap-x', 'gap-y', 'w', 'h', 'size', 'min-w']) rule(name, always(name))
for (const name of ['min-h', 'max-w', 'max-h', 'z', 'order', 'aspect', 'columns', 'basis'])
  rule(name, always(name))
for (const name of ['opacity', 'cursor', 'pointer-events', 'select', 'resize', 'delay'])
  rule(name, always(name))
for (const name of ['appearance', 'animate', 'will-change', 'whitespace', 'line-clamp', 'indent'])
  rule(name, always(name))
for (const name of ['items', 'justify-items', 'justify-self', 'self', 'place-items'])
  rule(name, always(name))
for (const name of ['place-self', 'place-content', 'auto-cols', 'auto-rows', 'grid-flow'])
  rule(name, always(name))
for (const name of ['leading', 'tracking', 'hyphens', 'align', 'underline-offset', 'translate-x'])
  rule(name, always(name))
for (const name of [
  'translate-y',
  'translate-z',
  'rotate',
  'rotate-x',
  'rotate-y',
  'rotate-z',
  'blur',
  'backdrop-blur',
  'object-position',
])
  rule(name, always(name))
rule('justify', always('justify'))
rule('scale', always('scale'))
rule('scale-x', always('scale-x'))
rule('scale-y', always('scale-y'))
rule('overflow', always('overflow'))
rule('overflow-x', always('overflow-x'))
rule('overflow-y', always('overflow-y'))
rule('overscroll', always('overscroll'))
rule('overscroll-x', always('overscroll-x'))
rule('overscroll-y', always('overscroll-y'))
rule('grow', always('grow'))
rule('flex-grow', always('grow'))
rule('shrink', always('shrink'))
rule('flex-shrink', always('shrink'))
rule('grid-cols', always('grid-cols'))
rule('grid-rows', always('grid-rows'))
rule('col-span', always('col-span'))
rule('row-span', always('row-span'))
rule('col-start', always('col-start'))
rule('col-end', always('col-end'))
rule('row-start', always('row-start'))
rule('row-end', always('row-end'))
rule('col', always('col'))
rule('row', always('row'))
rule('border-spacing', always('border-spacing'))
rule('border-spacing-x', always('border-spacing-x'))
rule('border-spacing-y', always('border-spacing-y'))
rule('wrap', always('overflow-wrap'))
rule('break', (rest) => {
  const phase = /^(after|before|inside)-/.exec(rest)
  if (phase) return `break-${phase[1]}`
  if (rest === 'words') return 'overflow-wrap'
  return rest === 'normal' ? 'break-normal' : 'word-break'
})
rule('touch', (rest) => {
  if (/^pan-(?:x|left|right)$/.test(rest)) return 'touch-pan-x'
  if (/^pan-(?:y|up|down)$/.test(rest)) return 'touch-pan-y'
  return rest === 'pinch-zoom' ? 'touch-pinch-zoom' : 'touch'
})
rule('list', (rest) => {
  if (rest === 'inside' || rest === 'outside') return 'list-position'
  return rest.startsWith('image-') ? 'list-image' : 'list'
})
rule('content', (rest) => (/^(?:none|\[|\()/.test(rest) ? 'content-text' : 'content'))
for (const axis of ['x', 'y'])
  rule(`space-${axis}`, (rest) => (rest === 'reverse' ? `space-${axis}-reverse` : `space-${axis}`))
rule('font-stretch', always('font-stretch'))
rule('duration', named('duration', THEME.durations))
rule('ease', named('ease', THEME.eases))
rule('transition', (rest) =>
  rest === 'discrete' || rest === 'normal' ? 'transition-behavior' : 'transition',
)
rule('font', (rest) => {
  if (THEME.fonts.has(rest)) return 'font-family'
  return arbitraryKind(rest) === 'family-name' ? 'font-family' : 'font-weight'
})
rule('flex', (rest) => {
  if (rest === '') return 'display'
  if (/^(?:row|col)(?:-reverse)?$/.test(rest)) return 'flex-direction'
  if (/^(?:wrap|nowrap|wrap-reverse)$/.test(rest)) return 'flex-wrap'
  return 'flex'
})
rule('object', (rest) =>
  /^(?:contain|cover|fill|none|scale-down)$/.test(rest) ? 'object-fit' : 'object-position',
)
rule('text', (rest) => {
  if (THEME.sizes.has(rest)) return 'font-size'
  if (/^(?:left|center|right|justify|start|end)$/.test(rest)) return 'text-align'
  if (/^(?:wrap|nowrap|balance|pretty)$/.test(rest)) return 'text-wrap'
  if (rest === 'ellipsis' || rest === 'clip') return 'text-overflow'
  const kind = arbitraryKind(rest)
  if (kind === 'length' || kind === 'absolute-size' || kind === 'relative-size') return 'font-size'
  return 'text-color'
})
rule('bg', (rest) => {
  const keyword = BG_KEYWORD[rest]
  if (keyword) return keyword
  if (BG_POSITION.test(rest)) return 'bg-position'
  if (/^(?:linear|radial|conic|gradient)-/.test(rest)) return 'bg-image'
  if (/^(?:clip|origin|blend)-/.test(rest)) return `bg-${rest.split('-')[0]}`
  const kind = arbitraryKind(rest)
  if (kind === 'url' || kind === 'image') return 'bg-image'
  if (kind === 'length' || kind === 'size') return 'bg-size'
  if (kind === 'position') return 'bg-position'
  return isColor(rest) ? 'bg-color' : undefined
})
rule('border', (rest) => {
  if (BORDER_STYLE.has(rest)) return 'border-style'
  return isWidth(rest) ? 'border' : 'border-color'
})
for (const s of ['x', 'y', ...SIDES, 's', 'e']) rule(`border-${s}`, side('border', s))
rule('rounded', (rest) =>
  rest === '' || THEME.radii.has(rest) || /^(?:xs|sm|md|lg|\d?xl)$/.test(rest) || rest[0] === '['
    ? 'rounded'
    : undefined,
)
for (const s of ['t', 'r', 'b', 'l', 's', 'e', 'tl', 'tr', 'br', 'bl', 'ss', 'se', 'ee', 'es'])
  rule(`rounded-${s}`, always(`rounded-${s}`))
rule('shadow', (rest) => {
  if (rest === '' || THEME.shadows.has(rest)) return 'shadow'
  if (!rest.startsWith('[')) return 'shadow-color'
  return /^\[(?:color:|#|rgb|hsl|oklch|var\()/.test(rest) ? 'shadow-color' : 'shadow'
})
const INSET_SHADOW_SIZE = /^(?:|2xs|xs|sm|md|lg|none)$/
rule('inset-shadow', (rest) => {
  if (INSET_SHADOW_SIZE.test(rest)) return 'inset-shadow'
  if (!rest.startsWith('[')) return 'inset-shadow-color'
  return /^\[(?:color:|#|rgb|hsl|oklch|var\()/.test(rest) ? 'inset-shadow-color' : 'inset-shadow'
})
rule('inset-ring', (rest) => (isWidth(rest) ? 'inset-ring' : 'inset-ring-color'))
rule('text-shadow', (rest) => {
  if (INSET_SHADOW_SIZE.test(rest)) return 'text-shadow'
  if (!rest.startsWith('[')) return 'text-shadow-color'
  return /^\[(?:color:|#|rgb|hsl|oklch|var\()/.test(rest) ? 'text-shadow-color' : 'text-shadow'
})
rule('ring', (rest) => {
  if (rest === 'inset') return 'ring-inset'
  return isWidth(rest) ? 'ring' : 'ring-color'
})
rule(
  'ring-offset',
  either('ring-offset', 'ring-offset-color', (rest) => STRICT_NUMBER.test(rest)),
)
rule('outline', (rest) => {
  if (rest === '' || /^(?:none|dashed|dotted|double|hidden)$/.test(rest)) return 'outline-style'
  return isWidth(rest) ? 'outline-width' : 'outline-color'
})
rule('outline-offset', always('outline-offset'))
rule('stroke', (rest) => (isWidth(rest) ? 'stroke-width' : isColor(rest) ? 'stroke' : undefined))
rule('fill', (rest) => (isColor(rest) ? 'fill' : undefined))
rule('accent', (rest) => (isColor(rest) ? 'accent' : undefined))
rule('caret', (rest) => (isColor(rest) ? 'caret' : undefined))
rule('decoration', (rest) => {
  if (rest === 'clone' || rest === 'slice') return 'box-decoration'
  if (/^(?:solid|double|dotted|dashed|wavy)$/.test(rest)) return 'decoration-style'
  if (STRICT_NUMBER.test(rest) || rest === 'auto' || rest === 'from-font') return 'decoration-width'
  return 'decoration-color'
})

/** Conflict group of a base utility (negative and opacity already stripped), if it has one. */
function resolveGroup(base: string): string | undefined {
  if (base.startsWith('[')) {
    const colon = base.indexOf(':')
    return colon > 0 ? `[${base.slice(1, colon)}]` : undefined
  }
  const exactGroup = EXACT[base]
  if (exactGroup) return exactGroup
  const parts = base.split('-')
  for (let i = parts.length; i > 0; i--) {
    const found = RULES.get(parts.slice(0, i).join('-'))?.(parts.slice(i).join('-'))
    if (found) return found
  }
  return undefined
}

type Parsed = { key: string; clobbers: string[] } | undefined

function lastTopLevel(token: string, char: string): number {
  let depth = 0
  let at = -1
  for (let i = 0; i < token.length; i++) {
    const c = token[i]
    if (c === '[' || c === '(') depth++
    else if (c === ']' || c === ')') depth--
    else if (c === char && depth === 0) at = i
  }
  return at
}

function parse(token: string): Parsed {
  const colon = lastTopLevel(token, ':')
  const variant = token.slice(0, colon + 1)
  let utility = token.slice(colon + 1)
  let important = false
  if (utility.startsWith('!')) {
    important = true
    utility = utility.slice(1)
  } else if (utility.endsWith('!')) {
    important = true
    utility = utility.slice(0, -1)
  }
  if (utility.startsWith('-')) utility = utility.slice(1)
  const slash = lastTopLevel(utility, '/')
  if (slash > 0) utility = utility.slice(0, slash)
  const g = resolveGroup(utility)
  if (!g) return undefined
  const scope = `${variant}${important ? '!' : ''}|`
  return { key: scope + g, clobbers: (OVERRIDES[g] ?? []).map((o) => scope + o) }
}

function merge(joined: string): string {
  const tokens = joined.split(/\s+/).filter(Boolean)
  const seen = new Set<string>()
  const kept: string[] = []
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i]!
    const parsed = parse(token)
    if (parsed) {
      if (seen.has(parsed.key)) continue
      seen.add(parsed.key)
      for (const key of parsed.clobbers) seen.add(key)
    }
    kept.push(token)
  }
  return kept.toReversed().join(' ')
}

export function cn(...inputs: ClassValue[]): string {
  const joined = clsx(inputs)
  return merge(joined)
}
