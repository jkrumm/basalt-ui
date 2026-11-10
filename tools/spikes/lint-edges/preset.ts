/**
 * SYNTHETIC preset for spike 624 (docs/v3/concepts/guardrails.md section 13, S7 and S8).
 *
 * No v3 preset exists yet (gr-4 waits on this spike), so the regexes below are stand-ins: one rule
 * per form of section 4 (59 in all, counted by `FORMS.length`), shaped like the real forms but not
 * their final patterns. What this file is good for is cost and plumbing, never detection quality.
 *
 * The plugin is one JS file generated from the `FORMS` data array (at most 150 lines, asserted in
 * `writePlugin`), plus the bought `@shadcn/lint` rules.
 */
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// `on` picks the AST hook: str = string literals and template quasis, tpl = quasis only,
// import = import source, jsx = element name, src = whole source text, cmt = comment text.
export type Hook = 'str' | 'tpl' | 'import' | 'jsx' | 'src' | 'cmt'
export type Form = { id: string; form: string; on: Hook; re: string; msg: string }

const f = (id: string, form: string, on: Hook, re: string, msg: string): Form => ({
  id,
  form,
  on,
  re,
  msg,
})
const V = '(^|[\\s:!])'

export const FORMS: readonly Form[] = [
  f(
    'viewport-keyed',
    'prefix',
    'str',
    `${V}(max-|min-)?(sm|md|lg|xl|2xl):`,
    'Use @narrow: @regular: @wide:',
  ),
  f('viewport-keyed', 'arbitrary', 'str', `${V}(min|max)-\\[`, 'Use @narrow: @regular: @wide:'),
  f(
    'viewport-keyed',
    'js',
    'src',
    '\\b(matchMedia|useMediaQuery)\\(',
    'Use useSizeClass for chrome',
  ),
  f('dark-fork', 'dark', 'str', `${V}dark:`, 'Add the token, it switches per scheme'),
  f(
    'fixed-colour',
    'bw',
    'str',
    `${V}(bg|text|border|ring|fill|stroke)-(black|white)(/\\d+)?(\\s|$)`,
    'Use on-brand',
  ),
  f(
    'status-fill-as-text',
    'fill',
    'str',
    `${V}text-(brand-fill|dim-bar|chart-\\d+)`,
    'Use Status or Num tone',
  ),
  f('raw-scroll', 'overflow', 'str', `${V}overflow(-[xy])?-(auto|scroll)`, 'Use ui/scroll-area'),
  f('tw-off-law', 'ladder', 'str', `${V}-?(p|m|gap)[xytblr]?-\\d+\\.(25|75)`, 'Pick a ladder step'),
  f(
    'tw-off-law',
    'surface',
    'str',
    `${V}(bg-card|bg-inset|shadow-card|rounded-card)`,
    'Use Card or Inset',
  ),
  f(
    'tw-off-law',
    'colour',
    'str',
    `${V}(text|bg|border|ring|outline|divide|from|via|to|fill|stroke|accent|caret)-(\\(--vx-|brand|good|warn|bad|info|chart-\\d|seq-\\d)`,
    'Use Status or Lozenge',
  ),
  f('tw-off-law', 'alpha', 'str', `(hairline|hover|selected|scrim)/\\d+`, 'Use a pre-mixed token'),
  f(
    'tw-off-law',
    'container',
    'str',
    `${V}@(?!narrow|regular|wide|max-|min-)[a-z0-9\\[]+:`,
    'Use @narrow: @regular: @wide:',
  ),
  f('tw-off-law', 'important', 'str', `${V}(!\\w|[\\w-]+!(\\s|$))`, 'Fix the cascade'),
  f('tw-off-law', 'template', 'tpl', '-$', 'Use a cva variant'),
  f('tw-off-law', 'width', 'str', `${V}(min-)?w-(\\d{3,}|\\[\\d{3,}px\\])`, 'Parent-owned width'),
  f('tw-off-law', 'text-alpha', 'str', `${V}text-[\\w-]+/\\d+`, 'Use text-faint'),
  f('app-spacing', 'space', 'str', `${V}space-[xy]-`, 'Use gap on the parent'),
  f('app-spacing', 'margin', 'str', `${V}-?m[xytblrse]?-(?!auto)\\d`, 'Use gap on the parent'),
  f('import-boundary', 'base-ui', 'import', '^@base-ui/react', 'Use the owned entry'),
  f('import-boundary', 'radix', 'import', '^@radix-ui/', 'Use the owned entry'),
  f('import-boundary', 'cmdk', 'import', '^cmdk$', 'Use the owned entry'),
  f('import-boundary', 'sonner', 'import', '^sonner$', 'Use the owned entry'),
  f('import-boundary', 'streamdown', 'import', '^streamdown$', 'Use Markdown'),
  f('import-boundary', 'tailwind-merge', 'import', '^tailwind-merge$', 'Use cn'),
  f('import-boundary', 'visx', 'import', '^@visx/', 'Use the chart engine entry'),
  f('import-boundary', 'engine', 'import', '^@tanstack/charts/(?!react$)', 'Use the owned entry'),
  f('import-boundary', 'table', 'src', '\\buseReactTable\\b', 'Use DataTable'),
  f('import-boundary', 'ui-alias', 'import', '^@/components/ui/', 'Eject first'),
  f('import-boundary', 'use-chat', 'src', 'useChat\\(\\s*\\)', 'Pass chat'),
  f('import-boundary', 'persist', 'import', '^zustand/middleware', 'Use persisted'),
  f('primitive-bypass', 'controls', 'jsx', '^(button|input|select|textarea)$', 'Use ui/*'),
  f('primitive-bypass', 'checkbox', 'src', 'type=["\']?(checkbox|radio)', 'Use ui/checkbox'),
  f('primitive-bypass', 'headings', 'jsx', '^h[1-6]$', 'Use Section or PageBar'),
  f('primitive-bypass', 'table', 'jsx', '^table$', 'Use ui/table or DataTable'),
  f('primitive-bypass', 'svg-marks', 'jsx', '^(path|circle|rect|line)$', 'Use ChartCard'),
  f('primitive-bypass', 'intl', 'src', 'new Intl\\.\\w+Format|\\.toLocale\\w*\\(', 'Use useFormat'),
  f('primitive-bypass', 'role', 'src', 'role=["\'](table|grid)', 'Use DataTable'),
  f(
    'primitive-bypass',
    'sorted-rows',
    'src',
    '\\.(sort|slice)\\([^)]*\\)\\.map\\(',
    'Use DataTable',
  ),
  f(
    'primitive-bypass',
    'datapanel',
    'src',
    '<DataPanel[^>]*body=\\{<(Area|Line|Bar)Chart',
    'Use ChartCard',
  ),
  f(
    'control-home',
    'outside',
    'jsx',
    '^(Select|Combobox|Switch|Checkbox|Slider)$',
    'Wrap in ControlHome',
  ),
  f('router-search', 'link', 'src', 'search=\\{\\{', 'Use field.link()'),
  f(
    'router-search',
    'deps',
    'src',
    'loaderDeps:\\s*\\(\\{\\s*search\\s*\\}\\)\\s*=>\\s*search\\b',
    'Narrow deps',
  ),
  f('router-search', 'transition', 'jsx', '^ViewTransition$', 'Use the router option'),
  f(
    'router-search',
    'validate',
    'src',
    'validateSearch[^]{0,400}?\\b(window|document|localStorage|sessionStorage|Date|Math\\.random)\\b',
    'Use a pure validator',
  ),
  f('data-primitive', 'interval', 'src', '\\brefetchInterval(InBackground)?\\b', 'Use liveQuery'),
  f('data-primitive', 'channel', 'src', 'new (EventSource|WebSocket)\\(', 'Use createChannel'),
  f('data-primitive', 'reader', 'src', '\\.getReader\\(\\)', 'Use createChannel'),
  f(
    'data-primitive',
    'deprecated',
    'src',
    'queryClient\\.(fetchQuery|getQueryData)\\(',
    'Use queryClient.query()',
  ),
  f('data-primitive', 'client', 'src', 'new QueryClient\\(', 'Use makeQueryClient'),
  f('data-primitive', 'fallback', 'src', 'data=\\{[^}]*\\?\\?\\s*\\[\\]\\s*\\}', 'Use phase'),
  f(
    'data-primitive',
    'timer',
    'src',
    'set(Interval|Timeout)\\([^)]*(invalidateQueries|refetchQueries|refetch)',
    'Use liveQuery',
  ),
  f('data-primitive', 'storage', 'src', '(local|session)Storage\\.setItem', 'Use persisted'),
  f(
    'untrusted-markdown',
    'html',
    'src',
    'dangerouslySetInnerHTML=\\{\\{\\s*__html:\\s*[^\'"`\\s]',
    'Use Markdown',
  ),
  f('untrusted-markdown', 'rehype-raw', 'import', '^rehype-raw$', 'Use Markdown'),
  f('untrusted-markdown', 'mdx', 'import', '^(@mdx-js/mdx|next-mdx-remote)', 'Use Markdown'),
  f('untrusted-markdown', 'trusted', 'src', 'contentTrust=["\']trusted', 'Use trust tiers'),
  f(
    'colour-literal',
    'literal',
    'str',
    '^(#[0-9a-fA-F]{3,8}|(rgb|hsl|oklch|oklab|color-mix)a?\\(.*)$',
    'Use VX.* or alpha',
  ),
  f(
    'waiver-needs-reason',
    'reason',
    'cmt',
    '^\\s*oxlint-disable(-next-line|-line)?\\s+[^\\s]+\\s*$',
    'Add -- <why>',
  ),
  f(
    'waiver-needs-reason',
    'file-level',
    'cmt',
    '^\\s*oxlint-disable\\s',
    'File-level needs deepRender',
  ),
]

