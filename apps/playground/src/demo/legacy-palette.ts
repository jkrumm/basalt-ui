import { buildPaletteCss } from 'basalt-ui/tokens'
import v3Tokens from 'basalt-ui/tokens.css?inline'

/**
 * The 2.x palette names the v3 chart layer still reads (`--vx-axis`, `--vx-accent`, the tooltip and
 * surface tokens). The 2.x provider injected them keyed on Mantine's scheme attribute; this keeps
 * only the names `tokens.css` does not define, keyed on the v3 scheme (`data-theme`, absent = the
 * OS preference). Where the two palettes share a name the v3 value stands. Delete it when
 * `src/charts/core/theme.ts` and `chartEngineCss` read v3 tokens.
 */
const V3_NAMES = new Set(v3Tokens.match(/--vx-[a-z0-9-]+(?=\s*:)/g))

const keepLegacy = (decls: string): string =>
  decls
    .split('\n')
    .filter((line) => {
      const name = line.match(/^\s*(--[a-z0-9-]+)\s*:/)?.[1]
      return name === undefined || !V3_NAMES.has(name)
    })
    .join('\n')

export function legacyPaletteCss(): string {
  const dark: string[] = []
  const rest = buildPaletteCss().replace(
    /([^{}]+)\{([^{}]*)\}/g,
    (_match, selector: string, decls: string) => {
      const body = keepLegacy(decls)
      const sel = selector.trim()
      if (sel.includes("[data-mantine-color-scheme='dark']")) {
        dark.push(body)
        return ''
      }
      if (sel.includes("[data-mantine-color-scheme='light']")) {
        return `:root, :root[data-theme='light'] {${body}}`
      }
      return `${sel} {${body}}`
    },
  )
  const darkBody = dark.join('\n')
  return [
    rest,
    `:root[data-theme='dark'] {${darkBody}}`,
    `@media (prefers-color-scheme: dark) { :root:not([data-theme]) {${darkBody}} }`,
    ':root { --mantine-scale: 1; }',
  ].join('\n')
}
