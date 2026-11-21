/**
 * check-readme-types: every `ts` / `tsx` block of the package README type-checks, as the recipes do.
 * The README is the first file an author reads; a block that passes `mode: 'client'` where the type
 * wants `{ kind: 'client' }` teaches the wrong call, and only a compile notices.
 *
 * Each block becomes a file under `apps/playground/.readme-types/` (gitignored, so the playground's
 * own `node_modules` resolve) next to `prelude.d.ts`, which declares the few ambient names a block
 * uses without defining them (`Row`, `rows`). One `tsc` run covers them all, against the built
 * package: run it after the build, as `check-recipes-lint` does.
 *
 * A block that cannot stand alone carries `<!-- readme-check: skip <reason> -->` on the line above
 * its fence; the reason is required, so a skip is a stated exception and never a silent one.
 *
 * Usage: bun packages/basalt-ui/scripts/check-readme-types.ts [<readme.md>]
 * Exit 0 clean; 1 with tsc's findings mapped back to the README line.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..', '..', '..')
const PLAYGROUND = join(ROOT, 'apps', 'playground')
const DEFAULT_README = join(ROOT, 'packages', 'basalt-ui', 'README.md')
const OUT = '.readme-types'

export type Block = {
  /** The README line of the first code line. */
  line: number
  lang: 'ts' | 'tsx'
  code: string
}

const SKIP = /^<!--\s*readme-check:\s*skip\s+(\S.*?)\s*-->$/
const FENCE = /^```(tsx?)\s*$/

/** The checked blocks of a README; a bare `skip` with no reason throws. */
export function extractBlocks(markdown: string): Block[] {
  const lines = markdown.split('\n')
  const blocks: Block[] = []
  for (let i = 0; i < lines.length; i++) {
    const fence = FENCE.exec(lines[i]!)
    if (fence === null) {
      if (/^<!--\s*readme-check:/.test(lines[i]!) && !SKIP.test(lines[i]!.trim())) {
        throw new Error(`README line ${i + 1}: a readme-check marker needs "skip <reason>"`)
      }
      continue
    }
    let end = i + 1
    while (end < lines.length && lines[end]!.trim() !== '```') end++
    let before = i - 1
    while (before >= 0 && lines[before]!.trim() === '') before--
    const skipped = before >= 0 && SKIP.test(lines[before]!.trim())
    if (!skipped) {
      blocks.push({
        line: i + 2,
        lang: fence[1] as Block['lang'],
        code: lines.slice(i + 1, end).join('\n'),
      })
    }
    i = end
  }
  return blocks
}

const PRELUDE = `// Ambient names the README's blocks use without defining.
type Row = { id: string; name: string; amount: number; date: Date; sessions: number }
declare const rows: readonly Row[]
declare const part: { text: string }
declare const note: string
`

const TSCONFIG = {
  extends: '../tsconfig.json',
  compilerOptions: { noEmit: true, noUnusedLocals: false, noUnusedParameters: false },
  include: ['./*'],
  exclude: [],
}

/** Compiles the blocks; the findings, each naming its README line, empty when all pass. */
export function checkBlocks(blocks: readonly Block[], dir = join(PLAYGROUND, OUT)): string[] {
  if (blocks.length === 0) return []
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  try {
    writeFileSync(join(dir, 'prelude.d.ts'), PRELUDE)
    // An augmentation of 'basalt-ui' only finds the module when the program already loads it.
    writeFileSync(join(dir, 'root.ts'), "export type * from 'basalt-ui'\n")
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(TSCONFIG))
    for (const b of blocks) writeFileSync(join(dir, `block-${b.line}.${b.lang}`), b.code + '\n')
    // The series block is the app's own file: the blocks that `import tokens from './basalt.tokens'` resolve it.
    const series = blocks.find((b) => b.code.startsWith('// src/basalt.tokens.ts\n'))
    if (series !== undefined) writeFileSync(join(dir, 'basalt.tokens.ts'), series.code + '\n')
    const result = Bun.spawnSync(
      [
        join(PLAYGROUND, 'node_modules', '.bin', 'tsc'),
        '-p',
        join(dir, 'tsconfig.json'),
        '--pretty',
        'false',
      ],
      { cwd: PLAYGROUND, stdout: 'pipe', stderr: 'pipe' },
    )
    if (result.exitCode === 0) return []
    const output = result.stdout.toString() + result.stderr.toString()
    return output
      .split('\n')
      .filter((l) => l.trim() !== '')
      .map((l) => {
        const m = /block-(\d+)\.tsx?\((\d+),\d+\): (.*)$/.exec(l)
        return m === null ? l : `README line ${Number(m[1]) + Number(m[2]) - 1}: ${m[3]}`
      })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export function checkReadme(path = DEFAULT_README): string[] {
  const markdown = readFileSync(path, 'utf8')
  return checkBlocks(extractBlocks(markdown))
}

if (import.meta.main) {
  const failures = checkReadme(process.argv[2])
  for (const f of failures) console.error(`✖ check-readme-types: ${f}`)
  process.exit(failures.length === 0 ? 0 : 1)
}
