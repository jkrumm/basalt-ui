/**
 * `import-boundary` (guardrails section 4, row 8): the import routes an agent reaches first around
 * the owned entries. 2.x had these as one hand-copied ban that an `extends` silently replaced; here
 * each route is a form with its own fix token and fixture.
 *
 * Twelve forms: seven package bans, the engine allowlist, direct `useReactTable`, the un-ejected
 * `@/components/ui/*` path, `useChat()` without a `chat` option and persist libraries outside a
 * `StorageLike` adapter. The repo-only rows (layer table, single `host.tsx` importer) are not
 * here: a form carries no profile of its own and this rule ships at `parts` and `app`.
 *
 * Option: `{ ejected?: string[] }`, the paths of `manifest.ejected`. An entry may be a
 * `@/components/ui/<name>` specifier or a file path under `components/ui/`.
 */
import type { Node, Visitor } from '../../factory'
import type { AstForm, RuleEntry } from '../../rule-table'
import { defineRules } from '../../rule-table'

export const OPTIONS_SCHEMA = [
  {
    type: 'object',
    properties: { ejected: { type: 'array', items: { type: 'string' } } },
    additionalProperties: false,
  },
] as const

/** Exact `@tanstack/charts` subpaths a consumer may import: 17 modules plus two families. */
export const ENGINE_SUBPATHS: ReadonlySet<string> = new Set([
  'line',
  'area',
  'area-x',
  'bar',
  'rect',
  'rule',
  'dot',
  'tick',
  'text',
  'vector',
  'link',
  'arrow',
  'difference',
  'stack',
  'mark/decorative',
  'd3/shape',
  'types',
])

/** Allowed families: `scales/*` and `transform/*`; the bare `transform` is not one. */
export const ENGINE_FAMILIES: readonly string[] = ['scales/', 'transform/']

const ENGINE = '@tanstack/charts'

/** Packages whose import is a persistence route of its own (any specifier). */
const STORAGE_PACKAGES: ReadonlySet<string> = new Set([
  'use-local-storage',
  'use-local-storage-state',
  '@uidotdev/usehooks',
  'redux-persist',
  'zustand-persist',
])

/** Packages that are only a route through named specifiers. */
const STORAGE_NAMES: Readonly<Record<string, ReadonlySet<string>>> = {
  'zustand/middleware': new Set(['persist', 'createJSONStorage']),
  'jotai/utils': new Set(['atomWithStorage', 'createJSONStorage']),
  '@mantine/hooks': new Set(['useLocalStorage', 'useSessionStorage']),
  'usehooks-ts': new Set(['useLocalStorage', 'useSessionStorage']),
  'react-use': new Set(['useLocalStorage', 'useSessionStorage']),
}

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as Node).type === 'string'

const child = (node: Node, key: string): Node | undefined => {
  const value = node[key]
  return isNode(value) ? value : undefined
}

const children = (node: Node, key: string): Node[] => {
  const value = node[key]
  return Array.isArray(value) ? value.filter(isNode) : []
}

const stringValue = (node: Node | undefined): string | undefined =>
  node?.type === 'Literal' && typeof node['value'] === 'string' ? node['value'] : undefined

const nameOf = (node: Node | undefined): string | undefined =>
  node?.type === 'Identifier' ? (node['name'] as string) : undefined

/** `pkg` itself or any subpath of it. */
const within = (source: string, pkg: string): boolean =>
  source === pkg || source.startsWith(`${pkg}/`)

/**
 * Every module specifier in a file: static imports, re-exports, `import()` and `require()` with a
 * literal. `onSource` gets the declaration or call node so a form can read its specifiers.
 */
function sourceVisitor(onSource: (node: Node, source: string) => void): Visitor {
  const fromSource = (node: Node): void => {
    const source = stringValue(child(node, 'source'))
    if (source !== undefined) onSource(node, source)
  }
  return {
    ImportDeclaration: fromSource,
    ExportAllDeclaration: fromSource,
    ExportNamedDeclaration: fromSource,
    ImportExpression(node) {
      const source = stringValue(child(node, 'source'))
      if (source !== undefined) onSource(node, source)
    },
    CallExpression(node) {
      if (nameOf(child(node, 'callee')) !== 'require') return
      const source = stringValue(children(node, 'arguments')[0])
      if (source !== undefined) onSource(node, source)
    },
  }
}

