/**
 * The two detectors the class family cannot express as one pattern: the JS media-query form of
 * `viewport-keyed` (an AST form) and the profile gate for `tw-off-law` forms that exist only from
 * `parts` upward (guardrails section 4, row 6: "(b, c, h) parts+; rest bridge+").
 */
import type { FormContext, Node, Visitor } from '../../factory'
import {
  CLASS_CALLEES,
  classStringVisitor,
  classTokens,
  mergeVisitors,
  topLevelConsts,
} from '../../factory'
import type { AstForm, ClassForm } from '../../rule-table'

/** Calls whose first argument is a media query string. */
const QUERY_CALLEES: ReadonlySet<string> = new Set(['matchMedia', 'useMediaQuery'])

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as Node).type === 'string'

const field = (node: Node, key: string): Node | undefined => {
  const value = node[key]
  return isNode(value) ? value : undefined
}

/** `matchMedia(..)`, `window.matchMedia(..)` and `useMediaQuery(..)` by their final name. */
function calleeName(call: Node): string | undefined {
  const callee = field(call, 'callee')
  if (callee?.type === 'Identifier') return callee['name'] as string
  if (callee?.type === 'MemberExpression' && callee['computed'] !== true) {
    const property = field(callee, 'property')
    return property?.type === 'Identifier' ? (property['name'] as string) : undefined
  }
  return undefined
}

/** The literal text of a string or template argument; any other argument is open (undefined). */
function literalText(arg: Node | undefined): string | undefined {
  if (arg?.type === 'Literal') return typeof arg['value'] === 'string' ? arg['value'] : undefined
  if (arg?.type !== 'TemplateLiteral') return undefined
  const quasis = Array.isArray(arg['quasis']) ? arg['quasis'].filter(isNode) : []
  return quasis
    .map((quasi) => {
      const value = quasi['value'] as { cooked?: string | null; raw: string }
      return value.cooked ?? value.raw
    })
    .join('${}')
}

/**
 * `viewport-keyed`, JS form: a media query whose literal text names a `width`, or the viewport
 * width read against a number (`window.innerWidth < 768`; an element's `clientWidth` is container-keyed). Reduced-motion,
 * colour-scheme and pointer queries are not viewport-keyed; a non-literal argument stays open
 * (S2: 8 of 28 hits remain once narrowed, all true). A top-level `const` string or number
 * (`useMediaQuery(MOBILE_QUERY)`, `window.innerWidth < BREAKPOINT`) is read as its literal.
 *
 * A window-size hook (`useWindowSize` of usehooks-ts, `@uidotdev/usehooks` or `react-use`) is
 * tied by name: its `width` read against a number reports, as `useWindowSize().width`, through a
 * binding (`const size = useWindowSize()` then `size.width`) or a destructure (`const { width } =
 * useWindowSize()`, renamed or not). A bare `width` from anywhere else is a chart's plot width and
 * passes. The hook is also read under an alias (`import { useWindowSize as useSize }`), and
 * `screen.width` (`window.screen.width`, `screen.availWidth`) is the device width, read like
 * `innerWidth`, as is the visual viewport's (`window.visualViewport?.width ?? 0`). react-responsive's object query reads as its string: a `maxWidth`, `minWidth` (or
 * their device forms) key, or a `query` whose literal text names a width. Known limits: the height
 * is not read (as `window.innerHeight` is not), and a binding is matched by spelling within the
 * file, not by scope.
 *
 * A media query string is read for the features the class forms and the stylelint list ban: width,
 * height, aspect ratio, orientation and the device forms. A user-agent test is a viewport guess:
 * `/Mobi/i.test(navigator.userAgent)` and `navigator.userAgent.includes(..)` (`match`, `indexOf`,
 * `search`, `startsWith`, `endsWith`) report, as does the client-hints flag
 * `navigator.userAgentData.mobile` (through `?.`, a TS cast or `!` on `navigator`, bound to a
 * `const` or destructured from `userAgentData`) where it chooses a value: a conditional, `&&`, a
 * JSX branch, a return; passed as data (an object literal's value, a call's argument:
 * `track('open', { mobile })`) it is analytics and passes. `isMobile` and `isTablet` imported from
 * `react-device-detect` report where they are read. Known limits: a user agent copied into a
 * variable first (`const ua = navigator.userAgent`) is not followed, and `isMobileOnly`, `isIOS`
 * and the other flags are not read. A test whose literal pattern names platforms only, a desktop
 * one among them (`/Mac|iPhone|iPad/`, `.includes('Win')`), picks a shortcut glyph, not a layout:
 * it is `platform-glyph`'s, below, and this form leaves it.
 */
const HINT = 'navigator.userAgentData.mobile'

