// Generates oracle.json, once: `bun tools/migrate-v3/bench/make-oracle.ts`. Installs @mantine/core at the
// version in this repo's bun.lock into a scratch directory outside the tree, renders every signature
// with the 2.x basalt scales, measures it at 700, 1100 and 1300 px in headless Chrome and commits the
// numbers. Not part of any gate and never run by the bench: the Mantine side of the comparison is
// frozen here so a v3 change cannot move it.
//
// The "before" theme is the 2.x scale set the contract's section 7 table names: type 12/13/15/16/18 at
// line-height 1.55, spacing 8/12/16/20/24, radius 2/4/6/16/32, breakpoints sm 840 and lg 1200.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HOST_CSS, REPO_ROOT, WIDTHS, fontCss, fontVersion, measure } from './measure.ts'
import { generateSignatures } from './signatures.ts'

export const ORACLE_PATH = join(import.meta.dir, 'oracle.json')

const rem = (px: number) => `${px / 16}rem`
export const MANTINE_THEME = {
  fontSizes: { xs: rem(12), sm: rem(13), md: rem(15), lg: rem(16), xl: rem(18) },
  lineHeights: { xs: '1.55', sm: '1.55', md: '1.55', lg: '1.55', xl: '1.55' },
  spacing: { xs: rem(8), sm: rem(12), md: rem(16), lg: rem(20), xl: rem(24) },
  radius: { xs: rem(2), sm: rem(4), md: rem(6), lg: rem(16), xl: rem(32) },
  breakpoints: { xs: '30em', sm: '52.5em', md: '62em', lg: '75em', xl: '88em' },
}

function lockedVersion(pkg: string): string {
  const lock = readFileSync(join(REPO_ROOT, 'bun.lock'), 'utf8')
  const m = new RegExp(`"${pkg}": \\["${pkg}@([^"]+)"`).exec(lock)
  if (!m) throw new Error(`${pkg} is not in bun.lock`)
  return m[1]!
}

function run(cmd: string[], cwd: string): void {
  const r = Bun.spawnSync(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' })
  if (r.exitCode !== 0) throw new Error(`${cmd.join(' ')} failed:\n${r.stderr.toString()}`)
}

async function main(): Promise<void> {
  const signatures = generateSignatures()
  const mantine = lockedVersion('@mantine/core')
  const dir = mkdtempSync(join(tmpdir(), 'basalt-oracle-'))
  try {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        private: true,
        dependencies: {
          '@mantine/core': mantine,
          '@mantine/hooks': lockedVersion('@mantine/hooks'),
          react: '19.3.0',
          'react-dom': '19.3.0',
        },
      }),
    )
    run(['bun', 'install'], dir)
    const imports = [...new Set(signatures.map((s) => s.tag))].join(', ')
    writeFileSync(
      join(dir, 'sigs.tsx'),
      `import { ${imports} } from '@mantine/core'\nexport const sigs = [\n${signatures.map((s) => `  ${s.jsx},`).join('\n')}\n]\n`,
    )
    writeFileSync(join(dir, 'theme.json'), JSON.stringify(MANTINE_THEME))
    cpSync(join(import.meta.dir, 'mantine-render.tsx'), join(dir, 'mantine-render.tsx'))
    run(['bun', 'mantine-render.tsx'], dir)

    const markup = readFileSync(join(dir, 'markup.html'), 'utf8')
    const css = readFileSync(join(dir, 'node_modules/@mantine/core/styles.css'), 'utf8')
    const page = `<!doctype html><html data-mantine-color-scheme="light"><head><style>${css}</style><style>${fontCss()}${HOST_CSS}</style></head><body>${markup}</body></html>`
    const measured = await measure(page)

    const lines = signatures.map((s, i) =>
      JSON.stringify({ tag: s.tag, jsx: s.jsx, m: measured.map((w) => w[i]) }),
    )
    const meta = JSON.stringify({
      mantine,
      font: fontVersion(),
      widths: [...WIDTHS],
      theme: MANTINE_THEME,
    })
    writeFileSync(ORACLE_PATH, `{"meta":${meta},"sigs":[\n${lines.join(',\n')}\n]}\n`)
    console.log(
      `oracle: ${signatures.length} signatures x ${WIDTHS.length} widths, @mantine/core ${mantine}`,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

if (import.meta.main) await main()
