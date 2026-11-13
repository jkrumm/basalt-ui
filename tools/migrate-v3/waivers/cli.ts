import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { runWaivers } from './index.ts'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { write: { type: 'boolean', default: false }, report: { type: 'string' } },
})

if (positionals.length === 0 || values.report === undefined) {
  console.error('usage: bun tools/migrate-v3/waivers/cli.ts <dir...> [--write] --report <file>')
  process.exit(2)
}

const report = runWaivers({ dirs: positionals, write: values.write === true })
writeFileSync(values.report, `${JSON.stringify(report, null, 2)}\n`)
const t = report.total
console.log(
  `${report.dryRun ? 'dry run' : 'written'}: ${t.sites} sites, ${t.rewritten} rewritten, ${t.worklist} on the worklist (${t.deepRenderCandidates} file-level need manifest.deepRender) -> ${values.report}`,
)
