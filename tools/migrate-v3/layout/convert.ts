import type { Value } from './read.ts'
import {
  ALIGN,
  BASE_CLASSES,
  BREAKPOINT_PREFIX,
  DEFAULTS,
  FONT_SIZE,
  FONT_WEIGHT,
  JUSTIFY,
  LATENT_WEIGHT_NAMES,
  LAYOUT_PROPS,
  RADIUS,
  SPACING,
  STYLE_PROPS,
  isPassThrough,
} from './tables.ts'

export type Prop = { name: string; value: Value }
export type Human = { prop: string; why: string }
export type Conversion = {
  tagName: string
  classes: string[]
  /** `test ? a : b` pairs, appended after the static classes. */
  conds: { test: string; a: string; b: string }[]
  human: Human[]
}

type Mapped = { cls: string } | { human: string }
type Ctx = { tag: string; hasVerticalSpacing: boolean }

const LATENT_WEIGHT =
  'is not a valid CSS font weight, so it does not apply today; decide the intended weight and use a number'

/** px to a Tailwind spacing step (4px units); only the 2px grid is expressible without an arbitrary value. */
function step(px: number): string | null {
  if (!Number.isFinite(px) || px < 0 || px % 2 !== 0) return null
  return String(px / 4)
}

function pxOf(v: string | number): number | null {
  if (typeof v === 'number') return v
  const m = /^(-?\d+(?:\.\d+)?)(?:px)?$/.exec(v)
  return m ? Number(m[1]) : null
}

function spacing(prefix: string, v: string | number, allowNegative: boolean): Mapped {
  if (typeof v === 'string' && SPACING[v] !== undefined) return { cls: `${prefix}-${SPACING[v]}` }
  if (v === 'auto' && prefix.startsWith('m')) return { cls: `${prefix}-auto` }
  const px = pxOf(v)
  if (px === null)
    return { human: `spacing value ${JSON.stringify(v)} has no class without an arbitrary value` }
  const n = step(Math.abs(px))
  if (n === null) return { human: `spacing ${px}px is off the 2px grid` }
  if (px < 0) {
    return allowNegative ? { cls: `-${prefix}-${n}` } : { human: `negative ${prefix} value ${px}` }
  }
  return { cls: `${prefix}-${n}` }
}

function size(prefix: string, v: string | number): Mapped {
  if (v === '100%') return { cls: `${prefix}-full` }
  if (v === 'auto') return { cls: `${prefix}-auto` }
  const px = pxOf(v)
  const n = px === null ? null : step(px)
  if (n === null)
    return { human: `size value ${JSON.stringify(v)} has no class without an arbitrary value` }
  return { cls: `${prefix}-${n}` }
}

function inset(prefix: string, v: string | number): Mapped {
  const px = pxOf(v)
  const n = px === null ? null : step(Math.abs(px))
  if (n === null)
    return { human: `${prefix} value ${JSON.stringify(v)} has no class without an arbitrary value` }
  return { cls: px! < 0 ? `-${prefix}-${n}` : `${prefix}-${n}` }
}

function oneOf(
  v: string | number,
  allowed: string[],
  map: (s: string) => string,
  prop: string,
): Mapped {
  return typeof v === 'string' && allowed.includes(v)
    ? { cls: map(v) }
    : { human: `${prop} value ${JSON.stringify(v)}` }
}

