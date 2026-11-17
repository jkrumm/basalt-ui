/**
 * `import-boundary` (guardrails section 4, row 8): the import routes an agent reaches first around
 * the owned entries. 2.x had these as one hand-copied ban that an `extends` silently replaced; here
 * each route is a form with its own fix token and fixture.
 *
 * Fourteen forms: eight package bans, the engine allowlist, direct `useReactTable` (an import, or a
 * re-export of it from a module; `export *` is not read, it names no hook) or a table engine
 * (`@tanstack/table-core`, AG Grid, react-data-grid, MUI X Data Grid, Material React Table), the
 * un-ejected `@/components/ui/*` path, `useChat()` without a `chat` option, persist libraries
 * outside a `StorageLike` adapter and `rival-signature`. The repo-only rows (layer table, single
 * `host.tsx` importer) are not here: a form carries no profile of its own and this rule ships at
 * `parts` and `app`.
 *
 * The `ui-path` form reads `@/`, `~/`, `#/`, `src/` and relative `components/ui/<name>` paths; an ejected name
 * stays legal however it is spelled. No form reports an icon set (`@radix-ui/react-icons`,
 * `@mui/icons-material`): an icon prop takes the icon library's own component. The `radix` form
 * bans a kit's whole npm scope (`@mui/*`, `@heroui/*`, every package of the 2.x UI stack) but the
 * 2.x stack's hooks set, a set with no UI whose storage hooks `persist-storage` reads. The
 * `tailwind-merge` form also reads `cn` imported from the shadcn `lib/utils` file, which is clsx
 * plus twMerge.
 *
 * Two layers decide what a rival is (the Spec on lint-7.5). The ban rows are a DENYLIST, the
 * precise layer: each names the rival packages an agent reaches for first in its category and the
 * basalt part that replaces them. Under it, `rival-signature` reads an unscoped package on no row
 * and outside the stack by its signature: a category word in its name or an overlay, picker or grid it is
 * imported for. An allow list in place of the rows was measured and rejected: it lost 29 of 111
 * seeds and reported domain libraries (React Email's `Button`, react-leaflet's `Tooltip`).
 *
 * Option: `{ ejected?: string[] }`, the paths of `manifest.ejected`. An entry may be a
 * `@/components/ui/<name>` specifier or a file path under `components/ui/`. An ejected file is the
 * primitive's owned copy, so its own `@base-ui` import is the one thing it exists to hold.
 */
import type { Node, RuleContext, Visitor } from '../../factory'
import { mergeVisitors } from '../../factory'
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
  '@nanostores/persistent',
  '@tanstack/query-sync-storage-persister',
  '@tanstack/query-async-storage-persister',
  '@tanstack/react-query-persist-client',
  'idb-keyval',
  'localforage',
])

