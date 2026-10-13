// W1 inventory method (docs/waves/evidence/w1/core.md), kept so the surface counts re-derive.
// Lists every export (value + type) of each published JS subpath, resolved from src entries.
import ts from 'typescript' // the repo's typescript@6.0.3 by absolute path; a bare import from /tmp lacked the compiler API
import { resolve } from 'node:path'
const pkg = process.argv[2]
const exportsMap = (await Bun.file(resolve(pkg, 'package.json')).json()).exports
const entries: Record<string, string> = {}
for (const [k, v] of Object.entries<string | { import: string }>(exportsMap)) {
  if (typeof v !== 'object') continue
  entries[k] = resolve(pkg, v.import.replace('./dist/', 'src/').replace(/\.js$/, ''))
}
const files = Object.values(entries).map((p) => {
  for (const ext of ['.ts', '.tsx', '/index.ts']) if (Bun.file(p + ext).size) return p + ext
  throw new Error(p)
})
const cfg = ts.getParsedCommandLineOfConfigFile(
  resolve(pkg, 'tsconfig.json'),
  {},
  { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
)!
const program = ts.createProgram(files, cfg.options)
const checker = program.getTypeChecker()
const out: string[] = []
Object.keys(entries).forEach((sub, i) => {
  const sf = program.getSourceFile(files[i])!
  const sym = checker.getSymbolAtLocation(sf)!
  for (const e of checker.getExportsOfModule(sym)) {
    const t = e.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(e) : e
    const isValue = !!(t.flags & ts.SymbolFlags.Value)
    out.push([sub, e.name, isValue ? 'value' : 'type'].join('\t'))
  }
})
console.log(out.join('\n'))
