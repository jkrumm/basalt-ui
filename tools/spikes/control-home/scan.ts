/**
 * The `control-home` predicate (controls-url-state.md section 9) as a standalone AST scan.
 * A JSX use of a control primitive with no lexical ancestor in the file among the homes is residue.
 * Residue is then judged: `fits a home` when its value already lives in a handle or a form field,
 * `waiver` when it is `useState`, plain props or nothing.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import MAP from './home-map.json' with { type: 'json' }

export type Source = 'form' | 'handle' | 'state' | 'props' | 'none'
export type Verdict = 'fits a home' | 'waiver'

export interface Site {
  file: string
  line: number
  tag: string
  primitive: string
  source: Source
  verdict: Verdict
  /** What the nearest enclosing component is; helps the table read. */
  component: string
}

export interface FileScan {
  controls: number
  inHome: number
  residue: Site[]
}

const CONTROL_MODULES = /^(@mantine\/(core|dates)|basalt-ui(\/.*)?)$/
const CONTROLS = new Map<string, string>([
  ...Object.entries(MAP.controls),
  ...Object.entries(MAP.controlsV3),
])
const HOMES = new Map<string, string>(Object.entries(MAP.homes))
const HANDLE_PROPS = new Set(MAP.handleProps)
/** A store hook: `.use(`, `useXStore(`, `useSearch(`, or a selector hook `usePhotos((s) => s.scope)`. */
const HANDLE_INIT =
  /\.use\(|\.useStore\(|use[A-Z]\w*Store\(|useSearch\(|\.field\b|\buseField|\bhandle\b|\bstore\b|\buse(?!Memo|Callback|Effect)[A-Z]\w*\(\s*(\(\s*\w+\s*\)|\w+)\s*=>/
const FORM_TEXT =
  /getInputProps|\binputProps\(|\bform\.(getValues|values|Field)|\bfield\.(state|handle)/

export function scratchCopy(root: string, dirs: readonly string[], into: string): string[] {
  const out: string[] = []
  for (const dir of dirs) {
    const dest = join(into, dir)
    mkdirSync(dest, { recursive: true })
    const r = spawnSync(
      'rsync',
      [
        '-a',
        '--exclude',
        'node_modules',
        '--exclude',
        '*.test.*',
        '--exclude',
        '*.spec.*',
        `${join(root, dir)}/`,
        `${dest}/`,
      ],
      { encoding: 'utf8' },
    )
    if (r.status !== 0) throw new Error(`rsync ${dir}: ${r.stderr}`)
    out.push(dest)
  }
  return out
}

export function listTsx(dir: string): string[] {
  const out: string[] = []
  const walk = (d: string): void => {
    for (const name of readdirSync(d).toSorted()) {
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(tsx|fixture\.txt)$/.test(name)) out.push(p)
    }
  }
  walk(dir)
  return out
}

export function hashId(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 8)
}

function tagName(n: ts.JsxOpeningLikeElement | ts.JsxClosingElement): string {
  return n.tagName.getText()
}

function importMap(sf: ts.SourceFile): Map<string, string> {
  const m = new Map<string, string>()
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue
    const mod = st.moduleSpecifier.text
    const clause = st.importClause
    if (!clause) continue
    if (clause.name) m.set(clause.name.text, mod)
    const nb = clause.namedBindings
    if (nb && ts.isNamedImports(nb)) {
      for (const el of nb.elements)
        m.set(el.name.text, `${mod}#${(el.propertyName ?? el.name).text}`)
    }
  }
  return m
}

/** The import-resolved primitive name of a JSX tag, or null when it is not a control. */
function controlOf(tag: string, imports: Map<string, string>): string | null {
  const root = tag.split('.')[0] ?? tag
  const from = imports.get(root)
  if (!from) return null
  const mod = from.split('#')[0] ?? ''
  if (!CONTROL_MODULES.test(mod)) return null
  const imported = from.split('#')[1] ?? root
  const key = tag.includes('.') ? `${imported}.${tag.split('.').slice(1).join('.')}` : imported
  return CONTROLS.get(key) ?? null
}

function isHomeTag(tag: string, imports: Map<string, string>): string | null {
  const root = tag.split('.')[0] ?? tag
  const home = HOMES.get(root)
  if (!home) return null
  // A local component of the same name is not the library home: only library imports count.
  const from = imports.get(root)
  if (!from) return null
  return CONTROL_MODULES.test(from.split('#')[0] ?? '') ? home : null
}

function paramHasHandle(fn: ts.SignatureDeclarationBase): boolean {
  const p = fn.parameters[0]
  if (!p) return false
  if (ts.isObjectBindingPattern(p.name)) {
    for (const el of p.name.elements) {
      const n = (el.propertyName ?? el.name).getText()
      if (HANDLE_PROPS.has(n)) return true
    }
  }
  const t = p.type
  if (t && ts.isTypeLiteralNode(t)) {
    return t.members.some((m) => m.name !== undefined && HANDLE_PROPS.has(m.name.getText()))
  }
  return false
}

/** Is any ancestor of `node` a home? Returns the home name, or null. */
function homeOf(node: ts.Node, imports: Map<string, string>): string | null {
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if (ts.isJsxElement(p)) {
      const h = isHomeTag(tagName(p.openingElement), imports)
      if (h) return h
    }
    if (ts.isFunctionLike(p) && 'parameters' in p) {
      // A render handed to `filterSlot.custom(handle, label, render)`.
      const call = p.parent
      if (call && ts.isCallExpression(call) && call.expression.getText() === MAP.customRender) {
        return MAP.customRender
      }
      if (paramHasHandle(p as ts.SignatureDeclarationBase)) return 'handle-bound composite'
    }
  }
  return null
}

function enclosingComponent(node: ts.Node): string {
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if (ts.isFunctionDeclaration(p) && p.name) return p.name.text
    if (
      ts.isVariableDeclaration(p) &&
      p.initializer &&
      ts.isFunctionLike(p.initializer) &&
      ts.isIdentifier(p.name)
    ) {
      return p.name.text
    }
  }
  return '(module)'
}

/** Walk outward to the declaration of `name`, or null. */
function declOf(
  name: string,
  from: ts.Node,
): ts.VariableDeclaration | ts.ParameterDeclaration | null {
  for (let p: ts.Node | undefined = from; p; p = p.parent) {
    let found: ts.VariableDeclaration | ts.ParameterDeclaration | null = null
    const visit = (n: ts.Node): void => {
      if (found) return
      if (ts.isFunctionLike(n) && n !== p) return
      if ((ts.isVariableDeclaration(n) || ts.isParameter(n)) && bindsName(n.name, name)) {
        found = n
        return
      }
      ts.forEachChild(n, visit)
    }
    if (ts.isFunctionLike(p) || ts.isSourceFile(p) || ts.isBlock(p)) {
      if (ts.isFunctionLike(p)) for (const prm of p.parameters) visit(prm)
      ts.forEachChild(p, visit)
    }
    if (found) return found
  }
  return null
}

function bindsName(b: ts.BindingName, name: string): boolean {
  if (ts.isIdentifier(b)) return b.text === name
  return b.elements.some((e) => !ts.isOmittedExpression(e) && bindsName(e.name, name))
}

function idents(e: ts.Node): string[] {
  const out: string[] = []
  const visit = (n: ts.Node): void => {
    if (ts.isIdentifier(n) && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n))
      out.push(n.text)
    ts.forEachChild(n, visit)
  }
  visit(e)
  return out
}

