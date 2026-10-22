import { describe, expect, test } from 'bun:test'
import { splitEmptyCopy } from './empty-copy'

describe('splitEmptyCopy', () => {
  test('two sentences: the first is the title (no period), the rest the description', () => {
    expect(splitEmptyCopy('No readings in the window. Check that the probe is reporting.')).toEqual(
      {
        title: 'No readings in the window',
        description: 'Check that the probe is reporting.',
      },
    )
  })

  test('one sentence is a title alone, its trailing period dropped', () => {
    expect(splitEmptyCopy('No weigh-ins yet.')).toEqual({
      title: 'No weigh-ins yet',
      description: undefined,
    })
    expect(splitEmptyCopy('No weigh-ins yet')).toEqual({
      title: 'No weigh-ins yet',
      description: undefined,
    })
  })

  test('a question mark or exclamation stays on the title', () => {
    expect(splitEmptyCopy('Nothing here? Log a session.')).toEqual({
      title: 'Nothing here?',
      description: 'Log a session.',
    })
    expect(splitEmptyCopy('Nothing yet!')).toEqual({
      title: 'Nothing yet!',
      description: undefined,
    })
  })

  test('both parts are trimmed; the description keeps its own period and later sentences', () => {
    expect(splitEmptyCopy('  No runs.   Dispatch one. Then wait.  ')).toEqual({
      title: 'No runs',
      description: 'Dispatch one. Then wait.',
    })
  })

  test('a dot inside a word or number is not a boundary', () => {
    expect(splitEmptyCopy('No 1.5 GB used. Run a job.')).toEqual({
      title: 'No 1.5 GB used',
      description: 'Run a job.',
    })
  })

  test('an abbreviation followed by a space splits early (documented)', () => {
    expect(splitEmptyCopy('No data, e.g. before launch. Wait.')).toEqual({
      title: 'No data, e.g',
      description: 'before launch. Wait.',
    })
  })
})