const packageForm = (
  id: string,
  packages: readonly string[],
  fix: string,
  next: string,
): AstForm => ({
  id,
  detect: ({ report }) =>
    sourceVisitor((node, source) => {
      if (packages.some((pkg) => within(source, pkg))) report(node, source)
    }),
  fix,
  next,
  fixture: `import-bypass/${id}.tsx`,
})

const isAllowedEngineSubpath = (subpath: string): boolean => {
  if (subpath.split('/').some((part) => part === '' || part === '.' || part === '..')) return false
  return (
    ENGINE_SUBPATHS.has(subpath) ||
    ENGINE_FAMILIES.some((prefix) => subpath.startsWith(prefix) && subpath.length > prefix.length)
  )
}

const engineOutsideList: AstForm = {
  id: 'engine-subpath',
  detect: ({ report }) =>
    sourceVisitor((node, source) => {
      if (!within(source, ENGINE)) return
      if (source !== ENGINE && isAllowedEngineSubpath(source.slice(ENGINE.length + 1))) return
      report(node, source)
    }),
  fix: 'Import a chart kind from basalt-ui/charts, or a mark from the 19 allowed engine subpaths',
  next: 'Compose the mark through CartesianChart marks',
  fixture: 'import-bypass/engine-subpath.tsx',
}

/** `import { useReactTable }` from anywhere, and `Table.useReactTable()` through a namespace. */
const directReactTable: AstForm = {
  id: 'react-table-hook',
  detect: ({ report }) => ({
    ImportSpecifier(node) {
      if (nameOf(child(node, 'imported')) === 'useReactTable') report(node, 'useReactTable')
    },
    CallExpression(node) {
      const callee = child(node, 'callee')
      if (callee?.type !== 'MemberExpression' || callee['computed'] === true) return
      if (nameOf(child(callee, 'property')) === 'useReactTable') report(node, 'useReactTable()')
    },
  }),
  fix: 'Render the table with DataTable from basalt-ui/table',
  next: 'A static table is ui/table',
  fixture: 'import-bypass/react-table-hook.tsx',
}

const UI_PREFIX = 'components/ui/'

/** `@/components/ui/button` and `src/components/ui/button.tsx` both name `button`. */
const uiName = (path: string): string => {
  const at = path.lastIndexOf(UI_PREFIX)
  const rest = at === -1 ? path : path.slice(at + UI_PREFIX.length)
  return rest.replace(/\.[cm]?[jt]sx?$/, '').replace(/\/index$/, '')
}

const ejectedNames = (options: readonly unknown[]): Set<string> => {
  const [first] = options
  const list = (first as { ejected?: unknown } | undefined)?.ejected
  return new Set(Array.isArray(list) ? list.filter((p) => typeof p === 'string').map(uiName) : [])
}

const uiPath: AstForm = {
  id: 'ui-path',
  detect: ({ context, report }) => {
    const ejected = ejectedNames(context.options)
    return sourceVisitor((node, source) => {
      if (!within(source, '@/components/ui')) return
      if (ejected.has(uiName(source))) return
      report(node, source)
    })
  },
  fix: 'Import the primitive from basalt-ui/ui/<name>; only an ejected copy has a local path',
  next: 'Eject the primitive with basalt-ui eject, then import the copy',
  fixture: 'import-bypass/ui-path.tsx',
}

/** `useChat()` or `x.useChat({ ...})` without a `chat` option (`unlessCallHas: 'chat'`). */
const useChatWithoutChat: AstForm = {
  id: 'use-chat-chat',
  detect: ({ report }) => ({
    CallExpression(node) {
      const callee = child(node, 'callee')
      const member = callee?.type === 'MemberExpression' && callee['computed'] !== true
      const name = member ? nameOf(child(callee, 'property')) : nameOf(callee)
      if (name !== 'useChat') return
      const [first] = children(node, 'arguments')
      if (first === undefined) return report(node, 'useChat()')
      // An opaque argument (a variable, a call) may carry `chat`; only a literal object is proof.
      if (first.type !== 'ObjectExpression') return
      const props = children(first, 'properties')
      const hasChat = props.some((property) => {
        if (property.type === 'SpreadElement') return true
        const key = child(property, 'key')
        return property['computed'] !== true && (nameOf(key) ?? stringValue(key)) === 'chat'
      })
      if (!hasChat) report(node, 'useChat()')
    },
  }),
  fix: 'Create the Chat outside the hook and pass it: useChat({ chat })',
  next: 'useAgentStream from basalt-ui/ai owns the transport',
  fixture: 'import-bypass/use-chat-chat.tsx',
}