export function mediaQueryForm({ report }: FormContext): Visitor {
  let consts: ReadonlyMap<string, Node> = new Map()
  const resolve = (node: Node | undefined): Node | undefined =>
    node?.type === 'Identifier' ? (consts.get(node['name'] as string) ?? node) : node
  const sizes: WindowSizes = { objects: new Set(), widths: new Set(), hooks: new Set() }
  const deviceFlags = new Map<string, string>()
  /** Names bound to the client-hints mobile flag, whole or destructured. */
  const hints = new Set<string>()
  const skip = new WeakSet<Node>()
  return {
    Program(node) {
      consts = topLevelConsts(node)
    },
    ImportDeclaration(node) {
      if (field(node, 'source')?.['value'] !== DEVICE_DETECT) return
      for (const specifier of nodesOf(node, 'specifiers')) {
        const importedNode = field(specifier, 'imported')
        if (importedNode !== undefined) skip.add(importedNode)
        const imported = nameOf(importedNode)
        const local = field(specifier, 'local')
        if (imported === undefined || !DEVICE_FLAGS.has(imported)) continue
        const name = nameOf(local)
        if (name !== undefined && local !== undefined) {
          deviceFlags.set(name, imported)
          skip.add(local)
        }
      }
    },
    MemberExpression(node) {
      const property = field(node, 'property')
      if (property !== undefined && node['computed'] !== true) skip.add(property)
      const sniff = userAgentTest(node, resolve)
      if (sniff !== undefined && !sniff.platform) report(node, sniff.subject)
      if (!isMobileHint(node)) return
      const position = flagPosition(node)
      if (position.kind === 'binding') hints.add(position.name)
      else if (position.kind === 'choice') report(node, HINT)
    },
    Property(node) {
      const key = field(node, 'key')
      if (key !== undefined && node['computed'] !== true && key !== field(node, 'value')) {
        skip.add(key)
      }
    },
    Identifier(node) {
      const name = node['name'] as string
      if (skip.has(node)) return
      const imported = deviceFlags.get(name)
      if (imported !== undefined) report(node, imported)
      const parent = node['parent'] as Node | undefined
      const declares = parent?.type === 'VariableDeclarator' && field(parent, 'id') === node
      if (hints.has(name) && !declares && flagPosition(node).kind === 'choice') report(node, HINT)
    },
    ImportSpecifier(node) {
      if (WINDOW_SIZE_HOOKS.has(nameOf(field(node, 'imported')) ?? '')) {
        const local = nameOf(field(node, 'local'))
        if (local !== undefined) sizes.hooks.add(local)
      }
    },
    VariableDeclarator(node) {
      bindWindowSize(node, sizes)
      const hint = destructuredHint(node)
      if (hint === undefined) return
      hints.add(hint)
      // The pattern's own `mobile` declares the binding; it is no read of it.
      for (const p of nodesOf(field(node, 'id') as Node, 'properties')) {
        const value = field(p, 'value')
        skip.add(
          value?.type === 'AssignmentPattern' ? (field(value, 'left') as Node) : (value as Node),
        )
      }
    },
    CallExpression(node) {
      const name = calleeName(node)
      const args = Array.isArray(node['arguments']) ? node['arguments'].filter(isNode) : []
      const sniff = userAgentTest(node, resolve)
      if (sniff !== undefined && !sniff.platform) report(node, sniff.subject)
      if (name === undefined || !QUERY_CALLEES.has(name)) return
      const arg = resolve(args[0])
      const text = literalText(arg) ?? objectQueryText(arg, resolve)
      if (text !== undefined && VIEWPORT_FEATURE.test(text)) report(node, `${name}('${text}')`)
    },
    BinaryExpression(node) {
      const subject = widthComparison(node, resolve, sizes)
      if (subject !== undefined) report(node, subject)
    },
  }
}

/** The media features the class forms and the stylelint list ban: width, height, aspect ratio, orientation, the device forms. */
const VIEWPORT_FEATURE = /width|height|aspect-ratio|orientation|device-/i

/** `react-device-detect`'s viewport-class flags: a user-agent verdict, read as a layout switch. */
const DEVICE_DETECT = 'react-device-detect'
const DEVICE_FLAGS: ReadonlySet<string> = new Set(['isMobile', 'isTablet'])

const AGENT_METHODS: ReadonlySet<string> = new Set([
  'includes',
  'match',
  'indexOf',
  'search',
  'startsWith',
  'endsWith',
  'test',
])

/** `navigator.<property>` or `window.navigator.<property>`, bare or through `?.`. */
function isNavigatorField(node: Node | undefined, property: string): boolean {
  if (node?.type !== 'MemberExpression' || node['computed'] === true) return false
  if (nameOf(field(node, 'property')) !== property) return false
  // `(navigator as Navigator & UAData).userAgentData`: the cast TS's DOM lib needs for the hint.
  const object = bare(field(node, 'object'))
  if (nameOf(object) === 'navigator') return true
  if (object?.type !== 'MemberExpression' || object['computed'] === true) return false
  return (
    nameOf(field(object, 'property')) === 'navigator' &&
    GLOBALS.has(nameOf(field(object, 'object')) ?? '')
  )
}

/** `navigator.userAgent` or `window.navigator.userAgent`, bare. */
const isUserAgent = (node: Node | undefined): boolean => isNavigatorField(node, 'userAgent')

/** The client-hints mobile flag, `navigator.userAgentData?.mobile`: a device verdict, a layout guess. */
const isMobileHint = (node: Node): boolean =>
  node['computed'] !== true &&
  nameOf(field(node, 'property')) === 'mobile' &&
  isNavigatorField(bare(field(node, 'object')), 'userAgentData')

/** The wrappers a flag is read through before its position decides: TS, `?.`, `!`, `??`, a comparison. */
const FLAG_WRAPPERS: ReadonlySet<string> = new Set([
  'TSNonNullExpression',
  'TSAsExpression',
  'TSSatisfiesExpression',
  'ChainExpression',
  'ParenthesizedExpression',
  'UnaryExpression',
  'BinaryExpression',
])

/**
 * Where a flag ends up once its wrappers are climbed: `data` when it is passed as data (an object
 * literal's value but a cn()/clsx class key's, a call's argument, an array element:
 * `track('open', { mobile })`), `binding`
 * with the name when a `const` or `let` takes it whole, `choice` anywhere else (a conditional, `&&`,
 * a JSX branch, a return).
 */
function flagPosition(node: Node): { kind: 'data' | 'choice' } | { kind: 'binding'; name: string } {
  let at = node
  let up = at['parent'] as Node | undefined
  while (
    up &&
    (FLAG_WRAPPERS.has(up.type) || (up.type === 'LogicalExpression' && up['operator'] === '??'))
  ) {
    at = up
    up = at['parent'] as Node | undefined
  }
  if (up?.type === 'Property' && field(up, 'value') === at) {
    const owner = up['parent'] as Node | undefined
    if (owner?.type !== 'ObjectExpression') return { kind: 'choice' }
    // A class-key object of cn()/clsx/cva (`cn({ 'p-2': mobile })`): the value chooses the class.
    const call = owner['parent'] as Node | undefined
    const callee = call?.type === 'CallExpression' ? nameOf(field(call, 'callee')) : undefined
    return { kind: callee !== undefined && CLASS_CALLEES.has(callee) ? 'choice' : 'data' }
  }
  if (
    (up?.type === 'CallExpression' || up?.type === 'NewExpression') &&
    field(up, 'callee') !== at
  ) {
    return { kind: 'data' }
  }
  if (up?.type === 'ArrayExpression') return { kind: 'data' }
  const name =
    up?.type === 'VariableDeclarator' && field(up, 'init') === at
      ? nameOf(field(up, 'id'))
      : undefined
  return name !== undefined ? { kind: 'binding', name } : { kind: 'choice' }
}

