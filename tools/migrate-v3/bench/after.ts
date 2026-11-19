// The "after" side: run the layout codemod over a signature, turn the JSX it emits into static HTML,
// compile the v3 Tailwind sheet over that HTML and measure it in Chrome.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { transformSource } from '../layout/transform.ts'
import { HOST_CSS, REPO_ROOT, fontCss, sections } from './measure.ts'
import { moduleSource } from './signatures.ts'

/** The JSX of `export const s = (\n  <jsx>\n)` after the codemod, as HTML. Throws when it is not static. */
export function codemodHtml(jsx: string, tag: string): string {
  const { text } = transformSource(moduleSource(jsx, tag), { file: 'sig.tsx', cnImport: './cn.ts' })
  const body = /export const s = \(\n([\s\S]*)\n\)\n$/.exec(text)?.[1]?.trim()
  if (!body) throw new Error(`no JSX body in codemod output for ${jsx}`)
  if (/[{}]/.test(body)) throw new Error(`codemod output is not static HTML: ${body}`)
  return body
    .replace(/\bclassName=/g, 'class=')
    .replace(/<(\w+)((?:\s[^<>]*?)?)\s*\/>/g, '<$1$2></$1>')
}

/** Tailwind v4 over `html` with the v3 sheet, so a class the theme lacks produces no rule. */
function compileV3Css(html: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'basalt-bench-'))
  try {
    writeFileSync(join(dir, 'page.html'), html)
    writeFileSync(
      join(dir, 'in.css'),
      `@import '${join(REPO_ROOT, 'packages/basalt-ui/src/css/tailwind.css')}';\n@source '${join(dir, 'page.html')}';\n`,
    )
    const cli = join(REPO_ROOT, 'node_modules/.bin/tailwindcss')
    const r = Bun.spawnSync(
      [cli, '--input', join(dir, 'in.css'), '--output', join(dir, 'out.css')],
      {
        cwd: REPO_ROOT,
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    if (r.exitCode !== 0) throw new Error(`tailwind failed:\n${r.stderr.toString()}`)
    return readFileSync(join(dir, 'out.css'), 'utf8')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** The complete after page for a signature list. */
export function afterPage(sigs: { tag: string; jsx: string }[]): string {
  const body = sections(sigs.map((s) => codemodHtml(s.jsx, s.tag)))
  const css = compileV3Css(body)
  return `<!doctype html><html data-theme="light"><head><style>${css}</style><style>${fontCss()}${HOST_CSS}</style></head><body>${body}</body></html>`
}
