/**
 * The recipe channel's drift half (skills-agent-layer 3.16, 15.9). `docs/recipes/<name>.md` is a
 * frontmatter block, at most 15 lines of prose and ONE code fence that is the verbatim
 * `// #region recipe:<name>` of a playground file the playground typecheck already compiles. This
 * script keeps the fence equal to the region and holds the recipe budget.
 *
 * Usage: bun packages/basalt-ui/scripts/gen-recipes.ts           rewrite each recipe's code fence
 *        bun packages/basalt-ui/scripts/gen-recipes.ts --check   exit 1, naming file and reason
 *        --root <dir>   treat <dir> as the repo root: recipes in <dir>/docs/recipes (fixtures)
 *
 * Doc layout:
 *   ---
 *   name: <name>            must equal the file name and the region name
 *   use-when: <one line>    ("use when" is accepted too)
 *   file: <repo-relative path of the playground file holding the region>
 *   ---
 *   <= 15 non-blank prose lines
 *   ```tsx
 *   <the region, verbatim>
 *   ```
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

export const MAX_RECIPE_LINES = 60
export const MAX_PROSE_LINES = 15
export const MAX_RECIPES = 24
const REGION_START = /^\s*\/\/ #region recipe:([\w-]+)\s*$/
const ANY_REGION_START = /^\s*\/\/ #region\b/
const REGION_END = /^\s*\/\/ #endregion\b/
const FENCE = /^```/

export type Problem = { file: string; reason: string }

export type RecipeRoots = {
  /** Repo root: `file:` paths resolve from it and `apps/playground/src` is scanned for regions. */
  repoRoot: string
  /** Where `<name>.md` recipes live. */
  docsDir: string
}

const here = import.meta.dirname
export const REAL_ROOTS: RecipeRoots = {
  repoRoot: join(here, '..', '..', '..'),
  docsDir: join(here, '..', 'docs', 'recipes'),
}

// ── Parsing ──────────────────────────────────────────────────────────────────────────────────────

type ParsedDoc = {
  front: Map<string, string>
  /** Index of the line after the closing `---`, or -1 when there is no frontmatter block. */
  bodyStart: number
  /** Opening and closing fence line indexes inside the body; -1 when absent. */
  fenceOpen: number
  fenceClose: number
  proseLines: number
  lines: string[]
}

function splitLines(text: string): string[] {
  const lines = text.split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines
}

