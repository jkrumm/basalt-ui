/**
 * SettingsSection / DangerZone — the WidgetHeader composition (docs/CONTROLS-SPEC.md §2.2):
 * `description` renamed to `subtitle`, both now render an h2 (`tier="section"`) via `WidgetHeader`,
 * and `actions` reaches the header's actions slot.
 */
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { DangerZone, SettingsSection } from './settings-section'

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