/**
 * The name a destructure of the client hints binds `mobile` to: `const { mobile } =
 * (navigator as Navigator & UAData).userAgentData ?? { mobile: false }`.
 */
function destructuredHint(declarator: Node): string | undefined {
  const pattern = field(declarator, 'id')
  if (pattern?.type !== 'ObjectPattern') return undefined
  let init = bare(field(declarator, 'init'))
  while (init?.type === 'LogicalExpression' && init['operator'] !== '&&')
    init = bare(field(init, 'left'))
  if (!isNavigatorField(init, 'userAgentData')) return undefined
  const property = nodesOf(pattern, 'properties').find(
    (p) => p.type === 'Property' && p['computed'] !== true && nameOf(field(p, 'key')) === 'mobile',
  )
  const value = property ? field(property, 'value') : undefined
  return nameOf(value?.type === 'AssignmentPattern' ? field(value, 'left') : value)
}

/** A user-agent method test: `navigator.userAgent.includes(..)`, `.match`, `.indexOf`, `.search`, `.startsWith`, `.endsWith`. */
function userAgentSniff(node: Node): string | undefined {
  if (!isUserAgent(field(node, 'object'))) return undefined
  const method = nameOf(field(node, 'property'))
  return method !== undefined && AGENT_METHODS.has(method)
    ? `navigator.userAgent.${method}`
    : undefined
}

/** A platform name a user agent carries: the desktop systems and Apple's handhelds, never `Mobi` or `Android`. */
const PLATFORM_WORD =
  /^(?:mac(?:intosh|intel)?|mac ?os(?: ?x)?|win(?:dows|32|64)?|linux|ip(?:hone|ad|od))$/i
const DESKTOP_WORD = /^(?:mac|win|linux)/i

/**
 * Whether a literal pattern names platforms only, a desktop one among them: `/Mac|iPhone|iPad/`
 * picks the `⌘` glyph. `/iPhone/` alone or `/Mobi|Android/` is a device sniff, a layout guess.
 */
function isPlatformPattern(pattern: string | undefined): boolean {
  if (pattern === undefined) return false
  const words = pattern
    .replaceAll('\\b', '')
    .replaceAll('?:', '')
    .replaceAll(/[\^$()]/g, '')
    .split('|')
    .map((word) => word.trim())
  return (
    words.every((word) => PLATFORM_WORD.test(word)) && words.some((word) => DESKTOP_WORD.test(word))
  )
}

/** A regex literal's source or a string literal's text; any other node is open. */
function patternText(node: Node | undefined): string | undefined {
  const regex = node?.['regex'] as { pattern?: unknown } | undefined
  if (typeof regex?.pattern === 'string') return regex.pattern
  return node?.type === 'Literal' && typeof node['value'] === 'string' ? node['value'] : undefined
}

/**
 * A user-agent test at this node: `re.test(navigator.userAgent)` on a call, or a method sniff
 * (`navigator.userAgent.includes(..)`) on a member, with whether its literal pattern names platforms only.
 */
function userAgentTest(
  node: Node,
  resolve: (node: Node | undefined) => Node | undefined,
): { subject: string; platform: boolean } | undefined {
  if (node.type === 'CallExpression') {
    const callee = field(node, 'callee')
    const args = Array.isArray(node['arguments']) ? node['arguments'].filter(isNode) : []
    if (calleeName(node) !== 'test' || !isUserAgent(args[0])) return undefined
    const pattern = callee?.type === 'MemberExpression' ? field(callee, 'object') : undefined
    return {
      subject: 'test(navigator.userAgent)',
      platform: isPlatformPattern(patternText(resolve(pattern))),
    }
  }
  const subject = userAgentSniff(node)
  if (subject === undefined) return undefined
  const parent = node['parent'] as Node | undefined
  const call =
    parent?.type === 'CallExpression' && field(parent, 'callee') === node ? parent : undefined
  const args = call && Array.isArray(call['arguments']) ? call['arguments'].filter(isNode) : []
  return { subject, platform: isPlatformPattern(patternText(resolve(args[0]))) }
}

/**
 * `viewport-keyed`, `platform-glyph`: a user-agent test whose literal pattern names platforms
 * only, a desktop one among them (`/Mac|iPhone|iPad/.test(navigator.userAgent)` choosing `⌘K` or
 * `Ctrl K`). The report is right, the fix is not a size class: `<Kbd>Mod</Kbd>` renders the
 * platform's glyph. A test that picks an installer (`/Mac|Win/.test(navigator.userAgent) ?
 * '/dl/app.dmg' : '/dl/app.exe'`, both branches a file of a platform build) is neither a glyph nor
 * a layout and passes; any other platform test that picks no glyph is waived on its line, with the
 * reason. Known limit: `navigator.platform` and `userAgentData.platform` are not read.
 */
export function platformGlyphForm({ report }: FormContext): Visitor {
  let consts: ReadonlyMap<string, Node> = new Map()
  const resolve = (node: Node | undefined): Node | undefined =>
    node?.type === 'Identifier' ? (consts.get(node['name'] as string) ?? node) : node
  const onSniff = (node: Node): void => {
    const sniff = userAgentTest(node, resolve)
    if (sniff?.platform === true && !picksInstaller(node)) report(node, sniff.subject)
  }
  return {
    Program(node) {
      consts = topLevelConsts(node)
    },
    MemberExpression: onSniff,
    CallExpression: onSniff,
  }
}

