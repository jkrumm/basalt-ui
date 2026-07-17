/**
 * Tarball parity — the authoritative half of the check in src/cli/tarball-parity.test.ts.
 * Reads a `tar -tzf` listing of the packed artifact (path passed as argv[2]) and asserts every
 * source path the CLI reads via readSource — for the full peer-flag surface — is present in the
 * tarball, plus every bin entry. Run by scripts/pack-test.sh after `bun pm pack`.
 */
import { readFileSync } from 'node:fs'

const { managedFiles } = await import(new URL('../dist/cli/index.js', import.meta.url))

const listPath = process.argv[2]
if (!listPath) {
  console.error('usage: node check-tarball-parity.mjs <tar-listing-file>')
  process.exit(2)
}
const entries = new Set(
  readFileSync(listPath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean),
)

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const sources = [...new Set(managedFiles({ hasRouter: true, hasQuery: true }).map((f) => f.source))]
const binPaths = Object.values(pkg.bin ?? {}).map((p) => p.replace(/^\.\//, ''))

const missing = [...sources, ...binPaths].filter((s) => !entries.has(`package/${s}`))
if (missing.length > 0) {
  console.error(`MISSING in tarball (CLI-read sources / bin):\n  ${missing.join('\n  ')}`)
  process.exit(1)
}
console.log(
  `tarball parity OK (${sources.length} CLI-read sources + ${binPaths.length} bin present)`,
)