export const ruleName = (x: Form): string => `${x.id}-${x.form}`

const ENGINE = `const hit = (ctx, f, node, text) => f.re.test(text) && ctx.report({ node, message: f.msg })
const lineOf = (text, i) => text.slice(0, i).split('\\n').length
const rule = (f) => ({
  meta: { type: 'problem' },
  create(ctx) {
    f = { ...f, re: new RegExp(f.re) }
    const src = ctx.sourceCode
    const hooks = {
      str: { Literal: (n) => typeof n.value === 'string' && hit(ctx, f, n, n.value), TemplateElement: (n) => hit(ctx, f, n, n.value.raw) },
      tpl: { TemplateElement: (n) => hit(ctx, f, n, n.value.raw) },
      import: { ImportDeclaration: (n) => hit(ctx, f, n, n.source.value) },
      jsx: { JSXOpeningElement: (n) => hit(ctx, f, n, n.name.name ?? '') },
      src: { Program() {
        const m = f.re.exec(src.text)
        if (!m) return
        const line = lineOf(src.text, m.index)
        ctx.report({ loc: { start: { line, column: 0 }, end: { line, column: 1 } }, message: f.msg })
      } },
      cmt: { Program() {
        for (const c of src.getAllComments()) if (f.re.test(c.value)) ctx.report({ loc: c.loc, message: f.msg })
      } },
    }
    return hooks[f.on]
  },
})
export default { meta: { name: 'basalt' }, rules: Object.fromEntries(FORMS.map((f) => [f.id + '-' + f.form, rule(f)])) }
`