/** A file of a platform build: a disk image, an installer or a package. */
const INSTALLER = /\.(?:dmg|pkg|exe|msi|msix|appx|deb|rpm|appimage|apk|ipa)$/i

/**
 * Whether the sniff is the test of a conditional whose two branches are installer files: the
 * sniff, a method sniff's call, or either through `?.`, as the conditional's `test`.
 */
function picksInstaller(sniff: Node): boolean {
  let at = sniff
  let up = at['parent'] as Node | undefined
  while (up?.type === 'CallExpression' || up?.type === 'ChainExpression') {
    if (up.type === 'CallExpression' && field(up, 'callee') !== at) return false
    at = up
    up = at['parent'] as Node | undefined
  }
  if (up?.type !== 'ConditionalExpression' || field(up, 'test') !== at) return false
  return [field(up, 'consequent'), field(up, 'alternate')].every((branch) => {
    const text = literalText(branch)
    return text !== undefined && INSTALLER.test(text)
  })
}

/** The names a scheme value goes by: next-themes' `theme`, `resolvedTheme` and `systemTheme`, a `colorScheme`, a `scheme`. */
const SCHEME_NAMES: ReadonlySet<string> = new Set([
  'theme',
  'resolvedTheme',
  'systemTheme',
  'colorScheme',
  'scheme',
])
const SCHEME_VALUES: ReadonlySet<string> = new Set(['dark', 'light'])
const EQUALITY: ReadonlySet<string> = new Set(['===', '!==', '==', '!='])
/**
 * A boolean named for the dark scheme: `isDark`, `isDarkMode` (usehooks-ts' `useDarkMode`),
 * `darkMode`, `isDarkTheme`. A bare `dark` is too common a name to read alone.
 */
const DARK_FLAG = /^(?:isDark(?:Mode|Theme|Scheme)?|dark(?:Mode|Theme|Scheme))$/
/** The TS wrappers and `?.` a value is read through. */
const WRAPPERS: ReadonlySet<string> = new Set([
  'TSNonNullExpression',
  'TSAsExpression',
  'TSSatisfiesExpression',
  'ChainExpression',
  'ParenthesizedExpression',
])

const bare = (node: Node | undefined): Node | undefined => {
  let at = node
  while (at && WRAPPERS.has(at.type)) at = field(at, 'expression')
  return at
}

/** `resolvedTheme`, or `settings.colorScheme` by its last name, through `!` and `?.`. */
function lastName(node: Node | undefined): string | undefined {
  const at = bare(node)
  return at?.type === 'MemberExpression' && at['computed'] !== true
    ? nameOf(field(at, 'property'))
    : nameOf(at)
}

function schemeName(node: Node | undefined): string | undefined {
  const name = lastName(node)
  return name !== undefined && SCHEME_NAMES.has(name) ? name : undefined
}

/** `matchMedia('(prefers-color-scheme: dark)').matches`, by its subject. */
function colourSchemeQuery(test: Node | undefined): string | undefined {
  if (test?.type !== 'MemberExpression' || nameOf(field(test, 'property')) !== 'matches') {
    return undefined
  }
  const call = bare(field(test, 'object'))
  const [arg] = call?.type === 'CallExpression' ? nodesOf(call, 'arguments') : []
  const text = call && calleeName(call) === 'matchMedia' ? literalText(arg) : undefined
  return text !== undefined && /prefers-color-scheme/i.test(text)
    ? `matchMedia('${text}').matches`
    : undefined
}

/**
 * A scheme test: a scheme value compared with `'dark'` or `'light'` (either side), the
 * colour-scheme media query's `.matches`, a boolean named for the dark scheme, or a `const` bound
 * to one of those (`bound`, by name); through `!`. Returns the subject, or undefined.
 */
function schemeTest(
  node: Node | undefined,
  bound: ReadonlyMap<string, string> = new Map(),
): string | undefined {
  const test = bare(node)
  if (test?.type === 'UnaryExpression' && test['operator'] === '!') {
    return schemeTest(field(test, 'argument'), bound)
  }
  const query = colourSchemeQuery(test)
  if (query !== undefined) return query
  const name = lastName(test)
  if (name !== undefined && DARK_FLAG.test(name)) return name
  if (test?.type === 'Identifier' && name !== undefined && bound.has(name)) {
    return `${name}, bound to ${bound.get(name)}`
  }
  if (test?.type !== 'BinaryExpression') return undefined
  const operator = test['operator'] as string
  if (!EQUALITY.has(operator)) return undefined
  const left = field(test, 'left')
  const right = field(test, 'right')
  for (const [value, other] of [
    [left, right],
    [right, left],
  ] as const) {
    const literal = value?.type === 'Literal' ? value['value'] : undefined
    if (typeof literal !== 'string' || !SCHEME_VALUES.has(literal)) continue
    const scheme = schemeName(other)
    if (scheme !== undefined) return `${scheme} ${operator} '${literal}'`
  }
  return undefined
}

/** The class-list writes a scheme store makes on the root. */
const CLASS_LIST_WRITES: ReadonlySet<string> = new Set(['add', 'remove', 'toggle', 'replace'])
/** The page's root elements: `document.documentElement` and `document.body`, `window.` or not. */
const ROOT_ELEMENTS: ReadonlySet<string> = new Set(['documentElement', 'body'])

/** `document.documentElement` or `document.body`, through `window.` and the TS wrappers. */
function rootElement(node: Node | undefined): string | undefined {
  const at = bare(node)
  if (at?.type !== 'MemberExpression' || at['computed'] === true) return undefined
  const property = nameOf(field(at, 'property'))
  if (property === undefined || !ROOT_ELEMENTS.has(property)) return undefined
  const object = bare(field(at, 'object'))
  const isDocument =
    nameOf(object) === 'document' ||
    (object?.type === 'MemberExpression' &&
      nameOf(field(object, 'property')) === 'document' &&
      GLOBALS.has(nameOf(field(object, 'object')) ?? ''))
  return isDocument ? `document.${property}` : undefined
}

