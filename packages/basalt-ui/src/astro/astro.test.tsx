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
import { renderSiteSources, siteImports } from './sources'

const PKG = join(import.meta.dir, '../..')
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

describe('the table tiers', () => {
  it('are imported by a site module that imports the table, and by no other', async () => {
    const root = new URL(`file://${join(PKG, '../../apps/playground-astro')}/`)
    let config: { vite?: { plugins: Record<string, unknown>[] } } = {}
    await basaltAstro({ sources: false, fonts: false }).hooks['astro:config:setup']({
      config: { root },
      updateConfig: (next) => {
        config = next as typeof config
      },
      injectScript: () => {},
    })
    const plugin = config.vite?.plugins.find((p) => p['name'] === 'basalt-ui:table-sheet') as
      | { transform: (code: string, id: string) => { code: string } | null }
      | undefined
    expect(plugin).toBeDefined()
    const island = "import { DataTable } from 'basalt-ui/table'\n"
    expect(plugin?.transform(island, '/site/islands/Runs.tsx')?.code).toContain(
      "import 'basalt-ui/table.css'",
    )
    expect(
      plugin?.transform("import { Lines } from 'basalt-ui/charts'\n", '/site/a.tsx'),
    ).toBeNull()
  })
})

describe('.basalt/sources.css', () => {
  it('reads the closure keys the site imports, the MDX tags as their island subpath, and skips code fences', () => {
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
    expect(siteImports(join(root, 'src'))).toEqual({
      keys: ['charts', 'table', 'ui/button'],
      tags: true,
    })
  })

  it('sources what a dialog island reaches, its button included, and never drops a static.css primitive', () => {
    const css = renderSiteSources({
      outFile: '/site/.basalt/sources.css',
      pkgRoot: PKG,
      keys: ['ui/dialog'],
      tags: false,
      tokenSheets: ['/site/tokens.css'],
    })
    const lines = css.split('\n')
    expect(lines[1]).toBe('@import "basalt-ui/static.css";')
    expect(lines[2]).toBe('@import "../tokens.css";')
    const excluded = lines
      .filter((l) => l.startsWith('@source not'))
      .map((l) => /ui\/([a-z-]+)\.\*/.exec(l)?.[1])
    expect(lines.some((l) => /^@source "[^"]*\/ui";$/.test(l))).toBe(true)
    expect(excluded).not.toContain('dialog')
    expect(excluded).not.toContain('button')
    expect(excluded).not.toContain('alert')
    expect(excluded).not.toContain('table')
    expect(excluded).toContain('accordion')
  })
})
