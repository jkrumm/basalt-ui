/**
 * The workspace switcher in the brand zone: the trigger names the current workspace, the list is a
 * radio group of the options, choosing another calls `onSwitch` once, choosing the current one
 * does nothing, and the manage row is a link. The collapsed face is the avatar alone by CSS on the
 * shell root, so the markup carries the rules the layout suite measures.
 */
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { WorkspaceSwitcher } from '../contract'
import { BrandZone } from './header'
import { renderInRouter } from './rail-test-kit'

afterEach(cleanup)

const OPTIONS = [
  { id: 'acme', label: 'Acme' },
  { id: 'globex', label: 'Globex', avatar: '/globex.png' },
]

function workspace(extra: Partial<WorkspaceSwitcher> = {}): WorkspaceSwitcher {
  return { current: OPTIONS[0]!, options: OPTIONS, onSwitch: () => {}, ...extra }
}

describe('the workspace switcher', () => {
  test('replaces the brand mark and name; the collapse toggle stays', async () => {
    await renderInRouter(<BrandZone brand={{ name: 'Argo' }} workspace={workspace()} />)
    const trigger = await screen.findByRole('button', { name: 'Switch workspace: Acme' })
    expect(trigger.textContent).toContain('Acme')
    expect(document.querySelector('[data-slot="shell-rail-toggle"]')).not.toBeNull()
    expect(screen.queryByText('Argo')).toBeNull()
  })

  test('without a workspace the brand zone is unchanged', async () => {
    await renderInRouter(<BrandZone brand={{ name: 'Argo' }} />)
    expect(await screen.findByText('Argo')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Switch workspace/ })).toBeNull()
  })

  test('the name yields to the avatar while the rail is 64 px', async () => {
    await renderInRouter(<BrandZone brand={{ name: 'Argo' }} workspace={workspace()} />)
    const name = await screen.findByText('Acme')
    expect(name.className).toContain('group-data-[rail=collapsed]/shell:md:hidden')
    expect(name.className).toContain('group-data-[rail=auto]/shell:md:max-xl:hidden')
  })

  test('choosing another workspace calls onSwitch with its id', async () => {
    const onSwitch = mock((_id: string) => {})
    await renderInRouter(<BrandZone brand={{ name: 'Argo' }} workspace={workspace({ onSwitch })} />)
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Switch workspace: Acme' }))
    })
    expect(
      (await screen.findByRole('menuitemradio', { name: 'Acme' })).getAttribute('aria-checked'),
    ).toBe('true')
    await act(async () => {
      fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Globex' }))
    })
    expect(onSwitch).toHaveBeenCalledTimes(1)
    expect(onSwitch.mock.calls[0]?.[0]).toBe('globex')
  })

  test('choosing the current workspace does nothing', async () => {
    const onSwitch = mock((_id: string) => {})
    await renderInRouter(<BrandZone brand={{ name: 'Argo' }} workspace={workspace({ onSwitch })} />)
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Switch workspace: Acme' }))
    })
    await act(async () => {
      fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Acme' }))
    })
    expect(onSwitch).not.toHaveBeenCalled()
  })

  test("the manage row is a link to the app's own settings", async () => {
    await renderInRouter(
      <BrandZone
        brand={{ name: 'Argo' }}
        workspace={workspace({ manage: { label: 'Manage workspaces', href: '/workspaces' } })}
      />,
    )
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Switch workspace: Acme' }))
    })
    const manage = await screen.findByText('Manage workspaces')
    expect(manage.closest('a')?.getAttribute('href')).toBe('/workspaces')
  })
})
