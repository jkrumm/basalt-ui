// Counts imports of basalt-ui symbols across consumer repos. hits.tsv columns: subpath, name, file count, files (space-separated repo:path)
import { Glob } from 'bun'
const home = process.env.HOME + '/SourceRoot/'
const repos = [
  'argo',
  'linewatch',
  'weatherorb',
  'rb',
  'rollhook',
  'basalt-ui-obsidian',
  'email-gateway',
  'image-gateway',
]
const skip =
  /(^|\/)(node_modules|dist|build|\.git|\.claude|\.output|\.vinxi|\.turbo|coverage|\.evidence)\//
const re =
  /(import|export)\s+(type\s+)?(\{[^}]*\}|\*\s+as\s+\w+|\w+(?:\s*,\s*\{[^}]*\})?)\s+from\s+['"](basalt-ui(?:\/[^'"]*)?)['"]/g
const hits = new Map<string, Set<string>>()
const subs = new Map<string, Set<string>>()
const versions: string[] = []
for (const repo of repos) {
  const root = home + repo
  for (const pj of new Glob('**/package.json').scanSync({ cwd: root })) {
    if (skip.test(pj)) continue
    const j = await Bun.file(`${root}/${pj}`).json()
    const v = j.dependencies?.['basalt-ui'] ?? j.devDependencies?.['basalt-ui']
    if (v) versions.push(`${repo}:${pj}\t${v}`)
  }
  for (const f of new Glob('**/*.{ts,tsx,mts,js,jsx,css}').scanSync({ cwd: root })) {
    if (skip.test(f)) continue
    const src = await Bun.file(`${root}/${f}`).text()
    if (!src.includes('basalt-ui')) continue
    for (const m of src.matchAll(re)) {
      const sub = m[4] === 'basalt-ui' ? '.' : './' + m[4].slice('basalt-ui/'.length)
      const spec = m[3]
      const loc = `${repo}:${f}`
      if (!subs.has(sub)) subs.set(sub, new Set())
      subs.get(sub)!.add(loc)
      const names = [...spec.matchAll(/(?:^|[{,])\s*(?:type\s+)?(\w+)(?:\s+as\s+\w+)?/g)].map(
        (x) => x[1],
      )
      if (spec.startsWith('*')) names.splice(0, names.length, '*')
      for (const n of names) {
        const k = `${sub}\t${n}`
        if (!hits.has(k)) hits.set(k, new Set())
        hits.get(k)!.add(loc)
      }
    }
    // CSS @import / side-effect imports
    for (const m of src.matchAll(/(?:@import|import)\s+['"](basalt-ui\/[^'"]+)['"]/g)) {
      const sub = './' + m[1].slice(10)
      if (!subs.has(sub)) subs.set(sub, new Set())
      subs.get(sub)!.add(`${repo}:${f}`)
    }
  }
}
await Bun.write(
  '/tmp/v2inv/hits.tsv',
  [...hits].map(([k, s]) => `${k}\t${s.size}\t${[...s].join(' ')}`).join('\n') + '\n',
)
await Bun.write(
  '/tmp/v2inv/subs.tsv',
  [...subs]
    .map(
      ([k, s]) => `${k}\t${s.size}\t${[...new Set([...s].map((x) => x.split(':')[0]))].join(',')}`,
    )
    .join('\n') + '\n',
)
await Bun.write('/tmp/v2inv/versions.tsv', versions.join('\n') + '\n')