/** A type annotation that is a union of `'dark'`, `'light'` and `'system'` literals only. */
function isSchemeType(annotation: Node | undefined): boolean {
  const type =
    annotation?.type === 'TSTypeAnnotation' ? field(annotation, 'typeAnnotation') : annotation
  const members = type?.type === 'TSUnionType' ? nodesOf(type, 'types') : type ? [type] : []
  return (
    members.length > 0 &&
    members.every((member) => {
      const literal = member.type === 'TSLiteralType' ? field(member, 'literal') : undefined
      return (
        typeof literal?.['value'] === 'string' && /^(?:dark|light|system)$/.test(literal['value'])
      )
    })
  )
}

/**
 * `dark-fork`, `scheme-fork`: a JS fork on the scheme that chooses a class, or a scheme store of
 * the app's own.
 *
 * A fork: a class string (in a class attribute, `cn()`, `cva` or a class-shaped object or array)
 * whose enclosing conditional or `&&` tests a scheme (`resolvedTheme === 'dark' ? 'bg-inset' :
 * 'bg-card'`), or a class key of a cn()/clsx object whose value is one (`{ invert: resolvedTheme
 * === 'dark' }`), reports at the conditional or the key, once. A scheme test is a scheme value read
 * by name (`theme`, `resolvedTheme`, `systemTheme`, `colorScheme`, `scheme`, bare or as a member)
 * compared with `'dark'` or `'light'`, the colour-scheme media query's `.matches`, a boolean named
 * for the dark scheme (`isDark`, `isDarkMode`, `darkMode`) or a `const` bound to any of these
 * (`const dark = matchMedia('(prefers-color-scheme: dark)').matches`), read through `!`.
 *
 * A store: `classList.add`, `remove`, `toggle` or `replace` on `document.documentElement` or
 * `document.body` (directly or through a binding of either) with `'dark'` or `'light'`, a scheme
 * value by name, or a parameter typed as a union of those literals: shadcn's Vite theme provider.
 * basalt's tokens key on `[data-theme]`, so the class reaches no token.
 *
 * Known limits: a scheme bound to another name (`const mode = readScheme()`), a binding matched by
 * spelling within the file rather than by scope, a fork that returns a class outside a class
 * position (`return dark ? 'bg-inset' : 'bg-card'` from a hook), a fork inside a template literal's
 * hole and a scheme type named by an alias (`theme: Theme`, read by its name only) are not read.
 */
export function schemeForkForm({ report }: FormContext): Visitor {
  const forks: { up: Node; test: Node | undefined }[][] = []
  const bound = new Map<string, string>()
  const roots = new Set<string>()
  const typed = new Set<string>()
  const writes: { node: Node; target: string; args: Node[] }[] = []
  const onString = (node: Node): void => {
    const chain: { up: Node; test: Node | undefined }[] = []
    let at = node
    for (let up = at['parent'] as Node | undefined; up; up = up['parent'] as Node | undefined) {
      if (up.type === 'ConditionalExpression' && field(up, 'test') !== at) {
        chain.push({ up, test: field(up, 'test') })
      } else if (up.type === 'LogicalExpression' && up['operator'] === '&&') {
        if (field(up, 'right') === at) chain.push({ up, test: field(up, 'left') })
      } else if (up.type === 'Property' && field(up, 'key') === at) {
        // A class key of a clsx-style object: its value is the condition.
        chain.push({ up, test: field(up, 'value') })
        break
      } else if (up.type !== 'LogicalExpression') break
      at = up
    }
    if (chain.length > 0) forks.push(chain)
  }
  const isSchemeArg = (arg: Node): boolean => {
    const literal = arg.type === 'Literal' ? arg['value'] : undefined
    if (typeof literal === 'string') return SCHEME_VALUES.has(literal)
    const name = lastName(arg)
    return (
      name !== undefined &&
      (SCHEME_NAMES.has(name) || (arg.type === 'Identifier' && typed.has(name)))
    )
  }
  return mergeVisitors([
    classStringVisitor(onString),
    {
      VariableDeclarator(node) {
        const name = nameOf(field(node, 'id'))
        if (name === undefined) return
        const init = field(node, 'init')
        if (rootElement(init) !== undefined) roots.add(name)
        const declaration = node['parent'] as Node | undefined
        const subject = declaration?.['kind'] === 'const' ? schemeTest(init) : undefined
        if (subject !== undefined) bound.set(name, subject)
      },
      Identifier(node) {
        if (isSchemeType(field(node, 'typeAnnotation'))) typed.add(node['name'] as string)
      },
      CallExpression(node) {
        const callee = field(node, 'callee')
        if (callee?.type !== 'MemberExpression' || callee['computed'] === true) return
        const method = nameOf(field(callee, 'property'))
        if (method === undefined || !CLASS_LIST_WRITES.has(method)) return
        const list = bare(field(callee, 'object'))
        if (list?.type !== 'MemberExpression' || nameOf(field(list, 'property')) !== 'classList') {
          return
        }
        const owner = bare(field(list, 'object'))
        const root = nameOf(owner)
        const target =
          rootElement(owner) ?? (root !== undefined && roots.has(root) ? root : undefined)
        if (target !== undefined) {
          writes.push({
            node,
            target: `${target}.classList.${method}`,
            args: nodesOf(node, 'arguments'),
          })
        }
      },
      'Program:exit'() {
        const reported = new WeakSet<Node>()
        for (const chain of forks) {
          for (const { up, test } of chain) {
            const subject = schemeTest(test, bound)
            if (subject === undefined) continue
            if (!reported.has(up)) report(up, subject)
            reported.add(up)
            break
          }
        }
        for (const { node, target, args } of writes)
          if (args.some(isSchemeArg)) report(node, target)
      },
    },
  ])
}

