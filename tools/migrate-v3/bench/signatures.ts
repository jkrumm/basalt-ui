// The bench's signature set: 375 (tag, props) shapes of the layout primitives, each with children that
// are not targets, so the codemod rewrites only the element under test. The set is generated once by
// make-oracle.ts and committed inside oracle.json; the bench reads it from there and never regenerates.
import { transformSource } from '../layout/transform.ts'

export type Signature = { tag: string; jsx: string }

/** Quota per tag; the sum is the oracle's size. */
const QUOTA: Record<string, number> = {
  Stack: 60,
  Group: 75,
  Flex: 60,
  Center: 30,
  Box: 30,
  Text: 70,
  SimpleGrid: 50,
}
export const SIGNATURE_COUNT = Object.values(QUOTA).reduce((a, b) => a + b, 0)

const SPACE = [
  '',
  'gap="xs"',
  'gap="sm"',
  'gap="md"',
  'gap="lg"',
  'gap="xl"',
  'gap={0}',
  'gap={10}',
]
const ALIGN = ['', 'align="flex-start"', 'align="center"', 'align="stretch"', 'align="flex-end"']
const JUSTIFY = [
  '',
  'justify="center"',
  'justify="space-between"',
  'justify="flex-end"',
  'justify="space-around"',
]
const BOX_EXTRA = [
  '',
  'p="sm"',
  'mt="md" mb={4}',
  'w={200}',
  'maw={240} mx="auto"',
  'h={140}',
  'px="lg" py="xs"',
  'miw={120} bg="red"',
]

const KIDS = '<div data-k="1" /><div data-k="2" /><div data-k="3" />'
const SENTENCE = 'The quick brown fox jumps over the lazy dog and keeps running across the field'

function cartesian(dims: string[][]): string[] {
  return dims
    .reduce<string[][]>((acc, dim) => acc.flatMap((row) => dim.map((v) => [...row, v])), [[]])
    .map((row) => row.filter(Boolean).join(' '))
}

const candidates: Record<string, () => string[]> = {
  Stack: () =>
    cartesian([SPACE, ALIGN, JUSTIFY.slice(0, 3), BOX_EXTRA]).map((p) => wrap('Stack', p, KIDS)),
  Group: () =>
    cartesian([SPACE, ALIGN, JUSTIFY, ['', 'wrap="nowrap"'], BOX_EXTRA.slice(0, 4)]).map((p) =>
      wrap('Group', p, KIDS),
    ),
  Flex: () =>
    cartesian([
      ['', 'direction="column"', 'direction="row-reverse"', 'direction="column-reverse"'],
      ['', 'gap="md"', 'gap="xl"', 'rowGap="xs" columnGap="lg"', 'gap={12}'],
      ALIGN,
      JUSTIFY.slice(0, 3),
      ['', 'wrap="wrap"', 'wrap="nowrap"'],
    ]).map((p) => wrap('Flex', p, KIDS)),
  Center: () =>
    cartesian([
      ['', 'h={80}', 'h={60} w="100%"', 'mih={40}', 'h={100}'],
      ['', 'w={200}', 'maw={260}'],
      ['', 'p="md"', 'px="xs"', 'bg="red"'],
    ]).map((p) => wrap('Center', p, '<div data-k="1" />')),
  Box: () =>
    cartesian([
      ['', 'w={120}', 'w="100%"'],
      ['', 'h={40}', 'h={80}'],
      ['', 'p="xs"', 'p="md"', 'p={12}'],
      ['', 'mx="auto"'],
      ['', 'bdrs="sm"', 'bdrs="md"'],
      ['', 'maw={200}'],
    ]).map((p) => wrap('Box', p, '<div data-k="1" />')),
  Text: () =>
    cartesian([
      ['', 'size="xs"', 'size="sm"', 'size="md"', 'size="lg"', 'size="xl"'],
      ['', 'fw={500}', 'fw={600}', 'fw={700}'],
      ['', 'ta="center"', 'ta="right"'],
      [
        '',
        'maw={160}',
        'w={100}',
        'fs="italic"',
        'lineClamp={2} maw={200}',
        'truncate maw={180}',
        'span',
      ],
    ]).map((p) => wrap('Text', p, SENTENCE)),
  SimpleGrid: () =>
    cartesian([
      [
        'cols={1}',
        'cols={2}',
        'cols={3}',
        'cols={4}',
        'cols={6}',
        'cols={{ base: 1, sm: 2, lg: 3 }}',
      ],
      ['', 'spacing="xs"', 'spacing="sm"', 'spacing="md"', 'spacing="lg"', 'spacing="xl"'],
      ['', 'verticalSpacing="xs"', 'verticalSpacing="lg"'],
    ]).map((p) =>
      wrap('SimpleGrid', p, `${KIDS}<div data-k="4" /><div data-k="5" /><div data-k="6" />`),
    ),
}

function wrap(tag: string, props: string, children: string): string {
  return `<${tag}${props ? ` ${props}` : ''}>${children}</${tag}>`
}

/** Source the codemod and the Mantine renderer both start from: one signature as a module. */
export function moduleSource(jsx: string, tag: string): string {
  return `import { ${tag} } from '@mantine/core'\nexport const s = (\n  ${jsx}\n)\n`
}

/** True when the codemod converts the signature completely: nothing left in place, nothing on its worklist. */
function fullyConverted(jsx: string, tag: string): boolean {
  const r = transformSource(moduleSource(jsx, tag), { file: 'sig.tsx', cnImport: './cn.ts' })
  return r.targets > 0 && r.converted === r.targets && r.worklist.length === 0
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/** `quota` entries scattered over `all` by a stride coprime to its length: no dimension is skipped by aliasing. */
function scatter<T>(all: T[], quota: number): T[] {
  if (all.length <= quota) return all
  const stride = [7919, 7907, 7901, 7883, 7879].find((p) => gcd(p, all.length) === 1) ?? 1
  return Array.from({ length: quota }, (_, k) => all[(k * stride) % all.length]!)
}

/** The deterministic signature set: the codemod's fully converted candidates, scattered per tag. */
export function generateSignatures(): Signature[] {
  const out: Signature[] = []
  for (const [tag, quota] of Object.entries(QUOTA)) {
    const valid = [...new Set(candidates[tag]!())].filter((jsx) => fullyConverted(jsx, tag))
    if (valid.length < quota)
      throw new Error(`${tag}: ${valid.length} valid candidates, need ${quota}`)
    for (const jsx of scatter(valid, quota)) out.push({ tag, jsx })
  }
  return out
}
