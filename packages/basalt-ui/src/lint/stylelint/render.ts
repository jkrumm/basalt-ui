import { disallowedValueList, STYLELINT_RULES } from './rules'

/** HTML-ish hosts whose `<style>` blocks `postcss-html` extracts. */
export const HTML_STYLE_FILES = ['**/*.astro', '**/*.mdx', '**/*.html']

/** Report options of the preset: a dead or reasonless disable is itself a finding. */
const REPORT_OPTIONS = {
  reportDescriptionlessDisables: true,
  reportInvalidScopeDisables: true,
  reportNeedlessDisables: true,
} as const

type Override = {
  files: string[]
  customSyntax?: string
  rules?: Record<string, unknown>
}

export type StylelintConfig = {
  rules: typeof STYLELINT_RULES
  overrides: Override[]
  ignoreFiles: string[]
  reportDescriptionlessDisables: boolean
  reportInvalidScopeDisables: boolean
  reportNeedlessDisables: boolean
}

export type RenderOptions = {
  /**
   * Where the scroll-container ban holds (it needs `ui/scroll-area`, so `parts` and up): `base` for
   * files outside every root, and each root's own flag. Absent, the ban holds everywhere.
   */
  scroll?: { base: boolean; roots: Record<string, boolean> }
  /** Generated token sheets (the manifest's `tokens[].out` paths, css only): stylelint cannot read a line-1 marker. */
  ignoreFiles?: readonly string[]
}

/** The glob of a root relative to the config: `.` is every file. */
const rootGlob = (root: string): string => (root === '.' ? '**' : `${root.replace(/\/+$/, '')}/**`)

const encloses = (outer: string, inner: string): boolean =>
  outer === '.' || inner.startsWith(`${outer}/`)

/**
 * One override per root whose scroll flag differs from what it would inherit: the flag of its
 * nearest enclosing root, else the base. The more specific root comes last so it wins.
 */
function scrollOverrides({ base, roots }: NonNullable<RenderOptions['scroll']>): Override[] {
  const sorted = Object.entries(roots).toSorted(
    ([a], [b]) => a.length - b.length || a.localeCompare(b),
  )
  return sorted.flatMap(([root, scroll]) => {
    const parent = sorted.findLast(([other]) => other !== root && encloses(other, root))
    if (scroll === (parent?.[1] ?? base)) return []
    return [
      {
        files: [rootGlob(root)],
        rules: { 'declaration-property-value-disallowed-list': disallowedValueList(scroll) },
      },
    ]
  })
}

/** The config as an object, with `ignoreFiles` listing the generated sheets. */
export function stylelintConfig({ ignoreFiles = [], scroll }: RenderOptions = {}): StylelintConfig {
  const base = scroll?.base ?? true
  return {
    ...REPORT_OPTIONS,
    overrides: [
      { files: HTML_STYLE_FILES, customSyntax: 'postcss-html' },
      ...(scroll === undefined ? [] : scrollOverrides(scroll)),
    ],
    ignoreFiles: [...ignoreFiles],
    rules: base
      ? STYLELINT_RULES
      : {
          ...STYLELINT_RULES,
          'declaration-property-value-disallowed-list': disallowedValueList(false),
        },
  }
}

/**
 * The text of `.stylelintrc.basalt.json`: the closed stylelint preset with `ignoreFiles` listing the
 * generated token sheets. v3-sk-3 feeds it to `sync` through the presetFiles seam.
 */
export function renderStylelintConfig(options: RenderOptions = {}): string {
  return `${JSON.stringify(stylelintConfig(options), null, 2)}\n`
}
