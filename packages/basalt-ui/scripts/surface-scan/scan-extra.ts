// Second pass: the import forms scan.ts does not see. Prints every hit; namespace imports are expanded to X.member.
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
const SPEC = `['"\`](basalt-ui(?:\\/[^'"\`]*)?)['"\`]`
const forms: Record<string, RegExp> = {
  dynamicImport: new RegExp(`import\\s*\\(\\s*${SPEC}`, 'g'),
  require: new RegExp(`require\\s*\\(\\s*${SPEC}`, 'g'),
  requireResolve: new RegExp(`require\\.resolve\\s*\\(\\s*${SPEC}`, 'g'),
  exportStar: new RegExp(`export\\s+\\*\\s+(?:as\\s+\\w+\\s+)?from\\s+${SPEC}`, 'g'),
  namespace: new RegExp(`import\\s+(?:type\\s+)?\\*\\s+as\\s+(\\w+)\\s+from\\s+${SPEC}`, 'g'),
  viMock: new RegExp(`(?:vi|jest|mock)\\.mock\\s*\\(\\s*${SPEC}`, 'g'),
}
let files = 0
for (const repo of repos) {
  const root = home + repo
  for (const f of new Glob('**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}').scanSync({ cwd: root })) {
    if (skip.test(f)) continue
    const src = await Bun.file(`${root}/${f}`).text()
    if (!src.includes('basalt-ui')) continue
    files++
    for (const [form, re] of Object.entries(forms)) {
      for (const m of src.matchAll(re)) {
        if (form === 'namespace') {
          const members = new Set(
            [...src.matchAll(new RegExp(`\\b${m[1]}\\.(\\w+)`, 'g'))].map((x) => x[1]),
          )
          console.log(`${form}\t${m[2]}\t${repo}:${f}\t${[...members].join(',')}`)
        } else if (form === 'dynamicImport') {
          // destructured members right after the import, e.g. `const { X } = await import('basalt-ui')` or `.then((m) => m.X)`
          const tail = src.slice(m.index!, m.index! + 300)
          const members = [...tail.matchAll(/\b(?:m|mod|module)\.(\w+)/g)].map((x) => x[1])
          const head = src.slice(Math.max(0, m.index! - 200), m.index!)
          const destr = head.match(/\{([^}]*)\}\s*=\s*await\s*$/)?.[1] ?? ''
          console.log(
            `${form}\t${m[1]}\t${repo}:${f}\t${[
              ...members,
              ...destr
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            ].join(',')}`,
          )
        } else console.log(`${form}\t${m[1]}\t${repo}:${f}`)
      }
    }
  }
}
console.error(`files mentioning basalt-ui: ${files}`)
