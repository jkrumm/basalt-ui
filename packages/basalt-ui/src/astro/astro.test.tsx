import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderToString } from 'react-dom/server'

import { Dialog, DialogContent, DialogTrigger } from '../ui/dialog'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../ui/menu'
import { MATRIX, partsSource } from '../../scripts/gen-astro-parts'
import { basaltAstro } from './index'
import { deadIslandMessage, deadIslands, deadSlots, requiredPartOf } from './islands'
import { ASTRO_PARTS } from './parts'
import { importedDirs, renderSiteSources } from './sources'

const tmp = (): string => mkdtempSync(join(tmpdir(), 'basalt-astro-'))

describe('ASTRO_PARTS', () => {
  it('is the matrix record: every part, its interaction and its best mode', () => {
    const want = (
      JSON.parse(readFileSync(MATRIX, 'utf8')) as { parts: Record<string, unknown>[] }
    ).parts.map(({ id, family, covers, interaction, best }) => ({
      id,
      family,
      covers,
      interaction,
      best,
    }))
    // A miss here: run bun packages/basalt-ui/scripts/gen-astro-parts.ts
    expect(ASTRO_PARTS).toEqual(want as never)
    expect(partsSource(readFileSync(MATRIX, 'utf8'))).toContain('export const ASTRO_PARTS')
  })
})

describe('the island check', () => {
  const dialog = renderToString(
    <Dialog>
      <DialogTrigger>Open</DialogTrigger>
      <DialogContent title="Details">Body</DialogContent>
    </Dialog>,
  )
  const menu = renderToString(
    <Menu>
      <MenuTrigger>More</MenuTrigger>
      <MenuContent>
        <MenuItem>One</MenuItem>
      </MenuContent>
    </Menu>,
  )

  it('finds a closed Dialog and Menu outside an island by the slot they render on the server', () => {
    expect(deadSlots(`<main>${dialog}${menu}</main>`).map((d) => d.part.id)).toEqual([
      'dialog',
      'menu',
    ])
  })

  it('passes the same markup inside an astro-island, and static parts anywhere', () => {
    const page = `<astro-island uid="a">${dialog}</astro-island><div data-slot="site-menu-panel"></div><div data-slot="tabs"></div>`
    expect(deadSlots(page)).toEqual([])
  })

  it('takes the longest id: an alert-dialog slot is the alert dialog', () => {
    expect(requiredPartOf('alert-dialog-trigger')?.id).toBe('alert-dialog')
    expect(requiredPartOf('dialog-trigger')?.id).toBe('dialog')
    expect(requiredPartOf('button')).toBeUndefined()
  })

  it('fails the build at astro:build:done, naming the part, the page and the fix', async () => {
    const out = tmp()
    mkdirSync(join(out, 'about'))
    writeFileSync(join(out, 'index.html'), '<main><p>static</p></main>')
    writeFileSync(join(out, 'about/index.html'), `<main>${dialog}</main>`)
    expect(deadIslands(out).map((d) => [d.page, d.part.id])).toEqual([
      ['/about/index.html', 'dialog'],
    ])
    const done = basaltAstro().hooks['astro:build:done']
    let message = ''
    try {
      await done({ dir: new URL(`file://${out}/`) })
    } catch (error) {
      message = String(error)
    }
    expect(message).toContain('Dialog (data-slot="dialog-trigger") on /about/index.html')
    expect(message).toContain('client:visible')
    expect(deadIslandMessage([])).toContain('basalt-ui: 0 part(s)')
  })
})

describe('.basalt/sources.css', () => {
  it('lists the directories the site imports, the MDX tags their islands, and skips code fences', () => {
    const root = tmp()
    mkdirSync(join(root, 'src/pages'), { recursive: true })
    mkdirSync(join(root, 'src/islands'), { recursive: true })
    writeFileSync(
      join(root, 'src/pages/index.astro'),
      "---\nimport { SiteArticle } from 'basalt-ui/static'\nimport Table from 'basalt-ui/astro/mdx/DataTable.astro'\n---\n",
    )
    writeFileSync(
      join(root, 'src/islands/Counter.tsx'),
      "import { Button } from 'basalt-ui/ui/button'\nimport { Lines } from 'basalt-ui/charts'\n",
    )
    writeFileSync(
      join(root, 'src/pages/post.mdx'),
      "# Post\n\n```ts\nimport { Board } from 'basalt-ui/page'\n```\n",
    )
    expect(importedDirs(join(root, 'src'))).toEqual(['astro/mdx', 'charts', 'table', 'ui/button'])
  })

  it('imports static.css, then the recorded token sheets, then a source line per directory', () => {
    const pkg = tmp()
    for (const dir of ['dist/charts', 'dist/ui']) mkdirSync(join(pkg, dir), { recursive: true })
    const css = renderSiteSources({
      outFile: '/site/.basalt/sources.css',
      pkgRoot: pkg,
      dirs: ['charts', 'ui/button', 'missing'],
      tokenSheets: ['/site/tokens.css'],
    })
    const lines = css.split('\n')
    expect(lines[1]).toBe('@import "basalt-ui/static.css";')
    expect(lines[2]).toBe('@import "../tokens.css";')
    expect(lines.filter((l) => l.startsWith('@source'))).toHaveLength(2)
    expect(css).toContain('/dist/ui/button.*";')
    expect(css).not.toContain('missing')
  })
})
