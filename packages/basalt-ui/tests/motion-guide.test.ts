/**
 * The motion guideline is one page in two shipped places: the basalt-design skill reference an agent
 * loads, and `docs/motion.md` beside the generated docs. The body is held equal so neither goes stale.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'bun:test'

const PKG = join(import.meta.dir, '..')
const read = (path: string): string => readFileSync(join(PKG, path), 'utf8')

test('docs/motion.md carries the skill reference verbatim under its frontmatter', () => {
  const skill = read('agent/skills/basalt-design/references/motion.md')
  const doc = read('docs/motion.md')
  const body = doc.replace(/^---\n[\s\S]*?\n---\n\n/, '')
  expect(body).toBe(skill)
  expect(read('agent/skills/basalt-design/SKILL.md')).toContain('(references/motion.md)')
})
