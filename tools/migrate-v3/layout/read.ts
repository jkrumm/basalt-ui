import { SyntaxKind } from 'ts-morph'
import type { JsxAttribute, Node } from 'ts-morph'
import { BREAKPOINTS } from './tables.ts'

type Literal = string | number

/** What a JSX attribute holds, as far as a static codemod can tell. */
export type Value =
  | { kind: 'lit'; v: Literal }
  | { kind: 'bool' }
  | { kind: 'resp'; map: Record<string, Literal> }
  | { kind: 'cond'; test: string; a: Literal; b: Literal }
  | { kind: 'dyn'; why: string }

export function readAttribute(attr: JsxAttribute): Value {
  const init = attr.getInitializer()
  if (!init) return { kind: 'bool' }
  if (init.getKind() === SyntaxKind.StringLiteral) {
    return { kind: 'lit', v: init.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue() }
  }
  const expression = init.asKind(SyntaxKind.JsxExpression)?.getExpression()
  return expression ? readExpression(expression) : { kind: 'dyn', why: 'empty expression' }
}

function readExpression(e: Node): Value {
  switch (e.getKind()) {
    case SyntaxKind.StringLiteral:
    case SyntaxKind.NoSubstitutionTemplateLiteral:
      return {
        kind: 'lit',
        v: e.asKindOrThrow(e.getKind() as SyntaxKind.StringLiteral).getLiteralValue(),
      }
    case SyntaxKind.NumericLiteral:
      return { kind: 'lit', v: Number(e.getText()) }
    case SyntaxKind.PrefixUnaryExpression: {
      const unary = e.asKindOrThrow(SyntaxKind.PrefixUnaryExpression)
      const operand = unary.getOperand()
      if (
        unary.getOperatorToken() === SyntaxKind.MinusToken &&
        operand.getKind() === SyntaxKind.NumericLiteral
      ) {
        return { kind: 'lit', v: -Number(operand.getText()) }
      }
      return { kind: 'dyn', why: `dynamic value ${e.getText()}` }
    }
    case SyntaxKind.TrueKeyword:
      return { kind: 'bool' }
    case SyntaxKind.ParenthesizedExpression:
      return readExpression(e.asKindOrThrow(SyntaxKind.ParenthesizedExpression).getExpression())
    case SyntaxKind.ConditionalExpression: {
      const cond = e.asKindOrThrow(SyntaxKind.ConditionalExpression)
      const a = readExpression(cond.getWhenTrue())
      const b = readExpression(cond.getWhenFalse())
      if (a.kind === 'lit' && b.kind === 'lit') {
        return { kind: 'cond', test: cond.getCondition().getText(), a: a.v, b: b.v }
      }
      return { kind: 'dyn', why: 'ternary with a non-literal branch' }
    }
    case SyntaxKind.ObjectLiteralExpression:
      return readResponsive(e.asKindOrThrow(SyntaxKind.ObjectLiteralExpression))
    case SyntaxKind.PropertyAccessExpression:
      return { kind: 'dyn', why: `token reference ${e.getText()}` }
    default:
      return { kind: 'dyn', why: `dynamic value ${e.getText()}` }
  }
}

function readResponsive(obj: Node): Value {
  const map: Record<string, Literal> = {}
  for (const property of obj.asKindOrThrow(SyntaxKind.ObjectLiteralExpression).getProperties()) {
    const assignment = property.asKind(SyntaxKind.PropertyAssignment)
    if (!assignment)
      return { kind: 'dyn', why: 'responsive object with a spread or shorthand member' }
    const key = assignment.getName().replace(/['"]/g, '')
    if (!BREAKPOINTS.includes(key))
      return { kind: 'dyn', why: `responsive key ${key} is not a breakpoint name` }
    const value = readExpression(assignment.getInitializerOrThrow())
    if (value.kind !== 'lit') return { kind: 'dyn', why: 'responsive value is not a literal' }
    map[key] = value.v
  }
  return { kind: 'resp', map }
}
