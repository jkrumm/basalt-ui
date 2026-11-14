/**
 * The doctor eject rows (primitives-distribution section 6): a real `eject button` passes every
 * row, and each row seeded on its own fails `doctor` with exit 1 and one message of its own, which
 * names the fix.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { appendFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { seedBudget, writeBudget } from '../../../../src/cli/budget'
import {
  cleanupTrees,
  commitTree,
  editManifest,
  HEALTHY,
  makeTree,
  quiet,
  runCheck,
} from '../../../../src/cli/doctor/fixture.test'
import { doctor } from '../../../../src/cli/doctor'
import { eject } from '../../../../src/cli/eject'

afterEach(cleanupTrees)

const FILE = 'src/components/ui/button.tsx'
const GUARD = 'src/components/ui/button.guard.ts'
const BASE = '.basalt/base/src/button.tsx'
const KEY = 'src#button'

/** A healthy `parts` install that ejected `button` through the real verb, committed. */
function ejectedTree(): string {
  const dir = makeTree('parts', {
    'vite.config.ts':
      "import { basalt } from 'basalt-ui/vite'\nexport default { plugins: [basalt()] }\n",
    'tsconfig.json': '{\n  "compilerOptions": {\n    "strict": true\n  }\n}\n',
  })
  const code = quiet(() => eject(['button', '--reason', 'dense rows'], dir))
  if (code !== 0) throw new Error('fixture eject failed')
  commitTree(dir)
  return dir
}

const at = (dir: string, rel: string): string => resolve(dir, rel)
const replaceIn = (dir: string, rel: string, from: string | RegExp, to: string): void =>
  writeFileSync(at(dir, rel), readFileSync(at(dir, rel), 'utf8').replace(from, to))

async function run(dir: string): Promise<{ code: number; log: string }> {
  const saved = { log: console.log, error: console.error }
  let log = ''
  const sink = (...args: unknown[]): void => {
    log += `${args.join(' ')}\n`
  }
  console.log = sink
  console.error = sink
  try {
    return { code: await doctor(dir, [], HEALTHY), log }
  } finally {
    console.log = saved.log
    console.error = saved.error
  }
}

describe('doctor eject rows', () => {
  it('a real eject passes every row and doctor exits 0', async () => {
    const dir = ejectedTree()
    expect((await runCheck(dir, 11)).status).toBe('pass')
    expect((await run(dir)).code).toBe(0)
  })

  const rows: [string, (dir: string) => void, string][] = [
    ['missing file', (d) => rmSync(at(d, FILE)), `ejected ${FILE} is missing: restore it from git`],
    [
      'header',
      (d) => replaceIn(d, FILE, /^[^\n]*\n/, ''),
      `${FILE} lost its header: line 1 must be \`// basalt:ejected button@`,
    ],
    ['missing guard', (d) => rmSync(at(d, GUARD)), `${GUARD} is missing: run \`basalt-ui sync\``],
    [
      'missing base',
      (d) => rmSync(at(d, BASE)),
      `${BASE} (the merge base of ${FILE}) is missing: restore it from git`,
    ],
    [
      'tsconfig paths row',
      (d) => writeFileSync(at(d, 'tsconfig.json'), '{ "compilerOptions": { "strict": true } }\n'),
      `tsconfig.json has no paths row "basalt-ui/ui/button" -> ${FILE}: add it to compilerOptions.paths`,
    ],
    [
      'seedDigest differs',
      (d) =>
        editManifest(
          d,
          (m) => void ((m.ejected[KEY] as { seedDigest: string }).seedDigest = 'old'),
        ),
      `${FILE} was ejected from another seed than the installed one: run \`basalt-ui sync\``,
    ],
    [
      'guard differs',
      (d) => appendFileSync(at(d, GUARD), 'export type Loose = string\n'),
      `${GUARD} differs from the shipped guard: run \`basalt-ui sync\``,
    ],
    [
      'conflict markers',
      (d) =>
        appendFileSync(
          at(d, FILE),
          '<<<<<<< local\nconst a = 1\n=======\nconst a = 2\n>>>>>>> shipped@3.1.0\n',
        ),
      `holds conflict markers: resolve them and commit`,
    ],
    [
      'missing SLOTS entry',
      (d) => replaceIn(d, FILE, 'data-slot="pressable"', ''),
      `${FILE} dropped the data-slot "pressable" SLOTS lists for button`,
    ],
    [
      'ejects over budget.json',
      (d) => writeBudget(d, { ...seedBudget('parts'), ejects: 0 }),
      '1 ejects is above the ceiling 0 in .basalt/budget.json (root src)',
    ],
    [
      'adopted over budget.json',
      (d) =>
        editManifest(d, (m) => void ((m.ejected[KEY] as { origin: string }).origin = 'adopted')),
      '1 adopted is above the ceiling 0 in .basalt/budget.json (root src)',
    ],
    [
      'components/ui file absent from the manifest',
      (d) => writeFileSync(at(d, 'src/components/ui/extra.tsx'), 'export const Extra = 1\n'),
      'src/components/ui/extra.tsx is not in manifest.ejected: adopt it (`basalt-ui eject --adopt src/components/ui/extra.tsx',
    ],
  ]

  it.each(rows)('%s: doctor exits 1 with its own message', async (_row, seed, message) => {
    const dir = ejectedTree()
    seed(dir)
    const check = await runCheck(dir, 11)
    expect(check.status).toBe('fail')
    expect(check.detail.split('; ')).toHaveLength(1)
    expect(check.detail).toContain(message)
    const { code, log } = await run(dir)
    expect(code).toBe(1)
    expect(log).toContain(message)
  })

  it('the messages are distinct', () => {
    expect(new Set(rows.map(([, , message]) => message)).size).toBe(rows.length)
  })
})
