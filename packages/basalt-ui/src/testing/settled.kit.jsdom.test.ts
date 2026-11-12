/**
 * The jsdom half of `testing.kit` and the shim contract. The process this runs in has happy-dom
 * registered (root bunfig), and a process holds one DOM, so the jsdom lane is a child `bun test`
 * with `tests/quality/ssr/bunfig.toml`, which preloads jsdom instead. The child runs the same
 * files the happy-dom run does; its output is the failure text.
 */
import { expect, test } from 'bun:test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../../..')

test('testing.kit and the shims pass under jsdom', async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      '--config=./packages/basalt-ui/tests/quality/ssr/bunfig.toml',
      'test',
      '--timeout',
      '30000',
      './packages/basalt-ui/src/testing/settled.kit.test.tsx',
      './packages/basalt-ui/src/testing/dom-shims.test.ts',
    ],
    {
      cwd: repoRoot,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, NO_COLOR: '1', BASALT_EXPECT_DOM: 'jsdom' },
    },
  )
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  const text = `${out}\n${err}`
  expect(text).toMatch(/\d+ pass/)
  expect(code, text).toBe(0)
}, 120_000)
