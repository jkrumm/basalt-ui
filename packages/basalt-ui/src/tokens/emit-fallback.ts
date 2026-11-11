/**
 * The scheme blocks of a generated sheet: light, dark behind the attribute, and the always-on OS
 * fallback (`auto` is the attribute's absence, so a static page follows the OS with no script).
 * The fallback is rendered from the same dark declaration list as the attribute block, never a
 * second copy, and there is no flag to turn it off. Dark sits in `not print`, so a printed page is
 * light with zero extra bytes.
 */
export type Decl = readonly [name: string, value: string]

export type SchemeSelectors = {
  readonly light: string
  readonly dark: string
  readonly auto: string
}

/** One rule at `depth` indentation levels; a multi-line selector is indented line by line. */
export function block(selector: string, decls: readonly Decl[], depth = 0): string {
  const pad = '  '.repeat(depth)
  const lines = decls.map(([name, value]) => `${pad}  ${name}: ${value};`)
  const head = selector
    .split('\n')
    .map((line) => pad + line)
    .join('\n')
  return `${head} {\n${lines.join('\n')}\n${pad}}\n`
}

/**
 * Light, dark and the OS fallback. Each side's list is passed once: `dark` feeds both the
 * attribute block and the fallback, which is what keeps the two string-equal.
 */
export function schemeBlocks(
  selectors: SchemeSelectors,
  light: readonly Decl[],
  dark: readonly Decl[],
): string {
  return (
    block(selectors.light, light) +
    `@media not print {\n${block(selectors.dark, dark, 1)}}\n` +
    `@media not print {\n  @media (prefers-color-scheme: dark) {\n${block(selectors.auto, dark, 2)}  }\n}\n`
  )
}