/**
 * A persistence route outside an adapter. A file that mentions `StorageLike` (imports it, names
 * it in a type or declares it) is the adapter, so it is read at `Program:exit` once the whole
 * file has been seen.
 */
const persistRoute: AstForm = {
  id: 'persist-storage',
  detect: ({ report }) => {
    const found: { node: Node; subject: string }[] = []
    let adapter = false
    return {
      ...sourceVisitor((node, source) => {
        if (STORAGE_PACKAGES.has(source) || [...STORAGE_PACKAGES].some((p) => within(source, p))) {
          found.push({ node, subject: source })
          return
        }
        const names = STORAGE_NAMES[source]
        if (!names) return
        const specifiers = children(node, 'specifiers')
        // A namespace import, `export *`, `import()` and `require()` cannot be narrowed to a name.
        const namespace =
          (node.type !== 'ImportDeclaration' && node.type !== 'ExportNamedDeclaration') ||
          specifiers.some((s) => s.type === 'ImportNamespaceSpecifier')
        const hit = specifiers.find(
          (s) =>
            s.type !== 'ImportNamespaceSpecifier' &&
            names.has(nameOf(child(s, 'imported')) ?? nameOf(child(s, 'local')) ?? ''),
        )
        if (namespace || hit) found.push({ node, subject: source })
      }),
      Identifier(node) {
        if (node['name'] === 'StorageLike') adapter = true
      },
      'Program:exit'() {
        if (adapter) return
        for (const { node, subject } of found) report(node, subject)
      },
    }
  },
  fix: 'Use persisted(key) from basalt-ui, or implement the backend as a StorageLike adapter',
  next: 'persisted.setStorage selects the app-wide backend',
  fixture: 'import-bypass/persist-storage.tsx',
}

const FORMS: readonly AstForm[] = [
  packageForm(
    'base-ui',
    ['@base-ui/react', '@base-ui-components/react'],
    'Import the owned primitive from basalt-ui/ui/<name>',
    'Eject the primitive with basalt-ui eject, then edit the copy',
  ),
  packageForm(
    'radix',
    ['@radix-ui', 'radix-ui'],
    'Import the owned primitive from basalt-ui/ui/<name>; Radix is not in the stack',
    'Eject the primitive with basalt-ui eject, then edit the copy',
  ),
  packageForm(
    'cmdk',
    ['cmdk'],
    'Use CommandPalette from basalt-ui/shell (+0.9 KB against cmdk +16.0 KB and 24 packages)',
    'defineCommands lists a command in the palette',
  ),
  packageForm(
    'sonner',
    ['sonner'],
    'Call notify() and mount ToastHost from basalt-ui/page',
    'ui/toast for a toast with its own placement',
  ),
  packageForm(
    'streamdown',
    ['streamdown'],
    'Render model text with Markdown contentTrust from basalt-ui/content',
    'partView for a streamed part',
  ),
  packageForm(
    'tailwind-merge',
    ['tailwind-merge'],
    'Compose classes with cn() from basalt-ui; twMerge drops text-red-500 beside text-display',
    'A cva variant per state',
  ),
  packageForm(
    'visx',
    ['@visx'],
    'Use a chart kind from basalt-ui/charts, or CartesianChart marks',
    'Compose the mark from the allowed engine subpaths',
  ),
  engineOutsideList,
  directReactTable,
  uiPath,
  useChatWithoutChat,
  persistRoute,
]

export const IMPORT_BOUNDARY: RuleEntry = {
  family: 'import',
  profiles: ['parts', 'app'],
  defect:
    'Argo copy-pasted ban silently replaced by extends; cmdk +16.0 KB and 24 packages; streamdown +152.2 vs +56.8 KB; tailwind-merge drops text-red-500 beside text-display',
  forms: FORMS,
  schema: OPTIONS_SCHEMA,
}

export const importBoundaryRules = defineRules({ 'import-boundary': IMPORT_BOUNDARY })
