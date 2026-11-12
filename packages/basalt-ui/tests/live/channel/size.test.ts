/**
 * Budget: `createChannel` alone is at most 4 KB gzipped. Measured the way it ships: `eventsource-parser`
 * is a package dependency, so tsup leaves it external and the consumer's bundler adds it; `react` is
 * not imported at all. The total with the parser inlined is logged, not gated.
 */
import { expect, test } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function gzipped(external: string[]): Promise<number> {
  const dir = mkdtempSync(join(tmpdir(), 'channel-size-'))
  const entry = join(dir, 'entry.ts')
  writeFileSync(
    entry,
    `import { createChannel } from ${JSON.stringify(join(import.meta.dir, '../../../src/core/channel.ts'))}\nglobalThis.__c = createChannel\n`,
  )
  const out = await Bun.build({
    entrypoints: [entry],
    minify: true,
    target: 'browser',
    format: 'esm',
    external,
  })
  expect(out.success).toBe(true)
  return Bun.gzipSync(await out.outputs[0]!.text()).byteLength
}

test('createChannel alone is at or under 4 KB gz', async () => {
  const own = await gzipped(['eventsource-parser'])
  const withParser = await gzipped([])
  console.log(`createChannel: ${own} B gz alone, ${withParser} B gz with the parser inlined`)
  expect(own).toBeLessThanOrEqual(4096)
})
