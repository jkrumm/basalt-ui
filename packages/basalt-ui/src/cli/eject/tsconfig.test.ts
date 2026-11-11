/** The JSONC paths writer: comments and layout survive, and remove undoes add byte-for-byte. */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderEjectDoc } from './help'
import { addPathsRow, pathsTarget, removePathsRow } from './tsconfig'

const KEY = 'basalt-ui/ui/button'
const TARGET = './src/components/ui/button.tsx'

const roundTrip = (text: string): string => {
  const added = addPathsRow(text, KEY, TARGET)
  if ('error' in added) throw new Error(added.error)
  expect(JSON.stringify(added.text)).toContain(KEY)
  const removed = removePathsRow(added.text, KEY)
  if ('error' in removed) throw new Error(removed.error)
  return removed.text
}

describe('tsconfig paths row', () => {
  const shapes: Record<string, string> = {
    'multi-line paths with comments':
      '{\n  // c\n  "compilerOptions": {\n    "strict": true,\n    /* x */ "paths": {\n      "@/*": ["./src/*"]\n    }\n  }\n}\n',
    'inline paths': '{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }\n',
    'empty paths': '{\n  "compilerOptions": {\n    "paths": {}\n  }\n}\n',
    'no paths yet':
      '{\n  "compilerOptions": {\n    "strict": true, // keep\n    "jsx": "react-jsx"\n  },\n  "include": ["src"]\n}\n',
    'tab indent': '{\n\t"compilerOptions": {\n\t\t"strict": true\n\t}\n}\n',
    'trailing commas':
      '{\n  "compilerOptions": {\n    "paths": {\n      "@/*": ["./src/*"],\n    },\n  },\n}\n',
  }
  for (const [shape, text] of Object.entries(shapes)) {
    it(`adds and removes byte-for-byte: ${shape}`, () => {
      expect(roundTrip(text)).toBe(text)
    })
  }

  it('creates a multi-line paths object beside the first option', () => {
    const added = addPathsRow(shapes['no paths yet'] as string, KEY, TARGET)
    expect('text' in added && added.text).toBe(
      '{\n  "compilerOptions": {\n    "paths": {\n      "basalt-ui/ui/button": ["./src/components/ui/button.tsx"]\n    },\n    "strict": true, // keep\n    "jsx": "react-jsx"\n  },\n  "include": ["src"]\n}\n',
    )
  })

  it('removes one of two rows and keeps the other', () => {
    const one = addPathsRow(shapes['no paths yet'] as string, KEY, TARGET)
    const two = 'text' in one ? addPathsRow(one.text, 'basalt-ui/ui/input', './i.tsx') : one
    const removed = 'text' in two ? removePathsRow(two.text, KEY) : two
    expect('text' in removed && removed.text).toContain('"basalt-ui/ui/input": ["./i.tsx"]\n    },')
    expect('text' in removed && removed.text).not.toContain(KEY)
  })

  it('refuses, printing the line, where it cannot edit safely', () => {
    const line = '"basalt-ui/ui/button": ["./src/components/ui/button.tsx"]'
    for (const text of [
      '{ "extends": "./base.json", "compilerOptions": { "strict": true } }',
      '{ "include": ["src"] }',
      '{ "compilerOptions": {} }',
      '{ "compilerOptions": { "paths": { "basalt-ui/ui/button": ["x"] } } }',
      'not json',
    ]) {
      const result = addPathsRow(text, KEY, TARGET)
      expect('error' in result && result.error).toContain(line)
    }
  })

  it('resolves the target against baseUrl when one is set', () => {
    expect(pathsTarget('/r/app/tsconfig.json', '{}', '/r/app/src/components/ui/b.tsx')).toBe(
      './src/components/ui/b.tsx',
    )
    expect(
      pathsTarget(
        '/r/app/tsconfig.json',
        '{ "compilerOptions": { "baseUrl": "src" } }',
        '/r/app/src/components/ui/b.tsx',
      ),
    ).toBe('./components/ui/b.tsx')
  })
})

describe('docs/eject.md', () => {
  it('is generated from `basalt-ui eject --help`', () => {
    const doc = readFileSync(
      join(fileURLToPath(new URL('../../../', import.meta.url)), 'docs/eject.md'),
      'utf8',
    )
    expect(doc).toBe(renderEjectDoc())
  })
})
