/**
 * The glossary gate (Issue 3201): one name per concept across the generated prop lists. A part that
 * names a glossary concept by a rejected word fails here, with the name to use.
 */
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GLOSSARY, propListsOf, secondNames } from './glossary'

const DOCS = join(import.meta.dir, '..', 'docs')
const lists = readdirSync(DOCS)
  .filter((f) => f.endsWith('.md'))
  .flatMap((f) => propListsOf(readFileSync(join(DOCS, f), 'utf8')))

describe('glossary', () => {
  test('the generated docs yield the prop lists', () => {
    const statCell = lists.find((l) => l.part === 'StatCell')
    expect(statCell?.props).toContain('title')
    const picker = lists.find((l) => l.part === 'DatePicker')
    expect(picker?.props).toContain('onValueChange')
    expect(lists.length).toBeGreaterThan(150)
  })

  test('no part names a glossary concept by a second name', () => {
    expect(
      secondNames(lists).map((s) => `${s.part}.${s.prop}: use ${s.name} (${s.concept})`),
    ).toEqual([])
  })

  test('a seeded second name fails, with the name to use', () => {
    const seeded = [
      { part: 'StatCell', props: ['title', 'qualifier'] },
      { part: 'DatePicker', props: ['value', 'onChange'] },
    ]
    expect(secondNames(seeded).map((s) => `${s.part}.${s.prop} -> ${s.name}`)).toEqual([
      'StatCell.qualifier -> subtitle',
      'DatePicker.onChange -> onValueChange',
    ])
  })

  test('every glossary name is in use, so a row never outlives its concept', () => {
    const used = new Set(lists.flatMap((l) => l.props))
    expect(GLOSSARY.map((c) => c.name).filter((name) => !used.has(name))).toEqual([])
  })

  test('a word is rejected for one concept only', () => {
    const words = GLOSSARY.flatMap((c) => c.rejected)
    expect(words.filter((w, i) => words.indexOf(w) !== i)).toEqual([])
    expect(words.filter((w) => GLOSSARY.some((c) => c.name === w))).toEqual([])
  })
})
