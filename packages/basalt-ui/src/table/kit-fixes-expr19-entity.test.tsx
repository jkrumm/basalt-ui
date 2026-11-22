/**
 * Expression cycle 19 (`v3-expr-19-kit-fixes` 8; n94 .17): a long entity name wraps onto a second line in a narrow column
 * rather than end in an ellipsis; an id or a time (mono) stays one line.
 */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { EntityCell } from './core/kinds-cells'

const name = (html: string): string =>
  /data-slot="table-entity-name"[^>]*class="([^"]*)"/.exec(html)?.[1] ?? ''

describe('the entity name', () => {
  test('wraps instead of ending in an ellipsis', () => {
    const html = renderToString(
      <EntityCell
        value="A very long detector name"
        href={undefined}
        icon={undefined}
        sub={undefined}
      />,
    )
    expect(name(html)).toContain('wrap-anywhere')
    expect(name(html)).not.toContain('truncate')
  })

  test('an id or a time stays on one line', () => {
    const html = renderToString(
      <EntityCell value="img-1237" href={undefined} icon={undefined} sub={undefined} mono />,
    )
    expect(name(html)).toContain('truncate')
    expect(name(html)).not.toContain('wrap-anywhere')
  })
})
