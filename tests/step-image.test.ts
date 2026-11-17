import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')
const read = (path: string): string => readFileSync(join(root, path), 'utf8')

describe('the unit step image', () => {
  const dockerfile = read('tools/step-image/Dockerfile')

  test("its Node is the repo's .nvmrc", () => {
    const node = /^ARG NODE=(\S+)$/m.exec(dockerfile)?.[1]
    expect(node).toBe(read('.nvmrc').trim())
  })

  test('project.yaml points the unit step at it, with the build output it carries', () => {
    const project = read('project.yaml')
    expect(project).toContain('dockerfile: tools/step-image/Dockerfile')
    expect(project).toContain('carry: [packages/basalt-ui/dist]')
  })

  test('it has no build context to copy from', () => {
    expect(dockerfile).not.toMatch(/^(COPY|ADD)\b/m)
  })
})
