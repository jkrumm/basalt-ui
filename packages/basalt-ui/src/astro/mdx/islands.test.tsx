/**
 * The React side of the `Chart` and `DataTable` MDX tags, rendered on the server the way Astro
 * writes an island's HTML before it hydrates. Plain data in, no provider.
 */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { ChartFallback, ChartIsland } from './chart-island'
import { TableIsland } from './table-island'

const data = [
  { week: '2026-07-06', deploys: 14, rollbacks: 2 },
  { week: '2026-07-13', deploys: 18, rollbacks: 1 },
  { week: '2026-07-20', deploys: 17, rollbacks: 3 },
]
const series = [
  { key: 'deploys', label: 'Deploys' },
  { key: 'rollbacks', label: 'Rollbacks', color: 3 as const },
]

describe('ChartIsland', () => {
  for (const kind of ['lines', 'bars'] as const) {
    test(`${kind}: a card with its title and figure and a chart named by its label`, () => {
      const html = renderToString(
        <ChartIsland
          kind={kind}
          title="Deploys per week"
          label="Deploys and rollbacks per week"
          figure="17"
          period="week of 20 Jul"
          x="week"
          data={data}
          series={series}
        />,
      )
      expect(html).toContain('data-slot="chart-card"')
      expect(html).toContain('Deploys per week')
      expect(html).toContain('week of 20 Jul')
      expect(html).toContain('Deploys and rollbacks per week')
    })
  }

  test('series colors are chart tokens by position unless picked', () => {
    const html = renderToString(<ChartIsland title="t" x="week" data={data} series={series} />)
    expect(html).toContain('--basalt-chart-1')
    expect(html).toContain('--basalt-chart-3')
    expect(html).not.toMatch(/#[0-9a-f]{6}/i)
  })

  test('title, figure and plot share one surface: no inset behind the figure', () => {
    const html = renderToString(
      <ChartIsland title="t" figure="17" x="week" data={data} series={series} />,
    )
    expect(html).not.toContain('data-surface="inset"')
  })

  test('the fallback is the same card loading, in the same box, so it is as tall', () => {
    const ready = renderToString(
      <ChartIsland
        title="t"
        figure="17"
        period="week of 20 Jul"
        x="week"
        data={data}
        series={series}
      />,
    )
    const held = renderToString(<ChartFallback title="t" figure="17" period="week of 20 Jul" />)
    expect(held).toContain('data-phase="loading"')
    const box = (html: string): string | undefined => html.match(/h-\[clamp\([^\]]+\]/)?.[0]
    expect(box(held)).toBeDefined()
    expect(box(held)).toBe(box(ready))
    expect(held).not.toContain('<svg')
  })

  test('carries no provider and no figure when none is given', () => {
    const html = renderToString(<ChartIsland title="t" x="week" data={data} series={series} />)
    expect(html).not.toContain('data-slot="provider"')
  })
})

describe('TableIsland', () => {
  const columns = [
    { key: 'name', label: 'Run' },
    { key: 'km', label: 'Distance', kind: 'number' as const },
  ]
  const rows = [
    { name: 'Tempo', km: 8.4 },
    { name: 'Long', km: 21.1 },
  ]

  test('writes the table with its headers and rows before it hydrates', () => {
    const html = renderToString(<TableIsland label="Runs" columns={columns} rows={rows} />)
    expect(html).toContain('Run')
    expect(html).toContain('Distance')
    expect(html).toContain('Tempo')
    expect(html).toContain('Long')
  })

  test('the picture matches the static table on the words it shows', () => {
    const html = renderToString(<TableIsland label="Runs" columns={columns} rows={rows} />)
    for (const word of ['Tempo', 'Long', '8.4', '21.1']) expect(html).toContain(word)
  })

  test('a locale formats the numbers of the table in that locale', () => {
    const html = renderToString(
      <TableIsland
        label="Runs"
        columns={columns}
        rows={[{ name: 'Long', km: 1234.5 }]}
        locale="de-DE"
      />,
    )
    expect(html).toContain('1.234,5')
  })

  test('a messages override replaces the English words of the table chrome', () => {
    const html = renderToString(
      <TableIsland
        label="Runs"
        columns={columns}
        rows={[]}
        messages={{ 'table.empty': 'Keine Zeilen.' }}
      />,
    )
    expect(html).toContain('Keine Zeilen.')
  })
})
