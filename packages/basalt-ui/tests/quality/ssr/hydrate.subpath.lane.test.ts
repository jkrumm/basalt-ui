/**
 * Runs `hydrate.subpath.test.tsx` in the jsdom lane: a child `bun test` with
 * `tests/quality/ssr/bunfig.toml`, which preloads jsdom instead of the root bunfig's happy-dom
 * (a process holds one DOM). The child's output is the failure text.
 */
import { expect, test } from 'bun:test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..')

test('hydrate.subpath passes in the jsdom lane', async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      '--config=./packages/basalt-ui/tests/quality/ssr/bunfig.toml',
      'test',
      '--timeout',
      '90000',
      './packages/basalt-ui/tests/quality/ssr/hydrate.subpath.test.tsx',
    ],
    { cwd: repoRoot, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, NO_COLOR: '1' } },
  )
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  const text = `${out}\n${err}`
  expect(text).toMatch(/\b4 pass/)
  expect(text).toMatch(/1 todo/)
  expect(code, text).toBe(0)
}, 180_000)
