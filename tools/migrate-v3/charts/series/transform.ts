// The series half of the chart codemods: series-field renames, StackedArea, `marks`, Meter zones and the
// 1.x Bars props (docs/v3/concepts/charts-cards-kanban.md section 10). One parse, text edits applied at
// the end, so a flag carries the line of the source as it was read. A site that cannot be rewritten
// mechanically is left untouched and listed under `series-review`; the flag-only rows rewrite nothing.
import { Project, ScriptKind, SyntaxKind, ts } from 'ts-morph'
import type {
  ArrayLiteralExpression,
  JsxAttribute,
  JsxOpeningElement,
  JsxSelfClosingElement,
  Node,
  ObjectLiteralExpression,
} from 'ts-morph'
import type { Flag, Report } from '../report.ts'
import { SERIES_REWRITE_ROWS } from './rows.ts'

export type SeriesOptions = { file: string }
export type SeriesResult = Report & { text: string }

type Edit = { start: number; end: number; text: string }
type Opening = JsxOpeningElement | JsxSelfClosingElement
type Plan = { adds: string[]; skipOpacity: boolean }

const project = new Project({
  useInMemoryFileSystem: true,
  skipAddingFilesFromTsConfig: true,
  compilerOptions: { jsx: ts.JsxEmit.Preserve },
})

const isBasalt = (specifier: string) =>
  specifier === 'basalt-ui' || specifier.startsWith('basalt-ui/')

/** Component or helper imported from basalt-ui that is only flagged. */
const FLAG_TAGS: Record<string, string> = {
  StatStrip: 'statstrip-statcell',
  StatStripCell: 'statstrip-statcell',
  WidgetHeader: 'statstrip-statcell',
  Donut: 'donut',
  MirroredBars: 'mirrored-bars',
  DualPanel: 'dual-panel',
}
const FLAG_HELPERS: Record<string, string> = { chartCurve: 'chart-curve', foldBands: 'fold-bands' }
const FLAG_REASONS: Record<string, string> = {
  'statstrip-statcell': 'StatStrip, StatStripCell and WidgetHeader become StatCell by hand',
  donut: 'Donut has no codemod: single value is a Ring, slices are a BarList with max = total',
  'mirrored-bars': 'MirroredBars is a two-pane recipe in v3',
  'dual-panel': 'DualPanel is a two-pane recipe in v3',
  'chart-curve': 'chartCurve becomes series.curve, and plot.curve in custom marks',
  'fold-bands': 'foldBands is internal to BandStrip in v3',
}
const AUTO_DOMAIN = new Set(['autoMaxFloor', 'autoMinCeil', 'autoPad'])
/** Zone colours that map to a v3 tone. */
const TONE_COLOR = /status[-.](good|warn|bad|neutral)\b/i
/** 1.x Bars props with no known v3 spelling: left in place and flagged. */
const BARS_1X_LEFT = ['xTickValues', 'xLabelRotate', 'cursorResolution', 'barWidthRatio']

function unwrap(node: Node): Node {
  let n = node
  while (n.isKind(SyntaxKind.ParenthesizedExpression)) n = n.getExpression()
  return n
}

function propName(p: Node): string | undefined {
  if (p.isKind(SyntaxKind.PropertyAssignment) || p.isKind(SyntaxKind.ShorthandPropertyAssignment))
    return p.getName()
  return undefined
}

function attrOf(el: Opening, name: string): JsxAttribute | undefined {
  for (const a of el.getAttributes())
    if (a.isKind(SyntaxKind.JsxAttribute) && a.getNameNode().getText() === name) return a
  return undefined
}

function attrExpression(attr: JsxAttribute): Node | undefined {
  const init = attr.getInitializer()
  if (!init?.isKind(SyntaxKind.JsxExpression)) return undefined
  const e = init.getExpression()
  return e ? unwrap(e) : undefined
}

function arrayOf(attr: JsxAttribute | undefined): ArrayLiteralExpression | undefined {
  const e = attr ? attrExpression(attr) : undefined
  return e?.isKind(SyntaxKind.ArrayLiteralExpression) ? e : undefined
}