/** Packages that are only a route through named specifiers. */
const STORAGE_NAMES: Readonly<Record<string, ReadonlySet<string>>> = {
  'zustand/middleware': new Set(['persist', 'createJSONStorage']),
  'jotai/utils': new Set(['atomWithStorage', 'createJSONStorage']),
  // A 2.x storage hook is a persistence route; basalt itself depends on none.
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

/** The names a declaration imports or re-exports by name (`{ Dialog }`, `export { Dialog } from`). */
const importedNames = (node: Node): string[] =>
  children(node, 'specifiers').flatMap((s) => {
    const name = nameOf(child(s, 'imported')) ?? nameOf(child(s, 'local'))
    return s.type === 'ImportSpecifier' || s.type === 'ExportSpecifier' ? [name ?? ''] : []
  })

/** `pkg` itself or any subpath of it. */
const within = (source: string, pkg: string): boolean =>
  source === pkg || source.startsWith(`${pkg}/`)

/** A listed package, or `name*` for a family (`victory-*`): the package itself, a subpath or a sibling. */
const listed = (source: string, entry: string): boolean =>
  entry.endsWith('*') ? source.startsWith(entry.slice(0, -1)) : within(source, entry)

/** The npm package a specifier names: `@scope/name` or `name`, without the subpath. */
const packageOf = (source: string): string =>
  source
    .split('/')
    .slice(0, source.startsWith('@') ? 2 : 1)
    .join('/')

/** Icon sets whose name carries no `icon` (`react-feather` exports `PieChart`, a chart's name). */
const ICON_SETS: ReadonlySet<string> = new Set([
  'lucide',
  'lucide-react',
  'react-feather',
  'phosphor-react',
])

/**
 * An icon set (`@radix-ui/react-icons`, `@mui/icons-material`, `react-icons`, lucide): an icon prop
 * takes the icon library's own component, so no form reports one, even inside a banned kit's scope.
 */
const isIconSet = (source: string): boolean => {
  const pkg = packageOf(source)
  return ICON_SETS.has(pkg) || /icons?(?:[-/]|$)/.test(pkg)
}

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

type HostContext = RuleContext & { readonly filename?: string; readonly physicalFilename?: string }

const ejectedPaths = (options: readonly unknown[]): string[] => {
  const [first] = options
  const list = (first as { ejected?: unknown } | undefined)?.ejected
  return Array.isArray(list) ? list.filter((p): p is string => typeof p === 'string') : []
}

/** Whether the linted file is one of the `manifest.ejected` paths (a file entry, not a specifier). */
const isEjectedFile = (context: RuleContext): boolean => {
  const host = context as HostContext
  const file = (host.physicalFilename ?? host.filename ?? '').replaceAll('\\', '/')
  return ejectedPaths(context.options).some((path) => {
    const entry = path.replaceAll('\\', '/').replace(/^\.\//, '')
    return /\.[cm]?[jt]sx?$/.test(entry) && (file === entry || file.endsWith(`/${entry}`))
  })
}

/**
 * A package ban: one row of the DENYLIST of the rival packages an agent reaches for first. An entry
 * is a package, a `name*` family or a whole npm scope (`@mui/*`); an icon set never reports. A
 * package on no list is read by `rival-signature` below. A new rival is a line in its row.
 */
type PackageBan = {
  readonly id: string
  readonly packages: readonly string[]
  readonly fix: string
  readonly next: string
  readonly allowInEjected?: boolean
  readonly except?: readonly string[]
}

const isBanned = ({ packages, except = [] }: PackageBan, source: string): boolean =>
  !isIconSet(source) &&
  !except.some((pkg) => listed(source, pkg)) &&
  packages.some((pkg) => listed(source, pkg))

const packageForm = (ban: PackageBan): AstForm => ({
  id: ban.id,
  detect: ({ context, report }) => {
    if (ban.allowInEjected === true && isEjectedFile(context)) return {}
    return sourceVisitor((node, source) => {
      if (isBanned(ban, source)) report(node, source)
    })
  },
  fix: ban.fix,
  next: ban.next,
  fixture: `import-bypass/${ban.id}.tsx`,
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

/**
 * Table engines a consumer builds a table on instead of DataTable: TanStack Table's framework-free
 * core (`createTable`), AG Grid, react-data-grid and MUI X Data Grid (`@mui/x-data-grid*`, its -pro
 * and -premium too). `@tanstack/react-table` itself stays legal for its column types
 * and helpers; its hook is read by name below.
 */
const TABLE_PACKAGES: readonly string[] = [
  '@tanstack/table-core',
  'ag-grid-react',
  'ag-grid-community',
  'ag-grid-enterprise',
  'react-data-grid',
  '@mui/x-data-grid*',
  'material-react-table',
  'mantine-react-table',
]

/**
 * `import { useReactTable }` from anywhere, `Table.useReactTable()` through a namespace, and any
 * import of a table engine in `TABLE_PACKAGES`.
 */
const directReactTable: AstForm = {
  id: 'react-table-hook',
  detect: ({ report }) =>
    mergeVisitors([
      sourceVisitor((node, source) => {
        if (TABLE_PACKAGES.some((pkg) => listed(source, pkg))) report(node, source)
      }),
      reactTableHook(report),
    ]),
  fix: 'Render the table with DataTable from basalt-ui/table',
  next: 'A static table is ui/table',
  fixture: 'import-bypass/react-table-hook.tsx',
}

function reactTableHook(report: (node: Node, subject: string) => void): Visitor {
  return {
    ImportSpecifier(node) {
      if (nameOf(child(node, 'imported')) === 'useReactTable') report(node, 'useReactTable')
    },
    // A re-export from a module reads the hook; `export { useReactTable }` of a local is not one.
    ExportNamedDeclaration(node) {
      if (stringValue(child(node, 'source')) === undefined) return
      for (const specifier of children(node, 'specifiers')) {
        if (nameOf(child(specifier, 'local')) === 'useReactTable')
          report(specifier, 'useReactTable')
      }
    },
    CallExpression(node) {
      const callee = child(node, 'callee')
      if (callee?.type !== 'MemberExpression' || callee['computed'] === true) return
      if (nameOf(child(callee, 'property')) === 'useReactTable') report(node, 'useReactTable()')
    },
  }
}

const UI_PREFIX = 'components/ui/'

/** `@/components/ui/button` and `src/components/ui/button.tsx` both name `button`. */
const uiName = (path: string): string => {
  const at = path.lastIndexOf(UI_PREFIX)
  const rest = at === -1 ? path : path.slice(at + UI_PREFIX.length)
  return rest.replace(/\.[cm]?[jt]sx?$/, '').replace(/\/index$/, '')
}

/** The shadcn alias (`@/`, `~/`, `#/`), a `src/` rooted path or a relative path into `components/ui`, not a package's own. */
const isUiPath = (source: string): boolean =>
  /^(?:[@~#]\/|src\/|(?:\.{1,2}\/)+(?:[^/]+\/)*?)components\/ui(?:\/|$)/.test(source)

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
      if (!isUiPath(source)) return
      if (ejected.has(uiName(source))) return
      report(node, source)
    })
  },
  fix: 'Import the primitive from basalt-ui/ui/<name>; only an ejected copy has a local path',
  next: 'Eject the primitive with basalt-ui eject, then import the copy',
  fixture: 'import-bypass/ui-path.tsx',
}

/** A props list that proves `chat` (a `chat` key or a spread, which may carry it). */
const carriesChat = (object: Node): boolean =>
  children(object, 'properties').some((property) => {
    if (property.type === 'SpreadElement') return true
    const key = child(property, 'key')
    return property['computed'] !== true && (nameOf(key) ?? stringValue(key)) === 'chat'
  })

/**
 * `useChat()` or `x.useChat({ ...})` without a `chat` option (`unlessCallHas: 'chat'`). The hook is
 * also read under an import alias (`import { useChat as useLegacyChat } from 'ai/react'`), and an
 * identifier argument is resolved when it is a same-file `const` object literal; any other
 * opaque argument (a parameter, a call, an import) may carry `chat` and passes.
 */
const useChatWithoutChat: AstForm = {
  id: 'use-chat-chat',
  detect: ({ report }) => {
    const aliases = new Set<string>(['useChat'])
    const objects = new Map<string, Node>()
    const calls: Node[] = []
    return {
      ImportSpecifier(node) {
        if (nameOf(child(node, 'imported')) !== 'useChat') return
        const local = nameOf(child(node, 'local'))
        if (local !== undefined) aliases.add(local)
      },
      VariableDeclarator(node) {
        const id = nameOf(child(node, 'id'))
        const init = child(node, 'init')
        if (id !== undefined && init?.type === 'ObjectExpression') objects.set(id, init)
      },
      CallExpression(node) {
        calls.push(node)
      },
      'Program:exit'() {
        for (const node of calls) {
          const callee = child(node, 'callee')
          const member = callee?.type === 'MemberExpression' && callee['computed'] !== true
          const name = member ? nameOf(child(callee, 'property')) : nameOf(callee)
          if (name === undefined || !(member ? name === 'useChat' : aliases.has(name))) continue
          const [first] = children(node, 'arguments')
          if (first === undefined) {
            report(node, 'useChat()')
            continue
          }
          const options = first.type === 'Identifier' ? objects.get(first['name'] as string) : first
          if (options?.type !== 'ObjectExpression') continue
          if (!carriesChat(options)) report(node, 'useChat()')
        }
      },
    }
  },
  fix: 'Create the Chat outside the hook and pass it: useChat({ chat })',
  next: 'Render the messages with partView from basalt-ui/ai',
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

const PACKAGE_BANS: readonly PackageBan[] = [
  {
    id: 'base-ui',
    packages: [
      '@base-ui/react',
      '@base-ui-components/react',
      'react-day-picker',
      '@tanstack/react-virtual',
      '@tanstack/virtual-core',
      'react-virtuoso',
      'react-window',
      'react-datepicker',
    ],
    fix: 'Import the owned primitive from basalt-ui/ui/<name>: date-picker, virtual-list',
    next: 'Eject the primitive with basalt-ui eject, then edit the copy',
    allowInEjected: true,
  },
  {
    id: 'radix',
    // A kit's whole npm scope: `@mui/*` but its charts and grids, which `visx` and
    // `react-table-hook` name, and `@ant-design/*` but its charts.
    packages: [
      '@radix-ui',
      'radix-ui',
      'vaul',
      '@headlessui',
      '@floating-ui',
      'react-aria-components',
      'react-aria',
      '@react-aria',
      '@react-stately',
      '@ark-ui',
      '@mantine',
      '@chakra-ui',
      '@mui/*',
      'antd',
      '@ant-design/*',
      '@heroui',
      '@nextui-org',
      '@fluentui',
      '@carbon',
      '@blueprintjs',
      '@shopify/polaris',
      '@zag-js',
      'primereact',
      'react-bootstrap',
      'rsuite',
      'flowbite-react',
      'semantic-ui-react',
    ],
    fix: 'Import the owned primitive from basalt-ui/ui/<name>: popover, menu, tooltip, sheet; Radix, Mantine, Chakra, MUI, Ant Design, HeroUI, React Aria, Ark and Floating UI are not in the stack',
    next: 'Eject the primitive with basalt-ui eject, then edit the copy',
    except: [
      '@mantine/hooks',
      '@mui/x-charts*',
      '@mui/x-data-grid*',
      '@ant-design/charts',
      '@ant-design/plots',
    ],
  },
  {
    id: 'cmdk',
    packages: ['cmdk', 'react-cmdk', 'kbar'],
    fix: 'Use CommandPalette from basalt-ui/shell (+0.9 KB against cmdk +16.0 KB and 24 packages)',
    next: 'defineCommands lists a command in the palette',
  },
  {
    id: 'sonner',
    packages: ['sonner', 'react-hot-toast', 'react-toastify', 'notistack'],
    fix: 'Call notify() and mount ToastHost from basalt-ui/page',
    next: 'ui/toast for a toast with its own placement',
  },
  {
    id: 'streamdown',
    packages: [
      'streamdown',
      'react-markdown',
      'markdown-to-jsx',
      'marked-react',
      'marked',
      'markdown-it',
      'showdown',
      'react-remark',
    ],
    fix: 'Render model text with Markdown contentTrust from basalt-ui/content',
    next: 'partView for a streamed part',
  },
  {
    id: 'tailwind-merge',
    packages: ['tailwind-merge', 'tailwind-variants', 'clsx', 'classnames'],
    fix: 'Compose classes with cn() from basalt-ui; twMerge drops text-red-500 beside text-display',
    next: 'A cva variant per state',
  },
  {
    id: 'visx',
    packages: [
      '@visx',
      'recharts',
      'react-apexcharts',
      '@mui/x-charts*',
      '@tremor/react',
      '@nivo',
      'chart.js',
      'react-chartjs-2',
      'echarts',
      'echarts-for-react',
      'highcharts',
      'highcharts-react-official',
      'victory',
      'victory-*',
      '@observablehq/plot',
      '@ant-design/charts',
      '@ant-design/plots',
    ],
    fix: 'Use a chart kind from basalt-ui/charts, or CartesianChart marks',
    next: 'Compose the mark from the allowed engine subpaths',
  },
  {
    id: 'data-library',
    packages: [
      'swr',
      '@apollo/client',
      'socket.io-client',
      '@microsoft/fetch-event-source',
      'react-use-websocket',
      'reconnecting-websocket',
      'partysocket',
      'nuqs',
      'react-router',
      'react-router-dom',
      'pusher-js',
      'ably',
      'react-query',
      '@reduxjs/toolkit/query',
      'urql',
      'wouter',
      'use-query-params',
    ],
    fix: 'Fetch through the query client and liveQuery from basalt-ui/data, open a stream with createChannel, and keep routes and URL state in basalt-ui/router (a field; TanStack Router, never react-router)',
    next: 'createChannel takes the Transport seam, so a socket is one adapter',
  },
]

/** The shadcn utils file (`@/lib/utils`, `~/lib/utils`, `../lib/utils`): its `cn` is clsx plus twMerge. */
const isShadcnUtils = (source: string): boolean =>
  /^(?:[@~#]\/|src\/|(?:\.{1,2}\/)+(?:[^/]+\/)*?)lib\/utils(?:\.[cm]?[jt]sx?)?$/.test(source)

/**
 * A ban row that also reads the shadcn utils file: `import { cn } from '@/lib/utils'` is the
 * `tailwind-merge` row's defect under a local name.
 */
const withShadcnCn = (form: AstForm): AstForm => ({
  ...form,
  detect: (args) =>
    mergeVisitors([
      form.detect(args),
      sourceVisitor((node, source) => {
        if (isShadcnUtils(source) && importedNames(node).includes('cn'))
          args.report(node, `cn from ${source}`)
      }),
    ]),
})

/** Every package a row bans; `rival-signature` leaves them to their row. */
const isOnAList = (source: string): boolean =>
  PACKAGE_BANS.some((ban) => isBanned(ban, source)) ||
  within(source, ENGINE) ||
  TABLE_PACKAGES.some((pkg) => listed(source, pkg)) ||
  [...STORAGE_PACKAGES].some((pkg) => within(source, pkg)) ||
  STORAGE_NAMES[source] !== undefined

/**
 * The stack's own unscoped packages, which `rival-signature` never reads: basalt-ui's peers and
 * dependencies (a unit test holds every one of them here, on a ban row or scoped).
 */
const STACK_PACKAGES: ReadonlySet<string> = new Set([
  'basalt-ui',
  'react',
  'react-dom',
  'ai',
  'motion',
  'd3-scale',
  'class-variance-authority',
  'rehype-sanitize',
  'remark-gfm',
  'remend',
  'shiki',
  'beautiful-mermaid',
  'eventsource-parser',
  'tailwindcss',
  'vite',
  'vite-plugin-pwa',
  'stylelint',
  'postcss-html',
])
/** The first segment of a `baseUrl`-rooted path an app writes (`components/DataTable`), not a package. */
const LOCAL_ROOTS: ReadonlySet<string> = new Set([
  'src',
  'app',
  'components',
  'features',
  'lib',
  'hooks',
  'utils',
  'pages',
  'routes',
  'modules',
  'shared',
  'ui',
])

/**
 * An unscoped package specifier: not relative, not an alias (`@/`, `~/`, `#/`), not `node:` or
 * `bun:`, not a `baseUrl` root. A scoped name is never read: a workspace package (`@repo/ui`, an
 * app's own `parts` package on basalt) and a path alias (`@ui/dialog`) look the same as a vendor's,
 * so a scoped kit is a ban row's scope entry instead.
 */
const isUnscopedPackage = (source: string): boolean =>
  !/^(?:\.|\/|[@~#]|[a-z]+:)/.test(source) && !LOCAL_ROOTS.has(source.split('/')[0] ?? '')

const isStack = (source: string): boolean => STACK_PACKAGES.has(packageOf(source))

type RivalPart = {
  readonly kind: string
  readonly part: string
  /** Words a package name starts a segment with (`react-hot-toast`, `react-markdown-view`). */
  readonly words: string
  /** Named imports of a part basalt owns the behaviour of: an overlay, a picker, a grid. */
  readonly names?: readonly string[]
  readonly suffix?: RegExp
  /** A storage route: an adapter file (one that names `StorageLike`) may import it. */
  readonly storage?: true
}

/**
 * The parts basalt ships, by the signature a rival package carries. Generic names (`Button`,
 * `Card`, `Tooltip`, `Menu`, `Table`) are left out on purpose: domain libraries reuse them
 * (React Email's `Button`, react-leaflet's `Tooltip`).
 */
const RIVAL_PARTS: readonly RivalPart[] = [
  {
    kind: 'chart',
    part: 'a chart kind from basalt-ui/charts',
    words: 'charts?|plotly',
    suffix: /Chart$/,
  },
  { kind: 'markdown', part: 'Markdown from basalt-ui/content', words: 'markdown|marked' },
  {
    kind: 'toast',
    part: 'notify() from basalt-ui',
    words: 'toast|snackbar',
    names: ['Toaster', 'Snackbar'],
  },
  {
    kind: 'table',
    part: 'DataTable from basalt-ui/table',
    words: 'table|data-?grid',
    names: ['DataGrid', 'DataTable'],
  },
  {
    kind: 'command palette',
    part: 'CommandPalette from basalt-ui/shell',
    words: 'cmdk|kbar|command-?palette',
    names: ['CommandPalette', 'Spotlight'],
  },
  {
    kind: 'dialog',
    part: 'basalt-ui/ui/dialog or ui/sheet',
    words: 'modal|dialog|drawer',
    names: ['Dialog', 'AlertDialog', 'Modal', 'Drawer', 'Sheet'],
  },
  {
    kind: 'popover',
    part: 'basalt-ui/ui/popover or ui/tooltip',
    words: 'popover|tooltip',
    names: ['Popover'],
  },
  {
    kind: 'combobox',
    part: 'basalt-ui/ui/combobox',
    words: 'combobox',
    names: ['Combobox', 'Autocomplete'],
  },
  {
    kind: 'date picker',
    part: 'basalt-ui/ui/date-picker',
    words: 'date-?picker|day-?picker',
    names: ['DatePicker', 'DateRangePicker', 'DayPicker'],
  },
  {
    kind: 'storage',
    part: 'persisted(key) from basalt-ui',
    words: 'local-?storage|session-?storage|persist',
    storage: true,
  },
]

const wordOf = (part: RivalPart): RegExp => new RegExp(`(?:^|[-.])(?:${part.words})`)
const BY_WORD: readonly (readonly [RegExp, RivalPart])[] = RIVAL_PARTS.map((p) => [wordOf(p), p])

/** The part a package reads as, by its name first, then by what it is imported for. */
const rivalOf = (node: Node, source: string): { part: RivalPart; by: string } | undefined => {
  const pkg = packageOf(source)
  const byWord = BY_WORD.find(([word]) => word.test(pkg))?.[1]
  if (byWord) return { part: byWord, by: 'its name' }
  for (const name of importedNames(node)) {
    const part = RIVAL_PARTS.find(
      (p) => p.names?.includes(name) === true || p.suffix?.test(name) === true,
    )
    if (part) return { part, by: `its ${name}` }
  }
  return undefined
}

/**
 * `rival-signature`: an unscoped package on no ban row and outside the stack that reads as a part
 * basalt ships, by a word in its name (`react-modal`, `lightweight-charts`) or by the overlay,
 * picker or grid it is imported for (`{ Dialog } from 'tiny-kit/dialog'`). It catches the next ring of
 * rivals before a cycle seeds them; a package that only shares a word is waived on its line.
 */
const rivalSignature: AstForm = {
  id: 'rival-signature',
  detect: ({ report }) => {
    const found: { node: Node; subject: string; storage: boolean }[] = []
    let adapter = false
    return {
      ...sourceVisitor((node, source) => {
        if (!isUnscopedPackage(source) || isStack(source) || isIconSet(source) || isOnAList(source))
          return
        const rival = rivalOf(node, source)
        if (!rival) return
        const subject = `${source}, a ${rival.part.kind} package by ${rival.by}; basalt's is ${rival.part.part}`
        found.push({ node, subject, storage: rival.part.storage === true })
      }),
      Identifier(node) {
        if (node['name'] === 'StorageLike') adapter = true
      },
      'Program:exit'() {
        for (const { node, subject, storage } of found)
          if (!(storage && adapter)) report(node, subject)
      },
    }
  },
  fix: "A package outside basalt's stack for a part basalt ships: import basalt's part, which the subject names",
  next: 'A package that only shares the word is waived on its line, with the reason',
  fixture: 'import-bypass/rival-signature.tsx',
}

const FORMS: readonly AstForm[] = [
  ...PACKAGE_BANS.map((ban) =>
    ban.id === 'tailwind-merge' ? withShadcnCn(packageForm(ban)) : packageForm(ban),
  ),
  engineOutsideList,
  directReactTable,
  uiPath,
  useChatWithoutChat,
  persistRoute,
  rivalSignature,
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
