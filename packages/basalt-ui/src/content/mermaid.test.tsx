/**
 * `MermaidDiagram` through the real pele peer: the theme rides on `--pele-*` custom properties set to
 * basalt tokens, every diagram type pele draws renders, the SVG makes no remote request, and an
 * untrusted fence loads no image and links nowhere the content policy does not. The fallbacks for a
 * missing peer are in `mermaid-missing-peer.test.tsx` (a fresh module instance).
 */
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { Markdown } from './markdown'
import { MermaidDiagram } from './mermaid'

afterEach(cleanup)

const svgOf = (container: HTMLElement): string =>
  container.querySelector('[data-slot="mermaid"] svg')?.outerHTML ?? ''
const drawn = (container: HTMLElement) =>
  waitFor(() => expect(container.querySelector('[data-slot="mermaid"] svg')).not.toBeNull())

/** Anything that could make the browser fetch: a url() or @import, an href/src, an <image>, a link. */
function remoteReferences(svg: string): string[] {
  const found: string[] = []
  for (const pattern of [
    /<image\b/gi,
    /<a\b/gi,
    /<foreignObject\b/gi,
    /@import/gi,
    /url\(\s*['"]?(?!#)[^)]*\)/gi,
    /\b(?:xlink:)?href\s*=\s*"[^"]*"/gi,
    /\bsrc\s*=\s*"[^"]*"/gi,
    /https?:\/\/(?!www\.w3\.org\/)[^\s"'<)]+/gi,
  ]) {
    found.push(...(svg.match(pattern) ?? []))
  }
  return found
}

const SAMPLES: Record<string, string> = {
  flowchart: 'flowchart LR\n  A[Start] --> B{Ok?}\n  B -->|yes| C[Done]',
  sequence: 'sequenceDiagram\n  Alice->>Bob: Hi\n  Bob-->>Alice: Hello',
  class: 'classDiagram\n  Animal <|-- Dog\n  Animal : +int age',
  er: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places',
  state: 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy',
  pie: 'pie title Pets\n  "Dogs" : 386\n  "Cats" : 85',
  gantt:
    'gantt\n  title Plan\n  dateFormat YYYY-MM-DD\n  section Build\n  Code :a1, 2026-01-01, 30d\n  Ship :after a1, 10d',
  sankey: 'sankey-beta\n  a,b,3\n  a,c,2',
  xychart: 'xychart-beta\n  title "Sales"\n  x-axis [jan, feb, mar]\n  bar [5, 9, 7]',
}

describe('MermaidDiagram', () => {
  test('the diagram is an image named by its first line', async () => {
    const { container } = render(<MermaidDiagram code={'graph TD\n  A --> B'} />)
    await drawn(container)
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('graph TD')
    expect(container.querySelector('svg.pele')).not.toBeNull()
  })

  test('types beautiful-mermaid did not cover render: gantt and pie', async () => {
    for (const type of ['gantt', 'pie']) {
      const { container, unmount } = render(<MermaidDiagram code={SAMPLES[type] ?? ''} />)
      await drawn(container)
      expect(container.querySelector(`svg.pele-${type}`)).not.toBeNull()
      unmount()
    }
  })

  test('the theme is --pele-* custom properties set to var(--basalt-*) tokens, no literal color', async () => {
    const { container } = render(<MermaidDiagram code={'graph TD\n  A --> B'} />)
    await drawn(container)
    const wrapper = container.querySelector('[data-slot="mermaid"]')
    const classes = (wrapper?.getAttribute('class') ?? '').split(/\s+/)
    const vars = classes.filter((name) => name.startsWith('[--pele-'))
    const names = vars.map((name) => /^\[(--pele-[a-z0-9-]+):/.exec(name)?.[1])
    for (const required of [
      'bg',
      'fg',
      'muted',
      'line',
      'surface',
      'surface-alt',
      'border',
      'accent',
      'critical',
      'error',
      'radius',
      'font',
      'font-mono',
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `series-${n}`),
    ]) {
      expect(names).toContain(`--pele-${required}`)
    }
    for (const declaration of vars) {
      expect(declaration).toMatch(/var\(--basalt-/)
      expect(declaration).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i)
    }
  })

  test('a scheme flip needs no render: the SVG reads var()s and keeps its markup', async () => {
    const { container } = render(<MermaidDiagram code={'graph TD\n  A --> B'} />)
    await drawn(container)
    const before = svgOf(container)
    document.documentElement.setAttribute('data-theme', 'dark')
    expect(svgOf(container)).toBe(before)
    document.documentElement.removeAttribute('data-theme')
    expect(before).toContain('var(--pele-')
  })

  test('two diagrams get different id prefixes made of letters, digits, - and _', async () => {
    const { container } = render(
      <>
        <MermaidDiagram code={SAMPLES['sankey'] ?? ''} />
        <MermaidDiagram code={'sankey-beta\n  x,y,5\n  x,z,1'} />
      </>,
    )
    await waitFor(() =>
      expect(container.querySelectorAll('[data-slot="mermaid"] svg').length).toBe(2),
    )
    const ids = [...container.querySelectorAll('[id]')].map((node) => node.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[A-Za-z][A-Za-z0-9_-]*$/)
  })

  test('a source that does not render stays a code block with the text', async () => {
    const { container } = render(<MermaidDiagram code="this is {{ not a diagram" />)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(container.querySelector('[data-slot="mermaid"]')).toBeNull()
    expect(container.querySelector('pre')?.textContent).toContain('this is {{ not a diagram')
  })

  test('the module is pending: the source shows as a code block first', () => {
    const { container } = render(<MermaidDiagram code={'graph TD\n  A --> B'} />)
    expect(container.querySelector('[data-slot="mermaid"]')).toBeNull()
    expect(container.querySelector('pre')?.textContent).toContain('graph TD')
  })

  test('a streaming source that breaks mid-way keeps the last good diagram', async () => {
    const good = 'graph TD\n  A --> B'
    const { container, rerender } = render(<MermaidDiagram code={good} />)
    await drawn(container)
    const first = svgOf(container)
    rerender(<MermaidDiagram code={'graph TD\n  A -->'} />)
    rerender(<MermaidDiagram code="not {{ valid" />)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(svgOf(container)).toBe(first)
    expect(container.querySelector('pre')).toBeNull()
  })
})

describe('MermaidDiagram — no remote reference', () => {
  for (const [type, code] of Object.entries(SAMPLES)) {
    test(`a ${type} diagram makes no remote request and carries no font import`, async () => {
      const { container } = render(<MermaidDiagram code={code} />)
      await drawn(container)
      const svg = svgOf(container)
      expect(svg.length).toBeGreaterThan(0)
      expect(remoteReferences(svg)).toEqual([])
      expect(svg).not.toMatch(/googleapis|gstatic|@font-face/i)
    })
  }
})

const HOSTILE = [
  'flowchart LR',
  '  A["<img src=http://evil.example/x.png>"] --> B["see http://evil.example/t"]',
  '  C@{ img: "http://evil.example/p.png", label: "pic" }',
  '  D@{ img: "https://evil.example/p.png", label: "pic2" }',
  '  click A "http://evil.example/a"',
  '  click B "//evil.example/b"',
  '  click C "javascript:alert(1)"',
  '  click D "https://ok.example/d"',
  '  click A href "/\\\\evil.example/c"',
].join('\n')

describe('MermaidDiagram — trust', () => {
  test('an untrusted fence has no <image>, no external URL and no http link', async () => {
    const { container } = render(
      <Markdown contentTrust="untrusted">{`~~~mermaid\n${HOSTILE}\n~~~`}</Markdown>,
    )
    await drawn(container)
    const svg = svgOf(container)
    expect(svg).not.toMatch(/<image\b/i)
    expect(svg).not.toMatch(/javascript:/i)
    // an attribute carrying the host would be a request; a label only names it as text
    expect(svg).not.toMatch(/="[^"]*evil\.example/)
    const hrefs = [...container.querySelectorAll('svg a')].map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(['https://ok.example/d'])
    expect(
      remoteReferences(svg).filter((hit) => !/ok\.example|^<a$|evil\.example\/t$/.test(hit)),
    ).toEqual([])
  })

  test('a missing or unknown trust value renders as untrusted', async () => {
    const { container } = render(
      // a plain-JS caller can pass anything
      <Markdown contentTrust={'toString' as 'untrusted'}>{`~~~mermaid\n${HOSTILE}\n~~~`}</Markdown>,
    )
    await drawn(container)
    expect(svgOf(container)).not.toMatch(/<image\b/i)
    const alone = render(<MermaidDiagram code={HOSTILE} />)
    await drawn(alone.container)
    expect(svgOf(alone.container)).not.toMatch(/<image\b/i)
  })

  test('a trusted fence keeps an https image and an https link, and still drops http', async () => {
    const { container } = render(
      <Markdown contentTrust="trusted">{`~~~mermaid\n${HOSTILE}\n~~~`}</Markdown>,
    )
    await drawn(container)
    const svg = svgOf(container)
    expect(svg).toContain('https://ok.example/d')
    expect(svg).not.toMatch(/(?:xlink:)?href\s*=\s*"http:/i)
    expect(svg).not.toMatch(/="http:\/\/evil/)
  })

  test('an injection in a node label leaves no executable markup', async () => {
    const { container } = render(
      <Markdown contentTrust="untrusted">
        {'~~~mermaid\ngraph TD\n  A["<img src=x onerror=alert(1)>"] --> B\n~~~'}
      </Markdown>,
    )
    await drawn(container)
    expect(container.querySelector('svg script, svg img, [onerror], [onload]')).toBeNull()
  })
})