/** react-responsive's width keys: any of them makes the object query a viewport query. */
const OBJECT_QUERY_WIDTH = /^(?:max|min)(?:Device)?Width$/

/**
 * The query an object argument spells (`{ maxWidth: 767 }`, `{ query: '(width < 48rem)' }`): the
 * width key itself, or the literal text of `query`; undefined for any other object.
 */
function objectQueryText(
  arg: Node | undefined,
  resolve: (node: Node | undefined) => Node | undefined,
): string | undefined {
  if (arg?.type !== 'ObjectExpression') return undefined
  for (const property of nodesOf(arg, 'properties')) {
    if (property.type !== 'Property') continue
    const key = nameOf(field(property, 'key'))
    if (key !== undefined && OBJECT_QUERY_WIDTH.test(key)) return `{ ${key} }`
    if (key === 'query') return literalText(resolve(field(property, 'value')))
  }
  return undefined
}

/**
 * The names a file binds to a window-size hook: the result object, a destructured width, and the
 * local names the hook is imported under (`useWindowSize as useSize`).
 */
type WindowSizes = { objects: Set<string>; widths: Set<string>; hooks: Set<string> }

const WINDOW_SIZE_HOOKS: ReadonlySet<string> = new Set(['useWindowSize'])

const isWindowSizeCall = (node: Node | undefined, sizes: WindowSizes): boolean => {
  if (node?.type !== 'CallExpression') return false
  const name = calleeName(node)
  return name !== undefined && (WINDOW_SIZE_HOOKS.has(name) || sizes.hooks.has(name))
}

/** `const size = useWindowSize()` or `const { width: w } = useWindowSize()`. */
function bindWindowSize(declarator: Node, sizes: WindowSizes): void {
  if (!isWindowSizeCall(field(declarator, 'init'), sizes)) return
  const id = field(declarator, 'id')
  if (id?.type === 'Identifier') {
    sizes.objects.add(id['name'] as string)
    return
  }
  if (id?.type !== 'ObjectPattern') return
  for (const property of nodesOf(id, 'properties')) {
    if (property.type !== 'Property' || nameOf(field(property, 'key')) !== 'width') continue
    const value = field(property, 'value')
    const local = nameOf(value?.type === 'AssignmentPattern' ? field(value, 'left') : value)
    if (local !== undefined) sizes.widths.add(local)
  }
}

/** The text of a window-size hook's width: `width`, `size.width`, `useWindowSize().width`. */
function windowSizeRead(node: Node | undefined, sizes: WindowSizes): string | undefined {
  if (node?.type === 'Identifier') {
    const name = node['name'] as string
    return sizes.widths.has(name) ? name : undefined
  }
  if (node?.type !== 'MemberExpression' || node['computed'] === true) return undefined
  if (nameOf(field(node, 'property')) !== 'width') return undefined
  const object = field(node, 'object')
  if (isWindowSizeCall(object, sizes)) return `${calleeName(object as Node) ?? ''}().width`
  const name = nameOf(object)
  return name !== undefined && sizes.objects.has(name) ? `${name}.width` : undefined
}

const GLOBALS: ReadonlySet<string> = new Set(['window', 'globalThis'])

/** The window objects whose `width` is the viewport's: the device screen and the visual viewport. */
const VIEWPORT_OBJECTS: ReadonlySet<string> = new Set(['screen', 'visualViewport'])

/**
 * `screen`, `window.screen`, `visualViewport` or `globalThis.visualViewport`: the device's screen
 * or the visual viewport object.
 */
function viewportObject(node: Node | undefined): string | undefined {
  const bare = nameOf(node)
  if (bare !== undefined) return VIEWPORT_OBJECTS.has(bare) ? bare : undefined
  if (node?.type !== 'MemberExpression' || node['computed'] === true) return undefined
  const global = nameOf(field(node, 'object'))
  const name = nameOf(field(node, 'property'))
  return global !== undefined &&
    GLOBALS.has(global) &&
    name !== undefined &&
    VIEWPORT_OBJECTS.has(name)
    ? `${global}.${name}`
    : undefined
}

/**
 * The operand a comparison reads: past parentheses, an optional chain (`visualViewport?.width`),
 * a non-null assertion and the left side of a fallback (`(… ?? 0)`, `(… || 0)`).
 */
function operand(node: Node | undefined): Node | undefined {
  if (node === undefined) return undefined
  if (['ParenthesizedExpression', 'ChainExpression', 'TSNonNullExpression'].includes(node.type)) {
    return operand(field(node, 'expression'))
  }
  if (node.type === 'LogicalExpression' && ['??', '||'].includes(node['operator'] as string)) {
    return operand(field(node, 'left'))
  }
  return node
}

/**
 * The text of a viewport-size read: `window.innerWidth`, `globalThis.outerWidth`,
 * `document.documentElement.clientWidth`, `window.screen.width`, `window.visualViewport.width`.
 * A bare `innerWidth` is not read: charts name a plot width so.
 */
function viewportRead(node: Node | undefined): string | undefined {
  if (node?.type !== 'MemberExpression' || node['computed'] === true) return undefined
  const property = field(node, 'property')
  const prop = property?.type === 'Identifier' ? (property['name'] as string) : undefined
  const object = field(node, 'object')
  if (prop === 'innerWidth' || prop === 'outerWidth') {
    const global = object?.type === 'Identifier' ? (object['name'] as string) : undefined
    return global !== undefined && GLOBALS.has(global) ? `${global}.${prop}` : undefined
  }
  if (prop === 'width' || prop === 'availWidth') {
    const viewport = viewportObject(object)
    return viewport === undefined ? undefined : `${viewport}.${prop}`
  }
  if (prop !== 'clientWidth' || object?.type !== 'MemberExpression') return undefined
  const root = field(object, 'object')
  const mid = field(object, 'property')
  const isDocument = root?.type === 'Identifier' && root['name'] === 'document'
  return isDocument && mid?.type === 'Identifier' && mid['name'] === 'documentElement'
    ? 'document.documentElement.clientWidth'
    : undefined
}

