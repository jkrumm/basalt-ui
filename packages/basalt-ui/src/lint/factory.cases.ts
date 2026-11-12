/**
 * The synthetic table and the RuleTester suites both hosts run: ESLint's in-process from
 * `factory.test.ts`, oxlint's `plugins-dev` from Node via `factory.oxlint.mjs` (it refuses Bun).
 * No real rule lives here; the forms only prove the machinery.
 */
import type { LintRule, Node } from './factory'
import { buildRule, classPatternRule } from './factory'
import type { AstForm, ClassForm } from './rule-table'
import { defineRules } from './rule-table'

export const viewport: ClassForm = {
  id: 'prefix',
  pattern: /(?:^|:)(?:(?:max|min)-)?(?:sm|md|lg|xl|2xl):/,
  fix: 'Key on the container: @narrow: @regular: @wide:',
  next: 'useSizeClass is chrome only',
  fixture: 'synthetic/prefix.tsx',
}

export const toneHole: ClassForm = {
  id: 'tone-hole',
  pattern: /-\$\{\}-/,
  fix: 'A cva variant per tone',
  next: 'Status or Num tone from parts',
  fixture: 'synthetic/tone-hole.tsx',
}

export const offForm: ClassForm = {
  id: 'padding',
  pattern: /^p-/,
  fix: 'Surfaces own padding: Inset, CardBand',
  next: 'A reasoned waiver',
  fixture: 'synthetic/padding.tsx',
  enabled: false,
  reason: 'off until a structural F5P retest',
}

export const noAlert: AstForm = {
  id: 'alert',
  detect: ({ report }) => ({
    CallExpression(node: Node) {
      const callee = node['callee'] as Node
      if (callee.type === 'Identifier' && callee['name'] === 'alert') report(node, 'alert()')
    },
  }),
  fix: 'notify() from the shell',
  next: 'An inline Alert',
  fixture: 'synthetic/alert.tsx',
}

export const SYNTHETIC = defineRules({
  'synthetic-class': {
    family: 'class',
    profiles: ['bridge', 'parts', 'app'],
    defect: 'synthetic: proves the factory',
    forms: [viewport, toneHole, offForm],
  },
  'synthetic-ast': {
    family: 'structure',
    profiles: ['parts', 'app'],
    defect: 'synthetic: proves AST forms',
    forms: [noAlert],
  },
})

type ErrorCase = { messageId?: string; message?: string; data?: Record<string, string> }
export type Cases = {
  valid: string[]
  invalid: { code: string; errors: ErrorCase[] }[]
}
export type Suite = { name: string; rule: LintRule; cases: Cases }

const prefixError = (subject: string): ErrorCase => ({ messageId: 'prefix', data: { subject } })

/** One invalid case per class-string shape the factory reads (guardrails section 4). */
export const SHAPES: { name: string; code: string; subject: string }[] = [
  { name: 'className', code: `const a = <div className="flex sm:p-2" />`, subject: 'sm:p-2' },
  {
    name: 'cn()',
    code: `const a = cn('flex', isOn && 'md:hidden', isWide ? 'grid' : 'block')`,
    subject: 'md:hidden',
  },
  {
    name: 'cva()',
    code: `const b = cva('flex', { variants: { size: { sm: 'h-8', lg: 'xl:h-12' } }, defaultVariants: { size: 'sm' } })`,
    subject: 'xl:h-12',
  },
  {
    name: 'object map',
    code: `const sizes = { sm: 'h-8', lg: 'max-md:h-12' }`,
    subject: 'max-md:h-12',
  },
  { name: 'array', code: `const parts = ['flex', '2xl:grid']`, subject: '2xl:grid' },
  {
    name: 'join',
    code: `const c = ['flex', isOn ? 'sm:p-2' : 'p-1'].join(' ')`,
    subject: 'sm:p-2',
  },
  {
    name: 'template quasi',
    code: 'const a = <div className={`flex ${gap} lg:p-4`} />',
    subject: 'lg:p-4',
  },
]

const VALID = [
  // Not class contexts: a plain string, a template outside a class context, prose, a URL.
  `const label = 'sm:p-2'`,
  'const key = `md:${id}`',
  `const copy = { hint: 'Use sm: for small' }`,
  `const link = { href: 'https://example.com/sm:x' }`,
  // cva option names and defaultVariants are not classes.
  `const b = cva('flex', { variants: { size: { sm: 'h-8' } }, defaultVariants: { size: 'sm' } })`,
  // Container tiers are the fix, not a finding.
  `const a = <div className={cn('@narrow:p-2', '@wide:p-4')} />`,
  // A disabled form runs nothing.
  `const a = <div className="p-4" />`,
  // `.join(' ')` on anything but an array literal is opaque.
  `const c = list.join(' ')`,
]

export const SUITES: Suite[] = [
  {
    name: 'synthetic-class',
    rule: classPatternRule(viewport, toneHole, offForm),
    cases: {
      valid: VALID,
      invalid: [
        ...SHAPES.map(({ code, subject }) => ({ code, errors: [prefixError(subject)] })),
        {
          // clsx-style object keys are classes.
          code: `const a = cn({ 'lg:block': isOpen })`,
          errors: [prefixError('lg:block')],
        },
        {
          // The template form: `bg-${tone}-600` reaches the pattern as `bg-${}-600`.
          code: 'const a = <div className={cn(`bg-${tone}-600`)} />',
          errors: [{ messageId: 'tone-hole', data: { subject: 'bg-${}-600' } }],
        },
        {
          // The message quotes the token and names the fix and the next rung.
          code: `const a = <div className="sm:flex" />`,
          errors: [
            {
              message:
                '`sm:flex`: Key on the container: @narrow: @regular: @wide:. Next: useSizeClass is chrome only.',
            },
          ],
        },
        {
          code: `const a = <div wrapperClassName={cn('a', ['md:b'])} />`,
          errors: [prefixError('md:b')],
        },
        {
          // A string in nested class shapes is reported once.
          code: `const a = <div className={cn(['flex', 'sm:p-2'].join(' '))} />`,
          errors: [prefixError('sm:p-2')],
        },
        {
          code: `const b = cva(['flex', 'md:grid'], { compoundVariants: [{ size: 'sm', class: 'lg:p-2' }] })`,
          errors: [prefixError('md:grid'), prefixError('lg:p-2')],
        },
      ],
    },
  },
  {
    name: 'synthetic-ast',
    rule: buildRule('synthetic-ast', SYNTHETIC['synthetic-ast']),
    cases: {
      valid: [`notify('saved')`],
      invalid: [
        { code: `alert('saved')`, errors: [{ messageId: 'alert', data: { subject: 'alert()' } }] },
      ],
    },
  },
  {
    // A disabled form runs once a test enables it.
    name: 'synthetic-enabled',
    rule: classPatternRule({ ...offForm, enabled: true }),
    cases: {
      valid: [`const a = <div className="flex" />`],
      invalid: [
        {
          code: `const a = <div className="p-4" />`,
          errors: [{ messageId: 'padding', data: { subject: 'p-4' } }],
        },
      ],
    },
  },
]