/** One literal value of one prop to one class (no breakpoint prefix), or a reason it needs a person. */
function mapLiteral(prop: string, v: string | number | true, ctx: Ctx): Mapped {
  if (v === true) return { human: `boolean ${prop}` }
  switch (prop) {
    case 'm':
    case 'mt':
    case 'mb':
    case 'ml':
    case 'mr':
    case 'mx':
    case 'my':
    case 'ms':
    case 'me':
      return spacing(prop, v, true)
    case 'p':
    case 'pt':
    case 'pb':
    case 'pl':
    case 'pr':
    case 'px':
    case 'py':
    case 'ps':
    case 'pe':
      return spacing(prop, v, false)
    case 'gap':
      return spacing('gap', v, false)
    case 'rowGap':
      return spacing('gap-y', v, false)
    case 'columnGap':
      return spacing('gap-x', v, false)
    case 'spacing':
      return spacing(ctx.hasVerticalSpacing ? 'gap-x' : 'gap', v, false)
    case 'verticalSpacing':
      return spacing('gap-y', v, false)
    case 'w':
      return size('w', v)
    case 'h':
      return size('h', v)
    case 'miw':
      return size('min-w', v)
    case 'maw':
      return size('max-w', v)
    case 'mih':
      return size('min-h', v)
    case 'mah':
      return size('max-h', v)
    case 'fw': {
      const key = String(v)
      if (LATENT_WEIGHT_NAMES.has(key)) return { human: `latent bug: fw="${key}" ${LATENT_WEIGHT}` }
      const cls = FONT_WEIGHT[key]
      return cls ? { cls } : { human: `font weight ${JSON.stringify(v)}` }
    }
    case 'size': {
      const cls = typeof v === 'string' ? FONT_SIZE[v] : undefined
      return cls
        ? { cls }
        : { human: `font size ${JSON.stringify(v)} is outside the closed v3 scale` }
    }
    case 'c':
    case 'bg':
      return { human: `colour ${JSON.stringify(v)} needs the v3 token-name map` }
    case 'ta':
      return oneOf(
        v,
        ['left', 'center', 'right', 'justify', 'start', 'end'],
        (s) => `text-${s}`,
        'ta',
      )
    case 'tt':
      return v === 'none'
        ? { cls: 'normal-case' }
        : oneOf(v, ['uppercase', 'lowercase', 'capitalize'], (s) => s, 'tt')
    case 'td':
      return v === 'none'
        ? { cls: 'no-underline' }
        : oneOf(v, ['underline', 'line-through'], (s) => s, 'td')
    case 'fs':
      return v === 'italic'
        ? { cls: 'italic' }
        : v === 'normal'
          ? { cls: 'not-italic' }
          : { human: `fs value ${JSON.stringify(v)}` }
    case 'ff':
      return v === 'monospace'
        ? { cls: 'font-mono' }
        : { human: `font family ${JSON.stringify(v)}` }
    case 'lh':
      return { human: 'line height is closed in v3: it comes with the text size' }
    case 'lts':
      return { human: 'letter spacing' }
    case 'pos':
      return oneOf(v, ['relative', 'absolute', 'fixed', 'sticky', 'static'], (s) => s, 'pos')
    case 'display':
      return v === 'none'
        ? { cls: 'hidden' }
        : oneOf(
            v,
            ['flex', 'block', 'inline', 'inline-block', 'grid', 'inline-flex'],
            (s) => s,
            'display',
          )
    case 'inset':
      return inset('inset', v)
    case 'top':
    case 'left':
    case 'right':
    case 'bottom':
      return inset(prop, v)
    case 'flex': {
      const s = String(v)
      return s === '1'
        ? { cls: 'flex-1' }
        : s === 'none'
          ? { cls: 'flex-none' }
          : s === 'auto'
            ? { cls: 'flex-auto' }
            : { human: `flex value ${JSON.stringify(v)}` }
    }
    case 'bdrs':
      return typeof v === 'string' && RADIUS[v]
        ? { cls: RADIUS[v]! }
        : { human: `radius ${JSON.stringify(v)}` }
    case 'opacity':
      return typeof v === 'number' && Number.isInteger(v * 100)
        ? { cls: `opacity-${v * 100}` }
        : { human: `opacity ${JSON.stringify(v)}` }
    case 'align': {
      const a = typeof v === 'string' ? ALIGN[v] : undefined
      return a ? { cls: `items-${a}` } : { human: `align ${JSON.stringify(v)}` }
    }
    case 'justify': {
      const j = typeof v === 'string' ? JUSTIFY[v] : undefined
      return j ? { cls: `justify-${j}` } : { human: `justify ${JSON.stringify(v)}` }
    }
    case 'wrap':
      return oneOf(v, ['nowrap', 'wrap', 'wrap-reverse'], (s) => `flex-${s}`, 'wrap')
    case 'direction':
      return oneOf(
        v,
        ['column', 'row', 'column-reverse', 'row-reverse'],
        (s) => (s.startsWith('column') ? `flex-col${s.slice(6)}` : `flex-${s}`),
        'direction',
      )
    case 'cols':
      return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 12
        ? { cls: `grid-cols-${v}` }
        : { human: `cols ${JSON.stringify(v)}` }
    default:
      return { human: `unmapped prop ${prop}` }
  }
}

function withPrefix(m: Mapped, prefix: string): Mapped {
  return 'cls' in m ? { cls: prefix + m.cls } : m
}

const PLAIN_TAG = /^[a-z][a-z0-9]*$/