const WIDTH_COMPARISONS: ReadonlySet<string> = new Set(['<', '<=', '>', '>='])

/** `window.innerWidth < 768`: the viewport width against a number, on either side. */
function widthComparison(
  node: Node,
  resolve: (node: Node | undefined) => Node | undefined,
  sizes: WindowSizes,
): string | undefined {
  const operator = node['operator'] as string
  if (!WIDTH_COMPARISONS.has(operator)) return undefined
  const rawLeft = operand(field(node, 'left'))
  const rawRight = operand(field(node, 'right'))
  const read = (raw: Node | undefined): string | undefined =>
    windowSizeRead(raw, sizes) ?? viewportRead(resolve(raw))
  const left = resolve(rawLeft)
  const right = resolve(rawRight)
  const leftRead = read(rawLeft)
  if (leftRead !== undefined && right?.type === 'Literal' && typeof right['value'] === 'number') {
    return `${leftRead} ${operator} ${String(right['value'])}`
  }
  const rightRead = read(rawRight)
  if (rightRead !== undefined && left?.type === 'Literal' && typeof left['value'] === 'number') {
    return `${String(left['value'])} ${operator} ${rightRead}`
  }
  return undefined
}

/**
 * The options a gated rule accepts: `{ profile: 'bridge' }` switches its parts-only forms off, and
 * `{ formsOff: [...] }` is a zone block switching single forms off (an ejected file).
 */
export const PROFILE_GATE_SCHEMA = {
  type: 'object',
  properties: {
    profile: { enum: ['bridge', 'parts'] },
    formsOff: { type: 'array', items: { type: 'string' } },
  },
  additionalProperties: false,
} as const

const isBridge = (options: readonly unknown[]): boolean =>
  (options[0] as { profile?: string } | undefined)?.profile === 'bridge'

/**
 * A class form that runs from `parts` upward. The rule table carries a profile per rule, not per
 * form, so the form reads the rule's `profile` option and stands down for `bridge`, where its fix
 * (`Card`, `Status`, a ladder step) cannot be satisfied. The preset sets the option per profile.
 */
export function partsOnly(
  { pattern, ...base }: ClassForm,
  whole?: (tokens: readonly string[], element: string | undefined) => string | undefined,
): AstForm {
  return {
    ...base,
    detect: ({ context, report }) => {
      // The host element whose opening tag holds the string (undefined outside a JSX attribute: a
      // `cva`/`tv` base, a constant).
      const elements: (string | undefined)[] = []
      const tracker: Visitor = {
        JSXOpeningElement(node) {
          elements.push(nameOf(field(node, 'name')))
        },
        'JSXOpeningElement:exit'() {
          elements.pop()
        },
      }
      const classes = classStringVisitor((node, text) => {
        if (isBridge(context.options)) return
        const tokens = classTokens(text)
        for (const token of tokens) if (pattern.test(token)) report(node, token)
        const subject = whole?.(tokens, elements.at(-1))
        if (subject !== undefined) report(node, subject)
      })
      return whole === undefined ? classes : mergeVisitors([tracker, classes])
    },
  }
}