/** The generated plugin source. Asserted to stay within the 150-line cap. */
export function pluginSource(): string {
  const data = FORMS.map((x) => `  ${JSON.stringify(x)},`).join('\n')
  const source = `// GENERATED by spike 624 (synthetic preset): ${FORMS.length} regex rules from one data array.\nconst FORMS = [\n${data}\n]\n${ENGINE}`
  const lines = source.split('\n').length
  if (lines > 150) throw new Error(`generated plugin is ${lines} lines, cap is 150`)
  return source
}

export const SHADCN_RULES = [
  'no-restyle',
  'no-raw-colors',
  'no-arbitrary-values',
  'no-inline-styles',
  'no-unknown-classes',
  'require-static-classes',
] as const

const THEME_CSS = `@import "tailwindcss";
@theme {
  --color-*: initial;
  --color-background: var(--vx-bg);
  --color-foreground: var(--vx-ink);
  --color-muted: var(--vx-muted);
  --color-accent: var(--vx-accent);
  --color-brand: var(--vx-accent);
  --color-good: var(--vx-good);
  --radius-*: initial;
  --radius-md: 6px;
  --radius-lg: 8px;
  --text-*: initial;
  --text-sm: 13px;
  --text-base: 14px;
  --spacing: 4px;
  --shadow-*: initial;
  --shadow-card: 0 1px 2px rgb(0 0 0 / 0.05);
}
:root { --vx-bg: #fff; --vx-ink: #111; --vx-muted: #666; --vx-accent: #06c; --vx-good: #080; }
`

export type Level = 'bare' | 'basalt' | 'shadcn' | 'full'

/** Config at four stacking levels, so S7 can split the cost: native only, +59 rules, +bought, both. */
export function configFor(level: Level, plugin = './basalt-plugin.js'): object {
  const rules: Record<string, unknown> = {}
  const jsPlugins: string[] = []
  if (level === 'basalt' || level === 'full') {
    jsPlugins.push(plugin)
    for (const x of FORMS) rules[`basalt/${ruleName(x)}`] = 'error'
  }
  if (level === 'shadcn' || level === 'full') {
    jsPlugins.push('@shadcn/lint')
    for (const r of SHADCN_RULES) rules[`shadcn/${r}`] = 'error'
    rules['shadcn/no-restyle'] = [
      'error',
      {
        contracts: [
          {
            pattern: 'Button',
            deny: ['h-*', 'min-h-*', 'size-*'],
            message: 'Use a variant, then the ladder',
          },
        ],
      },
    ]
  }
  return {
    plugins: ['react', 'typescript', 'jsx-a11y'],
    categories: { correctness: 'error' },
    jsPlugins,
    rules,
    settings: { shadcn: { componentImports: ['^basalt-ui/ui/'] } },
  }
}

/** Write the plugin, theme, components.json, per-level configs and a node_modules link into `dir`. */
export function writeSynthetic(dir: string): void {
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(join(dir, 'basalt-plugin.js'), pluginSource())
  writeFileSync(join(dir, 'src/styles.css'), THEME_CSS)
  writeFileSync(
    join(dir, 'components.json'),
    JSON.stringify({ tailwind: { css: 'src/styles.css' } }),
  )
  for (const level of ['bare', 'basalt', 'shadcn', 'full'] as const) {
    writeFileSync(join(dir, `oxlintrc.${level}.json`), JSON.stringify(configFor(level), null, 2))
  }
  const link = join(dir, 'node_modules')
  try {
    symlinkSync(resolve(import.meta.dirname, 'node_modules'), link)
  } catch {
    // already linked
  }
}
