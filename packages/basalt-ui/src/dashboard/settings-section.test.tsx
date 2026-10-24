/**
 * SettingsSection / DangerZone — the WidgetHeader composition (docs/CONTROLS-SPEC.md §2.2):
 * `description` renamed to `subtitle`, both now render an h2 (`tier="section"`) via `WidgetHeader`,
 * and `actions` reaches the header's actions slot.
 */
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { readFileSync } from 'node:fs'
import { DangerZone, SettingsRow, SettingsSection } from './settings-section'

function renderWith(node: ReactElement) {
  return render(<MantineProvider>{node}</MantineProvider>)
}

describe('SettingsSection composes WidgetHeader at the section tier', () => {
  test('renders an h2 carrying the title', () => {
    renderWith(
      <SettingsSection title="Profile">
        <div>rows</div>
      </SettingsSection>,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Profile' })).toBeDefined()
  })

  test('subtitle (renamed from description) renders below the title', () => {
    renderWith(
      <SettingsSection title="Profile" subtitle="Your public identity.">
        <div>rows</div>
      </SettingsSection>,
    )
    expect(screen.getByText('Your public identity.')).toBeDefined()
  })

  test('actions reach the header actions slot', () => {
    renderWith(
      <SettingsSection title="Profile" actions={<button type="button">Export</button>}>
        <div>rows</div>
      </SettingsSection>,
    )
    expect(screen.getByRole('button', { name: 'Export' })).toBeDefined()
  })
})

describe('DangerZone keeps its eyebrow alongside the WidgetHeader', () => {
  test('renders the eyebrow and an h2 title', () => {
    renderWith(
      <DangerZone title="Delete workspace" subtitle="This action cannot be undone.">
        <div>rows</div>
      </DangerZone>,
    )
    expect(screen.getByText('Danger Zone')).toBeDefined()
    expect(screen.getByRole('heading', { level: 2, name: 'Delete workspace' })).toBeDefined()
    expect(screen.getByText('This action cannot be undone.')).toBeDefined()
  })
})

describe('common props (`common/props.ts`)', () => {
  test('className reaches SettingsSection root, classNames.body reaches the rows box', () => {
    const { container } = renderWith(
      <SettingsSection title="Profile" className="my-section" classNames={{ body: 'my-body' }}>
        <div>rows</div>
      </SettingsSection>,
    )
    expect(container.querySelector('.my-section')).toBeTruthy()
    expect(container.querySelector('.my-body')).toBeTruthy()
  })

  test('className reaches SettingsRow root', () => {
    const { container } = renderWith(<SettingsRow label="Display name" className="my-row" />)
    expect(container.querySelector('.my-row')).toBeTruthy()
  })
})

describe('a settings shell keeps three type sizes (Wave 38)', () => {
  test('row label sm, row description xs, danger eyebrow xs', () => {
    renderWith(
      <DangerZone title="Delete">
        <SettingsRow label="Delete workspace" description="Cannot be undone." />
      </DangerZone>,
    )
    expect(screen.getByText('Delete workspace').style.fontSize).toBe('13px')
    expect(screen.getByText('Cannot be undone.').style.fontSize).toBe('12px')
    expect(screen.getByText('Danger Zone').style.fontSize).toBe('12px')
  })
})

describe('the DangerZone ring is one token-derived treatment, heavier in light', () => {
  const css = readFileSync(new URL('./settings-section.module.css', import.meta.url), 'utf8')

  test('the class mixes the status token into the panel surface — no alpha over the backdrop', () => {
    const danger = css.slice(css.indexOf('.danger {'))
    expect(danger).toContain(
      'color-mix(in srgb, var(--vx-status-bad) 40%, var(--vx-surface-panel))',
    )
    expect(danger).toContain(
      "html[data-mantine-color-scheme='light'] .danger {\n  --danger-ring: color-mix(in srgb, var(--vx-status-bad) 75%, var(--vx-surface-panel))",
    )
    expect(danger).not.toMatch(/rgba?\(|#[0-9a-f]{3}/i)
  })

  test('the card layers that ring on shadow-card inline', () => {
    renderWith(
      <DangerZone title="Delete">
        <div>rows</div>
      </DangerZone>,
    )
    const card = screen.getByText('Danger Zone').closest('.mantine-Card-root') as HTMLElement | null
    expect(card?.style.boxShadow).toBe('var(--vx-shadow-card), 0 0 0 1px var(--danger-ring)')
  })
})