/** The custom property an arbitrary utility value reads: `bg-(--x)`, `bg-[var(--x)]`, `bg-(color:--x)`. */
const UTILITY_VAR = /-[([](?:color:)?(?:var\()?(--[a-z][\w-]*)/i

/**
 * `partsOnly` for a colour utility over a custom property, minus a property the same file sets in
 * a `style` object (`style={{ '--part': BASALT.line }}` with `bg-(--part)`): that value is passed in,
 * a series colour or a token, and the style's own route holds it (no-inline-styles,
 * html-data-marks). A property declared elsewhere (`--brand-blue` in a module stylesheet) is the
 * app's own palette and reports; a `--basalt-*` name reports wherever it is set. Known limit: a
 * property set through a spread or a computed key is not read as set, and reports.
 */
export function partsOnlyExceptStyleVar({ pattern, ...base }: ClassForm): AstForm {
  return {
    ...base,
    detect: ({ context, report }) => {
      const set = new Set<string>()
      const pending: { node: Node; token: string }[] = []
      return mergeVisitors([
        classStringVisitor((node, text) => {
          if (isBridge(context.options)) return
          for (const token of classTokens(text))
            if (pattern.test(token)) pending.push({ node, token })
        }),
        {
          Property(node) {
            const key = field(node, 'key')
            const name = key?.type === 'Literal' ? key['value'] : undefined
            if (typeof name === 'string' && name.startsWith('--')) set.add(name)
          },
          'Program:exit'() {
            for (const { node, token } of pending) {
              const name = UTILITY_VAR.exec(token)?.[1]
              if (name !== undefined && !name.startsWith('--basalt-') && set.has(name)) continue
              report(node, token)
            }
          },
        },
      ])
    },
  }
}

const RADIUS = /^rounded(?:-(?!card$|none$|full$)[a-z0-9]+|-\([^)]+\)|-\[[^\]]+\])?$/
const CARD_PADDING = /^py?-(?:[3-9]|\d{2,})$/
const CARD_BORDER = /^(?:border(?:-1)?|ring(?:-\d+)?|outline(?:-[12])?)$/
/** A card's elevation: `shadow` and `shadow-sm` up; a control's `shadow-xs`/`shadow-2xs` is not one. */
const CARD_SHADOW = /^shadow(?:-(?:sm|md|lg|xl|2xl))?$/
/**
 * A hand-built control beside a shadow: a horizontal padding with `py-2` or less, a fixed control
 * height (`h-8` to `h-10`) or `inline-flex`. shadcn v3 and Tremor give buttons, inputs and selects
 * `shadow-sm`, so the shadow is not a card's there; primitive-bypass owns a hand-built control.
 */
const CONTROL_PADDING_X = /^px-/
const CONTROL_PADDING_Y = /^py-(?:0|0\.5|1|1\.5|2|px)$/
const CONTROL_SIGNAL = /^(?:h-(?:8|9|10)|inline-flex)$/
/** An element that owns a control's shadow: a host `button`, `input`, `select`, `a` or `label`. */
const INTERACTIVE: ReadonlySet<string> = new Set(['button', 'input', 'select', 'a', 'label'])
/**
 * Where a control signal may exempt the shadow: an interactive host element, a component (its
 * name says nothing about what it renders) or a class string outside JSX (a `cva`/`tv` base). A
 * host `div`, `section` or `span` with the same classes is a rebuilt surface.
 */
const mayBeControl = (element: string | undefined): boolean =>
  element === undefined || INTERACTIVE.has(element) || !/^[a-z]/.test(element)
const hasControlSignal = (tokens: readonly string[]): boolean =>
  tokens.some((token) => CONTROL_SIGNAL.test(token)) ||
  (tokens.some((token) => CONTROL_PADDING_X.test(token)) &&
    tokens.some((token) => CONTROL_PADDING_Y.test(token)))

/**
 * `surface-recipe`, whole-string form: a bordered card rebuilt without a card token, a radius
 * (named, or the v4 `rounded-(--x)`/`rounded-[…]` value), a bare `border` (or an unprefixed ring
 * width such as ring-1) and a third signal in one class string: a padding step of 3 or more,
 * all-round or vertical (`p-4`, `py-6`; a lone `px-N` is a button, input or badge, not a card), or
 * a card's shadow (`shadow-sm` up: a tile whose padding comes from a child), which counts only
 * where no control signal sits beside it (`px-3 py-2`, `h-9`, `inline-flex`) on an element that
 * may be a control: `button`, `input`, `select`, `a`, `label`, a component, or a class string
 * outside JSX (a `cva` base). On a host `div` or `section` the signal exempts nothing. Known
 * limit: a component carrying a card recipe is not read as a surface, since its name does not say. A bare `outline`, `outline-1` or `outline-2` is a border as `ring-1` is
 * (`outline-none`, `outline-offset-*` and a variant-prefixed outline are not). A dashed or dotted
 * border, a pill (`rounded-full`), a lone `p-1`/`p-2`, a control's `shadow-xs` and a
 * variant-prefixed ring (`focus-visible:ring-2`) are not a card.
 */
export function borderedCard(tokens: readonly string[], element?: string): string | undefined {
  const radius = tokens.find((token) => RADIUS.test(token))
  const third =
    tokens.find((token) => CARD_PADDING.test(token)) ??
    (mayBeControl(element) && hasControlSignal(tokens)
      ? undefined
      : tokens.find((token) => CARD_SHADOW.test(token)))
  const border = tokens.find((token) => CARD_BORDER.test(token))
  if (radius === undefined || third === undefined || border === undefined) return undefined
  if (tokens.some((token) => /^border-(?:dashed|dotted)$/.test(token))) return undefined
  return `${radius} ${border} ${third}`
}

const nameOf = (node: Node | undefined): string | undefined =>
  node?.type === 'Identifier' || node?.type === 'JSXIdentifier'
    ? (node['name'] as string)
    : undefined

const nodesOf = (node: Node, key: string): Node[] => {
  const value = node[key]
  return Array.isArray(value) ? value.filter(isNode) : []
}

/** `focus.item(i)` as a spread attribute: the handle's name, or undefined for any other spread. */
function itemSpreadHandle(attr: Node): string | undefined {
  if (attr.type !== 'JSXSpreadAttribute') return undefined
  const call = field(attr, 'argument')
  const callee = call?.type === 'CallExpression' ? field(call, 'callee') : undefined
  if (callee?.type !== 'MemberExpression' || callee['computed'] === true) return undefined
  if (nameOf(field(callee, 'property')) !== 'item') return undefined
  return nameOf(field(callee, 'object'))
}

/**
 * `partsOnly` that stands down for the tokens `exempt` matches on a mark drawn through the
 * `useChartFocus` seam: the element, or one of its ancestors, spreads `focus.item(..)` where
 * `focus` is bound from `useChartFocus(..)` in this file. The same route `primitive-bypass` names
 * for a self-drawn mark, so the fill that mark takes is not reported (text, border and ring
 * colours still are). Purely syntactic: a handle bound elsewhere, or a mark in a child component,
 * is not seen and takes a waiver. Unlike `primitive-bypass`'s data-mark forms it does not require
 * the enclosing `focus.target` container: a seam mark's fill is legal wherever the mark is wired.
 */
export function partsOnlyExceptSeamMark(form: ClassForm, exempt: RegExp): AstForm {
  const { pattern, ...base } = form
  return {
    ...base,
    detect: ({ context, report }) => {
      const handles = new Set<string>()
      const stack: boolean[] = []
      let wired = 0
      const seam: Visitor = {
        VariableDeclarator(node) {
          const init = field(node, 'init')
          if (init?.type !== 'CallExpression') return
          if (nameOf(field(init, 'callee')) !== 'useChartFocus') return
          const name = nameOf(field(node, 'id'))
          if (name !== undefined) handles.add(name)
        },
        JSXElement(node) {
          const open = field(node, 'openingElement')
          const item = nodesOf(open ?? node, 'attributes').some((attr) => {
            const handle = itemSpreadHandle(attr)
            return handle !== undefined && handles.has(handle)
          })
          stack.push(item)
          if (item) wired += 1
        },
        'JSXElement:exit'() {
          if (stack.pop()) wired -= 1
        },
      }
      const classes = classStringVisitor((node, text) => {
        if (isBridge(context.options)) return
        for (const token of classTokens(text)) {
          if (pattern.test(token) && !(wired > 0 && exempt.test(token))) report(node, token)
        }
      })
      return mergeVisitors([seam, classes])
    },
  }
}
