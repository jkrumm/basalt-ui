import { STYLELINT_RULES } from './rules'

/** HTML-ish hosts whose `<style>` blocks `postcss-html` extracts. */
export const HTML_STYLE_FILES = ['**/*.astro', '**/*.mdx', '**/*.html']

/** Report options of the preset: a dead or reasonless disable is itself a finding. */
const REPORT_OPTIONS = {
  reportDescriptionlessDisables: true,
  reportInvalidScopeDisables: true,
  reportNeedlessDisables: true,
} as const

export type StylelintConfig = {
  rules: typeof STYLELINT_RULES
  overrides: { files: string[]; customSyntax: string }[]
  ignoreFiles: string[]
  reportDescriptionlessDisables: boolean
  reportInvalidScopeDisables: boolean
  reportNeedlessDisables: boolean
}

export type RenderOptions = {
  /** Generated token sheets (the manifest's `tokens[].out` paths, css only): stylelint cannot read a line-1 marker. */
  ignoreFiles?: readonly string[]
}

/** The config as an object, with `ignoreFiles` listing the generated sheets. */
export function stylelintConfig({ ignoreFiles = [] }: RenderOptions = {}): StylelintConfig {
  return {
    ...REPORT_OPTIONS,
    overrides: [{ files: HTML_STYLE_FILES, customSyntax: 'postcss-html' }],
    ignoreFiles: [...ignoreFiles],
    rules: STYLELINT_RULES,
  }
}

/**
 * The text of `.stylelintrc.basalt.json`: the closed stylelint preset with `ignoreFiles` listing the
 * generated token sheets. v3-sk-3 feeds it to `sync` through the presetFiles seam.
 */
export function renderStylelintConfig(options: RenderOptions = {}): string {
  return `${JSON.stringify(stylelintConfig(options), null, 2)}\n`
}