function parseDoc(text: string): ParsedDoc {
  const lines = splitLines(text)
  const front = new Map<string, string>()
  let bodyStart = -1
  if (lines[0] === '---') {
    const close = lines.indexOf('---', 1)
    if (close !== -1) {
      for (const line of lines.slice(1, close)) {
        const m = /^([\w -]+?)\s*:\s*(.*)$/.exec(line)
        if (m) front.set(m[1]!.trim(), m[2]!.trim().replace(/^(["'])(.*)\1$/, '$2'))
      }
      bodyStart = close + 1
    }
  }
  const from = Math.max(bodyStart, 0)
  const fenceOpen = lines.findIndex((l, i) => i >= from && FENCE.test(l))
  const fenceClose =
    fenceOpen === -1 ? -1 : lines.findIndex((l, i) => i > fenceOpen && FENCE.test(l))
  const proseLines = lines.filter(
    (l, i) =>
      i >= from &&
      l.trim() !== '' &&
      !(fenceOpen !== -1 && i >= fenceOpen && (fenceClose === -1 || i <= fenceClose)),
  ).length
  return { front, bodyStart, fenceOpen, fenceClose, proseLines, lines }
}

/** Every `// #region recipe:<name>` in the tree, with the lines it encloses. */
type Region = { name: string; file: string; body: string[] }

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (['.ts', '.tsx', '.mts'].includes(extname(entry))) out.push(full)
  }
  return out
}

function regionsIn(text: string, file: string): Region[] {
  const lines = text.split('\n')
  const regions: Region[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = REGION_START.exec(lines[i]!)
    if (!m) continue
    let depth = 1
    const body: string[] = []
    for (let j = i + 1; j < lines.length && depth > 0; j++) {
      const line = lines[j]!
      if (ANY_REGION_START.test(line)) depth++
      else if (REGION_END.test(line)) depth--
      if (depth > 0) body.push(line)
    }
    regions.push({ name: m[1]!, file, body })
  }
  return regions
}

function scanRegions(roots: RecipeRoots): Region[] {
  const src = join(roots.repoRoot, 'apps', 'playground', 'src')
  return walk(src).flatMap((abs) =>
    regionsIn(readFileSync(abs, 'utf8'), relative(roots.repoRoot, abs)),
  )
}

// ── The rule ─────────────────────────────────────────────────────────────────────────────────────

function recipeFiles(docsDir: string): string[] {
  if (!existsSync(docsDir)) return []
  return readdirSync(docsDir)
    .filter((f) => f.endsWith('.md'))
    .toSorted()
}

function fenceFor(body: string[], ext: string): string[] {
  return ['```' + ext, ...body, '```']
}

/** Violations of the recipe contract; empty when the tree is clean. */
export function checkRecipes(roots: RecipeRoots = REAL_ROOTS): Problem[] {
  const problems: Problem[] = []
  const rel = (abs: string): string => relative(roots.repoRoot, abs)
  const regions = scanRegions(roots)
  const files = recipeFiles(roots.docsDir)

  if (files.length > MAX_RECIPES) {
    problems.push({
      file: rel(roots.docsDir),
      reason: `${files.length} recipes, the budget is ${MAX_RECIPES}`,
    })
  }

  const documented = new Set(files.map((f) => f.slice(0, -'.md'.length)))
  for (const region of regions) {
    if (documented.has(region.name)) continue
    problems.push({
      file: region.file,
      reason: `region recipe:${region.name} has no doc (expected ${rel(join(roots.docsDir, `${region.name}.md`))})`,
    })
  }

  for (const f of files) {
    const abs = join(roots.docsDir, f)
    const name = f.slice(0, -'.md'.length)
    const fail = (reason: string): void => void problems.push({ file: rel(abs), reason })
    const doc = parseDoc(readFileSync(abs, 'utf8'))

    if (doc.bodyStart === -1) {
      fail('frontmatter block missing')
      continue
    }
    const fm = doc.front
    if (!fm.has('name')) fail('frontmatter key missing: name')
    else if (fm.get('name') !== name) fail(`frontmatter name "${fm.get('name')}" differs from ${f}`)
    if (!(fm.get('use-when') ?? fm.get('use when'))) fail('frontmatter key missing: use-when')
    const target = fm.get('file')
    if (!target) fail('frontmatter key missing: file')

    if (doc.lines.length > MAX_RECIPE_LINES) {
      fail(`${doc.lines.length} lines, the limit is ${MAX_RECIPE_LINES}`)
    }
    if (doc.proseLines > MAX_PROSE_LINES) {
      fail(`${doc.proseLines} prose lines, the limit is ${MAX_PROSE_LINES}`)
    }

    if (!target) continue
    if (!existsSync(join(roots.repoRoot, target))) {
      fail(`file ${target} does not exist`)
      continue
    }
    const region = regions.find((r) => r.file === target && r.name === name)
    if (!region) {
      fail(`region recipe:${name} missing or renamed in ${target}`)
      continue
    }
    if (doc.fenceOpen === -1 || doc.fenceClose === -1) {
      fail(`no code fence; run gen-recipes to write the region of ${target}`)
      continue
    }
    const fence = doc.lines.slice(doc.fenceOpen + 1, doc.fenceClose)
    if (fence.join('\n') !== region.body.join('\n')) {
      fail(`code fence differs from region recipe:${name} in ${target}; run gen-recipes`)
    }
  }
  return problems
}

/** Rewrites the code fence of every recipe from its region. Returns the files changed. */
export function writeRecipes(roots: RecipeRoots = REAL_ROOTS): string[] {
  const regions = scanRegions(roots)
  const changed: string[] = []
  for (const f of recipeFiles(roots.docsDir)) {
    const abs = join(roots.docsDir, f)
    const name = f.slice(0, -'.md'.length)
    const text = readFileSync(abs, 'utf8')
    const doc = parseDoc(text)
    const target = doc.front.get('file')
    const region = target ? regions.find((r) => r.file === target && r.name === name) : undefined
    if (!region || !target) continue // checkRecipes names why

    const fence = fenceFor(region.body, extname(target).slice(1))
    const hasFence = doc.fenceOpen !== -1 && doc.fenceClose !== -1
    const next = hasFence
      ? [...doc.lines.slice(0, doc.fenceOpen), ...fence, ...doc.lines.slice(doc.fenceClose + 1)]
      : [...doc.lines, '', ...fence]
    const out = next.join('\n') + '\n'
    if (out === text) continue
    writeFileSync(abs, out, 'utf8')
    changed.push(relative(roots.repoRoot, abs))
  }
  return changed
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2)
  const rootAt = args.indexOf('--root')
  const roots: RecipeRoots =
    rootAt === -1
      ? REAL_ROOTS
      : { repoRoot: args[rootAt + 1]!, docsDir: join(args[rootAt + 1]!, 'docs', 'recipes') }

  if (args.includes('--check')) {
    const problems = checkRecipes(roots)
    for (const p of problems) console.error(`✖ gen-recipes --check: ${p.file}: ${p.reason}`)
    if (problems.length > 0) process.exit(1)
    console.log(`✓ gen-recipes --check: ${recipeFiles(roots.docsDir).length} recipes in sync.`)
    return
  }

  for (const file of writeRecipes(roots)) console.log(`wrote ${file}`)
  const problems = checkRecipes(roots)
  for (const p of problems) console.error(`✖ gen-recipes: ${p.file}: ${p.reason}`)
  if (problems.length > 0) process.exit(1)
}

if (import.meta.path === Bun.main) {
  main()
}
