// oxlint-disable import/no-default-export -- commitlint requires a default export
import type { Plugin, UserConfig } from '@commitlint/types'

// semantic-release computes a major from `type!:` or a `BREAKING CHANGE:` footer. The only
// sanctioned major is the designated v3 commit, already on master, so any later marker fails here.
const BREAKING_HEADER = /^\w+(\([^)]*\))?!:/
// Same shape as conventional-commits-parser's note regex, so nothing it counts as breaking slips by.
const BREAKING_FOOTER = /^[\s|*]*BREAKING[ -]CHANGE[:\s]/im

const noBreakingPlugin: Plugin = {
  rules: {
    'no-breaking': (parsed) => {
      const header = parsed.header ?? ''
      const rest = (parsed.raw ?? '').split('\n').slice(1).join('\n')
      const found = BREAKING_HEADER.test(header) || BREAKING_FOOTER.test(rest)
      return [
        !found,
        'breaking markers (`type!:`, `BREAKING CHANGE:` footer) are banned: ship breaks as plain `feat:`',
      ]
    },
  },
}

const Configuration: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  plugins: [noBreakingPlugin],
  rules: {
    'no-breaking': [2, 'always'],
    'header-max-length': [2, 'always', 80],
    'body-max-line-length': [2, 'always', 300],
    'body-leading-blank': [2, 'always'],
    'footer-max-line-length': [2, 'always', 100],
    'footer-leading-blank': [2, 'always'],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'scope-empty': [2, 'always'], // Disallow scopes - they're redundant in this repo
    'subject-empty': [2, 'never'],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'subject-full-stop': [2, 'never', '.'],
  },
}

export default Configuration