function objectsOf(arr: ArrayLiteralExpression): ObjectLiteralExpression[] | undefined {
  const out: ObjectLiteralExpression[] = []
  for (const el of arr.getElements()) {
    if (!el.isKind(SyntaxKind.ObjectLiteralExpression)) return undefined
    out.push(el)
  }
  return out
}

function nameSet(obj: ObjectLiteralExpression): Set<string> {
  return new Set(obj.getProperties().flatMap((p) => propName(p) ?? []))
}

function propOf(obj: ObjectLiteralExpression, name: string): Node | undefined {
  return obj.getProperties().find((p) => propName(p) === name)
}

function initializerOf(p: Node): Node | undefined {
  return p.isKind(SyntaxKind.PropertyAssignment) ? p.getInitializer() : undefined
}

/** A series: the three fields every series states. */
function isSeriesObject(obj: ObjectLiteralExpression): boolean {
  const names = nameSet(obj)
  return names.has('key') && names.has('label') && names.has('color')
}

function isFunction(n: Node): boolean {
  return n.isKind(SyntaxKind.ArrowFunction) || n.isKind(SyntaxKind.FunctionExpression)
}

export function transformSeries(source: string, { file }: SeriesOptions): SeriesResult {
  const out: SeriesResult = {
    text: source,
    rewritten: Object.fromEntries(SERIES_REWRITE_ROWS.map((id) => [id, 0])),
    flagged: [],
  }
  if (!source.includes('basalt-ui')) return out

  const sf = project.createSourceFile('series.tsx', source, {
    overwrite: true,
    scriptKind: ScriptKind.TSX,
  })
  /** local name -> imported name, for imports from basalt-ui */
  const locals = new Map<string, string>()
  for (const decl of sf.getImportDeclarations()) {
    if (!isBasalt(decl.getModuleSpecifierValue())) continue
    for (const n of decl.getNamedImports())
      locals.set(n.getAliasNode()?.getText() ?? n.getName(), n.getName())
  }
  if (locals.size === 0) return out

  const edits: Edit[] = []
  const count = (id: string) => (out.rewritten[id] = (out.rewritten[id] ?? 0) + 1)
  const flag = (row: string, node: Node, reason: string) =>
    out.flagged.push({ row, file, line: node.getStartLineNumber(), reason } satisfies Flag)
  const review = (row: string, node: Node, reason: string) =>
    flag('series-review', node, `${row}: ${reason}; the site is left untouched`)
  const replace = (node: Node, text: string) =>
    edits.push({ start: node.getStart(), end: node.getEnd(), text })
  const removeAttr = (attr: Node) =>
    edits.push({ start: attr.getFullStart(), end: attr.getEnd(), text: '' })

  /** The range that drops a property with its comma, and the line when nothing else is on it. */
  function removalRange(prop: Node): Edit {
    let start = prop.getStart()
    let end = prop.getEnd()
    let after = end
    while (source[after] === ' ' || source[after] === '\t') after++
    if (source[after] === ',') {
      end = after + 1
    } else {
      let before = start
      while (before > 0 && /\s/.test(source[before - 1] ?? '')) before--
      if (source[before - 1] === ',') start = before - 1
    }
    let lineStart = start
    while (lineStart > 0 && (source[lineStart - 1] === ' ' || source[lineStart - 1] === '\t'))
      lineStart--
    let lineEnd = end
    while (source[lineEnd] === ' ' || source[lineEnd] === '\t') lineEnd++
    if (source[lineStart - 1] === '\n' && source[lineEnd] === '\n') {
      start = lineStart
      end = lineEnd + 1
    }
    return { start, end, text: '' }
  }

  /** Appends `items` after the last property that stays. */
  function insertAfterLast(obj: ObjectLiteralExpression, removed: Set<Node>, items: string[]) {
    if (items.length === 0) return
    const kept = obj.getProperties().filter((p) => !removed.has(p))
    const last = kept[kept.length - 1]
    if (!last) return
    // Anchored at the end of the last kept property, before its own comma: a dropped property after it
    // may take that comma into its removal range, and the two edits then meet at one offset.
    const at = last.getEnd()
    if (obj.getText().includes('\n')) {
      const lineStart = source.lastIndexOf('\n', last.getStart()) + 1
      const indent = /^[ \t]*/.exec(source.slice(lineStart))?.[0] ?? ''
      const lines = items.map((i) => `\n${indent}${i}`).join(',')
      edits.push({ start: at, end: at, text: `,${lines}` })
      return
    }
    edits.push({ start: at, end: at, text: `, ${items.join(', ')}` })
  }

  // ---- elements: plan the series objects they own, rewrite the element itself ----
  const plans = new Map<ObjectLiteralExpression, Plan>()
  let rewroteStacked = false
  let blockedStacked = false
  /** Series objects of a site that is left untouched. */
  const skipped = new Set<ObjectLiteralExpression>()
  const openings: Opening[] = [
    ...sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ]

  for (const el of openings) {
    const tag = el.getTagNameNode()
    const imported = tag.isKind(SyntaxKind.Identifier) ? locals.get(tag.getText()) : undefined
    if (!imported) continue
    const local = tag.getText()

    const flagTag = FLAG_TAGS[imported]
    if (flagTag) {
      flag(flagTag, el, FLAG_REASONS[flagTag] ?? imported)
      continue
    }
    if (imported === 'DeltaBadge') {
      const hasPolarity = el
        .getAttributes()
        .some(
          (a) =>
            a.isKind(SyntaxKind.JsxSpreadAttribute) ||
            (a.isKind(SyntaxKind.JsxAttribute) && a.getNameNode().getText() === 'polarity'),
        )
      if (!hasPolarity)
        flag(
          'deltabadge-polarity',
          el,
          'polarity is required in v3 (a compile error on purpose); never guess up-good',
        )
      continue
    }

    if (imported === 'StackedArea') {
      const arr = arrayOf(attrOf(el, 'series'))
      const bands = arr ? objectsOf(arr) : undefined
      if (!bands || !arr) {
        blockedStacked = true
        review('stacked-area', el, 'series is not an array literal of objects')
        continue
      }
      const blocker =
        attrOf(el, 'fillOpacity') ??
        bands.find(
          (b) =>
            propOf(b, 'fillOpacity') ??
            propOf(b, 'mark') ??
            propOf(b, 'stack') ??
            propOf(b, 'area'),
        )
      if (blocker) {
        blockedStacked = true
        for (const b of bands) skipped.add(b)
        review(
          'stacked-area',
          el,
          'fillOpacity, mark, stack or area is set; a band opacity has no line equivalent',
        )
        continue
      }
      for (const b of bands)
        plans.set(b, { adds: ["mark: 'line'", "stack: 'area'", "area: 'fade'"], skipOpacity: true })
      replace(tag, 'Lines')
      const parent = el.getParent()
      if (parent?.isKind(SyntaxKind.JsxElement))
        replace(parent.getClosingElement().getTagNameNode(), 'Lines')
      rewroteStacked = true
      count('stacked-area')
      continue
    }

    if (imported === 'CartesianChart') {
      const attr = attrOf(el, 'marks')
      const expr = attr ? attrExpression(attr) : undefined
      if (!expr || /^[\w$.]+\.custom\(/.test(expr.getText())) continue
      replace(expr, `${local}.custom(${expr.getText()})`)
      count('chart-marks')
      continue
    }

    if (imported === 'Meter') {
      meterZones(el)
      continue
    }

    if (imported === 'Bars' && attrOf(el, 'positiveBars')) bars1x(el, plans)
  }

  function meterZones(el: Opening) {
    const attr = attrOf(el, 'zones')
    if (!attr) return
    const arr = arrayOf(attr)
    // Not a literal: a v3 Meter looks the same, so there is nothing to say about it.
    const zones = arr ? objectsOf(arr) : undefined
    if (!zones) return
    if (!zones.some((z) => propOf(z, 'from'))) return
    const texts: string[] = []
    let previousTo: string | undefined
    for (const [index, zone] of zones.entries()) {
      const names = nameSet(zone)
      const stray = [...names].find((n) => !['from', 'to', 'label', 'tone', 'color'].includes(n))
      if (stray) return review('meter-zones', el, `a zone sets ${stray}, which v3 has no field for`)
      const from = initializerOf(propOf(zone, 'from') ?? zone)
      const to = initializerOf(propOf(zone, 'to') ?? zone)
      const label = initializerOf(propOf(zone, 'label') ?? zone)
      if (!from || !to || !label || from === zone || to === zone || label === zone)
        return review('meter-zones', el, 'a zone lacks a literal from, to or label')
      if (index > 0 && from.getText() !== previousTo)
        return review(
          'meter-zones',
          el,
          'zones are not contiguous; v3 zones end at `to` and start at the previous `to`',
        )
      previousTo = to.getText()
      const color = initializerOf(propOf(zone, 'color') ?? zone)
      const tone = initializerOf(propOf(zone, 'tone') ?? zone)
      let toneName = 'neutral'
      if (color && color !== zone) {
        const m = TONE_COLOR.exec(color.getText())
        if (!m) return review('meter-zones', el, `the zone colour ${color.getText()} has no tone`)
        toneName = m[1]!.toLowerCase()
      } else if (tone && tone !== zone && !/^['"]muted['"]$/.test(tone.getText())) {
        return review('meter-zones', el, `the zone tone ${tone.getText()} has no v3 spelling`)
      }
      texts.push(`{ to: ${to.getText()}, tone: '${toneName}', label: ${label.getText()} }`)
    }
    for (const [i, zone] of zones.entries()) replace(zone, texts[i]!)
    count('meter-zones')
  }

  function bars1x(el: Opening, planned: Map<ObjectLiteralExpression, Plan>) {
    const getX = attrOf(el, 'getX')
    const getValue = attrOf(el, 'getValue')
    const positive = attrOf(el, 'positiveBars')!
    if (!getX || !getValue) return review('bars-1x', el, 'getX or getValue is missing')
    const blocked = ['negativeBars', 'lines'].find((n) => attrOf(el, n))
    if (blocked) return review('bars-1x', el, `${blocked} has no mechanical rewrite`)
    if (el.getAttributes().some((a) => a.isKind(SyntaxKind.JsxSpreadAttribute)))
      return review('bars-1x', el, 'a spread attribute may carry 1.x props')
    const bars = arrayOf(positive) ? objectsOf(arrayOf(positive)!) : undefined
    if (!bars) return review('bars-1x', el, 'positiveBars is not an array literal of objects')
    const xFn = attrExpression(getX)
    const valueFn = attrExpression(getValue)
    if (!xFn) return review('bars-1x', el, 'getX is not an expression')
    if (
      !valueFn ||
      !(
        valueFn.isKind(SyntaxKind.Identifier) || valueFn.isKind(SyntaxKind.PropertyAccessExpression)
      )
    )
      return review(
        'bars-1x',
        el,
        'getValue is not a named function; inline it into each series y by hand',
      )
    const arg = valueFn.getText() === 'd' ? 'row' : 'd'
    const adds = new Map<ObjectLiteralExpression, string[]>()
    for (const bar of bars) {
      const key = initializerOf(propOf(bar, 'key') ?? bar)
      if (!key || key === bar) return review('bars-1x', el, 'a bar has no key')
      if (propOf(bar, 'weight') ?? propOf(bar, 'mark') ?? propOf(bar, 'y'))
        return review('bars-1x', el, 'a bar sets weight, mark or y, which v3 reads differently')
      adds.set(bar, [
        "mark: 'bar'",
        `y: (${arg}) => ${valueFn.getText()}(${arg}, ${key.getText()})`,
      ])
    }
    for (const [bar, items] of adds) planned.set(bar, { adds: items, skipOpacity: false })

    const formatX = attrOf(el, 'formatX')
    const formatExpr = formatX ? attrExpression(formatX) : undefined
    if (formatX && !formatExpr) return review('bars-1x', el, 'formatX is not an expression')
    replace(
      getX,
      `x={{ value: ${xFn.getText()}${formatExpr ? `, format: ${formatExpr.getText()}` : ''} }}`,
    )
    removeAttr(getValue)
    if (formatX) removeAttr(formatX)
    replace(positive.getNameNode(), 'series')
    const chartId = attrOf(el, 'chartId')
    if (chartId) replace(chartId.getNameNode(), 'cursor')
    const ticks = attrOf(el, 'xTicks')
    if (ticks) {
      removeAttr(ticks)
      flag(
        'series-review',
        ticks,
        'bars-1x: xTicks has no v3 field and was dropped; ticks are automatic',
      )
    }
    for (const name of BARS_1X_LEFT) {
      const a = attrOf(el, name)
      if (a)
        flag('series-review', a, `bars-1x: ${name} has no known v3 spelling and was left in place`)
    }
    count('bars-1x')
  }

  // ---- objects: series fields, zone and ref-line axis, auto-domain flags ----
  const owned = new Set<ObjectLiteralExpression>()
  for (const el of openings) {
    const tag = el.getTagNameNode()
    if (!tag.isKind(SyntaxKind.Identifier) || !locals.has(tag.getText())) continue
    for (const name of ['zones', 'refLines']) {
      const arr = arrayOf(attrOf(el, name))
      if (arr) for (const o of objectsOf(arr) ?? []) owned.add(o)
    }
  }

  for (const obj of sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
    for (const p of obj.getProperties()) {
      const name = propName(p)
      if (name && AUTO_DOMAIN.has(name))
        flag('sf-auto-domain', p, `${name} becomes y.domain by hand (floor, ceil, pad)`)
    }
    if (skipped.has(obj)) continue
    if (isSeriesObject(obj)) seriesObject(obj, plans.get(obj) ?? { adds: [], skipOpacity: false })
    else if (owned.has(obj)) renameField(obj, 'axisSide', 'axis', 'sf-axis')
    else if (plans.has(obj)) seriesObject(obj, plans.get(obj)!)
  }

  function renameField(
    obj: ObjectLiteralExpression,
    from: string,
    to: string,
    row: string,
    wrap = false,
  ): boolean {
    const prop = propOf(obj, from)
    if (!prop) return false
    if (propOf(obj, to)) {
      review(row, prop, `${from} and ${to} are both set`)
      return false
    }
    if (prop.isKind(SyntaxKind.ShorthandPropertyAssignment)) {
      replace(prop, `${to}: ${wrap ? '() => ' : ''}${from}`)
    } else if (prop.isKind(SyntaxKind.PropertyAssignment)) {
      replace(prop.getNameNode(), to)
      const init = prop.getInitializer()
      if (wrap && init && !isFunction(init)) replace(init, `() => ${init.getText()}`)
    }
    count(row)
    return true
  }

  function seriesObject(obj: ObjectLiteralExpression, plan: Plan) {
    const removed = new Set<Node>()
    const drop = (prop: Node) => {
      removed.add(prop)
      edits.push(removalRange(prop))
    }

    renameField(obj, 'formatValue', 'format', 'sf-format')
    renameField(obj, 'axisSide', 'axis', 'sf-axis')
    if (!plan.skipOpacity) renameField(obj, 'fillOpacity', 'opacity', 'sf-opacity', true)

    // dash
    const dashed = propOf(obj, 'dashed')
    if (dashed) {
      const init = initializerOf(dashed)
      if (propOf(obj, 'dash')) review('sf-dash', dashed, 'dashed and dash are both set')
      else if (init?.getKind() === SyntaxKind.FalseKeyword) {
        drop(dashed)
        count('sf-dash')
      } else renameField(obj, 'dashed', 'dash', 'sf-dash')
    }
    const dash = propOf(obj, 'dash')
    const dashInit = dash ? initializerOf(dash) : undefined
    if (dash && dashInit) {
      const value = dashInit.isKind(SyntaxKind.StringLiteral)
        ? dashInit.getLiteralValue()
        : undefined
      if (value === 'dashed') {
        replace(dashInit, 'true')
        count('sf-dash')
      } else if (value === 'solid') {
        drop(dash)
        count('sf-dash')
      } else if (dashInit.isKind(SyntaxKind.ConditionalExpression)) {
        const whenTrue = unwrap(dashInit.getWhenTrue())
        const whenFalse = unwrap(dashInit.getWhenFalse())
        const lit = (n: Node) =>
          n.isKind(SyntaxKind.StringLiteral) ? n.getLiteralValue() : undefined
        const cond = dashInit.getCondition().getText()
        if (lit(whenTrue) === 'dashed' && lit(whenFalse) === 'solid') {
          replace(dashInit, cond)
          count('sf-dash')
        } else if (lit(whenTrue) === 'solid' && lit(whenFalse) === 'dashed') {
          replace(dashInit, `!(${cond})`)
          count('sf-dash')
        }
      }
    }

    // weight: strokeWidth and strokeOpacity share one closed scale
    const width = propOf(obj, 'strokeWidth')
    const opacity = propOf(obj, 'strokeOpacity')
    if (width || opacity) {
      const classify = (p: Node, kind: string): string => {
        const init = initializerOf(p)
        if (!init?.isKind(SyntaxKind.NumericLiteral)) return `${kind} is not a number literal`
        const n = Number(init.getText())
        if (n < 1.5) return 'quiet'
        if (n > 2) return 'strong'
        return `${kind} ${n} is between 1.5 and 2`
      }
      const verdicts = [
        width ? classify(width, 'strokeWidth') : undefined,
        opacity ? classify(opacity, 'strokeOpacity') : undefined,
      ].filter((v): v is string => v !== undefined)
      const bad = verdicts.find((v) => v !== 'quiet' && v !== 'strong')
      const anchor = (width ?? opacity)!
      if (propOf(obj, 'weight')) review('sf-weight', anchor, 'weight is already set')
      else if (bad) review('sf-weight', anchor, bad)
      else if (new Set(verdicts).size > 1)
        review('sf-weight', anchor, 'strokeWidth and strokeOpacity point to different weights')
      else {
        replace(anchor, `weight: '${verdicts[0]}'`)
        if (width && opacity) drop(opacity)
        count('sf-weight')
      }
    }

    insertAfterLast(obj, removed, plan.adds)
  }

  // ---- identifiers: helpers that are only flagged ----
  for (const id of sf.getDescendantsOfKind(SyntaxKind.Identifier)) {
    const imported = locals.get(id.getText())
    const row = imported ? FLAG_HELPERS[imported] : undefined
    if (!row) continue
    const parent = id.getParent()
    if (parent?.isKind(SyntaxKind.ImportSpecifier)) continue
    if (parent?.isKind(SyntaxKind.PropertyAccessExpression) && parent.getNameNode() === id) continue
    if (parent?.isKind(SyntaxKind.PropertyAssignment) && parent.getNameNode() === id) continue
    flag(row, id, FLAG_REASONS[row] ?? imported!)
  }

  if (edits.length === 0) return out
  let text = source
  let floor = Number.POSITIVE_INFINITY
  for (const e of edits.toSorted((a, b) => b.start - a.start || b.end - a.end)) {
    if (e.end > floor) {
      // Two removals that touch (adjacent properties): the later one only widens the cut.
      if (e.text !== '') throw new Error(`overlapping edits at ${file}:${e.start}`)
      text = text.slice(0, e.start) + text.slice(floor)
      floor = e.start
      continue
    }
    text = text.slice(0, e.start) + e.text + text.slice(e.end)
    floor = e.start
  }
  out.text = rewroteStacked ? fixStackedAreaImports(text, !blockedStacked) : text
  return out
}

/** A rewritten site uses `Lines`: it is imported, and `StackedArea` goes once no site still needs it. */
function fixStackedAreaImports(text: string, dropStacked: boolean): string {
  const sf = project.createSourceFile('imports.tsx', text, {
    overwrite: true,
    scriptKind: ScriptKind.TSX,
  })
  const decls = sf.getImportDeclarations().filter((d) => isBasalt(d.getModuleSpecifierValue()))
  const hasLines = decls.some((d) =>
    d.getNamedImports().some((n) => n.getName() === 'Lines' && !n.getAliasNode()),
  )
  const home = decls.find((d) => d.getNamedImports().some((n) => n.getName() === 'StackedArea'))
  if (!home) return text
  if (!hasLines) home.addNamedImport('Lines')
  if (dropStacked)
    for (const n of home.getNamedImports()) if (n.getName() === 'StackedArea') n.remove()
  if (home.getNamedImports().length === 0 && !home.getDefaultImport() && !home.getNamespaceImport())
    home.remove()
  return sf.getFullText()
}
