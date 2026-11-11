// oxlint-disable import/no-default-export -- oxlint's JS plugin loader requires a default export
// Spike stand-in for the generated basalt token rules (guardrail concept). Never shipped.
const HEX = /#[0-9a-fA-F]{3,8}\b/
const COLOR_FN = /\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/
const ARBITRARY = /(?:^|[\s:])-?[a-z][a-z-]*-\[[^\]]+\]/
const PALETTE =
  /(?:^|[\s:])(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline|decoration|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?(?:\/\d+)?(?=$|\s)/

const stringValue = (node) => {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value
  if (node.type === 'TemplateElement') return node.value.cooked ?? ''
  return null
}

const rule = (id, test, message) => ({
  meta: { type: 'problem', schema: [] },
  create(context) {
    const check = (node) => {
      const text = stringValue(node)
      if (text !== null && test(text)) context.report({ node, message: `${id}: ${message}` })
    }
    return { Literal: check, TemplateElement: check }
  },
})

export default {
  meta: { name: 'thin' },
  rules: {
    'no-raw-color': rule(
      'no-raw-color',
      (text) => HEX.test(text) || COLOR_FN.test(text),
      'write no hex or colour function; use a theme utility (bg-card, text-muted-foreground, border-border)',
    ),
    'no-arbitrary-value': rule(
      'no-arbitrary-value',
      (text) => ARBITRARY.test(text),
      'write no arbitrary-value utility (w-[312px], text-[13px]); use the scale or a container token',
    ),
    'no-palette-class': rule(
      'no-palette-class',
      (text) => PALETTE.test(text),
      'the theme defines no Tailwind palette; use a semantic utility (text-good, bg-inset, text-bad)',
    ),
    'no-inline-style': {
      meta: { type: 'problem', schema: [] },
      create(context) {
        return {
          JSXAttribute(node) {
            if (node.name?.name === 'style')
              context.report({
                node,
                message: 'no-inline-style: write no inline style; use theme utilities',
              })
          },
        }
      },
    },
  },
}