/** Converts one target element's props. Any human item means the element stays as it is. */
export function convert(tag: string, props: Prop[]): Conversion {
  const out: Conversion = {
    tagName: tag === 'Text' ? 'p' : 'div',
    classes: [...BASE_CLASSES[tag]!],
    conds: [],
    human: [],
  }
  const ctx: Ctx = { tag, hasVerticalSpacing: props.some((p) => p.name === 'verticalSpacing') }
  const handled = new Map<string, Value>()
  const written = new Map<string, string>() // normalised name -> the prop as written in source
  const given = new Set(props.map((p) => p.name))

  for (const { name, value } of props) {
    if (isPassThrough(name)) continue
    if (tag === 'Text' && name === 'span' && value.kind === 'bool') {
      out.tagName = 'span'
    } else if (tag === 'Text' && name === 'truncate' && value.kind === 'bool') {
      out.classes.push('truncate')
    } else if (
      tag === 'Text' &&
      name === 'lineClamp' &&
      value.kind === 'lit' &&
      typeof value.v === 'number'
    ) {
      out.classes.push(`line-clamp-${value.v}`, 'text-ellipsis')
    } else if (
      name === 'component' &&
      value.kind === 'lit' &&
      typeof value.v === 'string' &&
      PLAIN_TAG.test(value.v)
    ) {
      out.tagName = value.v
    } else if (name === 'type' && tag === 'SimpleGrid') {
      out.human.push({
        prop: name,
        why: 'container-query grid: Tailwind @container variants use other breakpoints',
      })
    } else if (name === 'grow' || name === 'preventGrowOverflow') {
      out.human.push({ prop: name, why: 'Group grow needs per-child classes' })
    } else if (tag === 'Text' && name === 'fz') {
      if (given.has('size')) out.human.push({ prop: name, why: 'fz and size together' })
      else {
        handled.set('size', value)
        written.set('size', 'fz')
      }
    } else if (name === 'fz') {
      out.human.push({
        prop: name,
        why: `fz on ${tag}: Mantine sets font size only, Tailwind text-* also sets line height`,
      })
    } else if (STYLE_PROPS.has(name) || LAYOUT_PROPS[tag]!.has(name)) {
      handled.set(name, value)
    } else {
      out.human.push({ prop: name, why: `unsupported prop ${name}` })
    }
  }

  // Mantine's own defaults are emitted explicitly; a responsive map without `base` keeps the default there.
  const defaults = DEFAULTS[tag]!
  const ordered: [string, Value][] = []
  for (const [name, def] of Object.entries(defaults)) {
    const v = handled.get(name)
    if (!v) ordered.push([name, { kind: 'lit', v: def }])
    else if (v.kind === 'resp' && !('base' in v.map))
      ordered.push([name, { kind: 'resp', map: { base: def, ...v.map } }])
    else ordered.push([name, v])
    handled.delete(name)
  }
  for (const [name, v] of handled) ordered.push([name, v])

  // Text resets weight to regular; an explicit fw replaces that, otherwise it is always emitted.
  if (tag === 'Text' && !handled.has('fw')) out.classes.push('font-normal')

  for (const [name, value] of ordered) {
    const label = written.get(name) ?? name
    switch (value.kind) {
      case 'dyn':
        out.human.push({ prop: label, why: value.why })
        break
      case 'lit':
      case 'bool': {
        const m = mapLiteral(name, value.kind === 'bool' ? true : value.v, ctx)
        if ('human' in m) out.human.push({ prop: label, why: m.human })
        else out.classes.push(m.cls)
        break
      }
      case 'resp': {
        const parts: string[] = []
        for (const [bp, v] of Object.entries(value.map)) {
          const prefix = BREAKPOINT_PREFIX[bp]
          if (prefix === undefined) {
            out.human.push({
              prop: label,
              why: `breakpoint ${bp} has no v3 breakpoint of the same width`,
            })
            break
          }
          const m = withPrefix(mapLiteral(name, v, ctx), prefix)
          if ('human' in m) {
            out.human.push({ prop: label, why: m.human })
            break
          }
          parts.push(m.cls)
        }
        if (parts.length === Object.keys(value.map).length) out.classes.push(...parts)
        break
      }
      case 'cond': {
        const a = mapLiteral(name, value.a, ctx)
        const b = mapLiteral(name, value.b, ctx)
        if ('human' in a) out.human.push({ prop: label, why: a.human })
        else if ('human' in b) out.human.push({ prop: label, why: b.human })
        else out.conds.push({ test: value.test, a: a.cls, b: b.cls })
        break
      }
    }
  }
  return out
}
