/**
 * S9 (docs/v3/concepts/charts-cards-kanban.md section 9): the board recipe sends one `Move` whether a
 * card is dropped or sent through its menu, and after the card remounts in a virtualised target
 * column focus is back on it.
 */
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { Move } from 'basalt-ui/cards'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import type { Col } from './board'
import { BoardDemo, seedCards } from './board-demo'

const ROW = 124
const VIEWPORT = ROW * 3

// happy-dom measures every box as 0, which virtual-core reads as "nothing visible".
const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset['slot'] === 'virtual-list' ? VIEWPORT : 0
    },
  })
})
afterEach(() => {
  cleanup()
  if (original) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original)
  else delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight
})

const until = async (done: () => boolean): Promise<void> => {
  for (let i = 0; i < 50 && !done(); i++) await new Promise((r) => setTimeout(r, 20))
  expect(done()).toBe(true)
}

const mount = (): Move<Col>[] => {
  const sent: Move<Col>[] = []
  render(
    createElement(BoardDemo, {
      initial: seedCards({ todo: 3, doing: 2, done: 30 }),
      onMove: (m) => void sent.push(m),
    }),
  )
  return sent
}

const card = (id: string): HTMLElement =>
  document.querySelector<HTMLElement>(`[data-card-id="${id}"]`)!
const wrapperOf = (id: string): HTMLElement =>
  document.querySelector<HTMLElement>(`[data-testid="drag-${id}"]`)!

async function viaMenu(id: string, item: string): Promise<void> {
  const trigger = card(id).querySelector<HTMLButtonElement>('[data-slot="kanban-menu"]')!
  fireEvent.pointerEnter(trigger)
  fireEvent.click(trigger)
  await until(() => document.querySelector('[role="menu"]') !== null)
  const row = [...document.querySelectorAll('[role="menuitem"]')].find(
    (el) => el.textContent === item,
  )
  fireEvent.click(row!)
}

function viaDrop(id: string, onto: string): void {
  const data = new Map<string, string>()
  const dataTransfer = {
    setData: (k: string, v: string) => void data.set(k, v),
    getData: (k: string) => data.get(k) ?? '',
  }
  fireEvent.dragStart(wrapperOf(id), { dataTransfer })
  fireEvent.dragOver(wrapperOf(onto), { dataTransfer })
  fireEvent.drop(wrapperOf(onto), { dataTransfer })
}

describe('S9 board recipe', () => {
  test('a drop and the menu send deep-equal Move payloads', async () => {
    const dropped = mount()
    viaDrop('todo-1', 'doing-2') // right after the last card of Doing: the column's end
    cleanup()
    const menu = mount()
    await viaMenu('todo-1', 'Move to Doing')
    expect(menu).toEqual([{ id: 'todo-1', from: 'todo', to: 'doing', index: 2 }])
    expect(dropped).toEqual(menu)
  })

  test('focus returns to the moved card after it remounts in the virtualised column', async () => {
    const sent = mount()
    const doneRows = (): number =>
      document.querySelectorAll('section[aria-label="Done"] [data-card-id]').length
    expect(doneRows()).toBeLessThan(30)
    await viaMenu('todo-1', 'Move to Done')
    expect(sent).toEqual([{ id: 'todo-1', from: 'todo', to: 'done', index: 30 }])
    await until(
      () =>
        document.activeElement?.closest('[data-card-id]')?.getAttribute('data-card-id') ===
        'todo-1',
    )
    expect(document.activeElement?.getAttribute('data-slot')).toBe('kanban-menu')
    expect(document.activeElement?.closest('section')?.getAttribute('aria-label')).toBe('Done')
    expect(doneRows()).toBeLessThan(31)
    expect(document.querySelector('[role="status"]')?.textContent).toBe('Moved to Done')
  })
})