function sourceOfExpr(e: ts.Expression, at: ts.Node, depth = 0): Source {
  const text = e.getText()
  if (FORM_TEXT.test(text)) return 'form'
  if (/\.use\(|\.field\./.test(text)) return 'handle'
  let best: Source = 'none'
  for (const id of idents(e)) {
    const d = declOf(id, at)
    if (!d) continue
    if (ts.isParameter(d)) {
      best = best === 'none' ? 'props' : best
      continue
    }
    const init = d.initializer
    if (!init) continue
    const it = init.getText()
    if (/\buse(State|Reducer|Ref)\b/.test(it)) return 'state'
    if (FORM_TEXT.test(it) || /\buseForm\(|\buseFormContext\(/.test(it)) return 'form'
    if (HANDLE_INIT.test(it)) return 'handle'
    // Derived from another binding: follow one hop.
    if (depth < 2 && !ts.isArrowFunction(init)) {
      const s = sourceOfExpr(init, at, depth + 1)
      if (s !== 'none') return s
    }
    // Destructured from props: `const { x } = props`
    if (ts.isObjectBindingPattern(d.name) && ts.isIdentifier(init)) best = 'props'
  }
  return best
}

export function sourceOfControl(el: ts.JsxOpeningLikeElement): Source {
  let best: Source = 'none'
  for (const a of el.attributes.properties) {
    if (ts.isJsxSpreadAttribute(a)) {
      const s = sourceOfExpr(a.expression, el)
      if (s === 'form' || s === 'handle') return s
      continue
    }
    const n = a.name.getText()
    if (n !== 'value' && n !== 'checked' && n !== 'defaultValue' && n !== 'defaultChecked') continue
    if (!a.initializer || !ts.isJsxExpression(a.initializer) || !a.initializer.expression) continue
    const s = sourceOfExpr(a.initializer.expression, el)
    if (s === 'form' || s === 'handle' || s === 'state') return s
    if (s === 'props') best = 'props'
  }
  return best
}

export function scanFile(abs: string, rootDir: string): FileScan {
  const text = readFileSync(abs, 'utf8')
  const sf = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const imports = importMap(sf)
  const out: FileScan = { controls: 0, inHome: 0, residue: [] }
  const visit = (n: ts.Node): void => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = tagName(n)
      const primitive = controlOf(tag, imports)
      if (primitive) {
        out.controls += 1
        const anchor = ts.isJsxOpeningElement(n) ? n.parent : n
        const home = homeOf(anchor, imports)
        const source = sourceOfControl(n)
        // A `filterSlot.custom` closure that keeps the value in `useState` has no handle: flagged.
        if (home && !(home === MAP.customRender && source === 'state')) out.inHome += 1
        else {
          out.residue.push({
            file: relative(rootDir, abs),
            line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
            tag,
            primitive,
            source,
            verdict: source === 'form' || source === 'handle' ? 'fits a home' : 'waiver',
            component: enclosingComponent(n),
          })
        }
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

export function scanDirs(dirs: readonly string[], rootDir: string): { files: number } & FileScan {
  const total: { files: number } & FileScan = { files: 0, controls: 0, inHome: 0, residue: [] }
  for (const d of dirs) {
    for (const f of listTsx(d)) {
      const r = scanFile(f, rootDir)
      total.files += 1
      total.controls += r.controls
      total.inHome += r.inHome
      total.residue.push(...r.residue)
    }
  }
  return total
}
