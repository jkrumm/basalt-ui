/**
 * The `ui` migration rows (docs/v3/concepts/primitives-distribution.md section 9): every Mantine
 * symbol the census names has a row, no row points at a primitive outside the 36 modules, and each
 * `valueShifts` target is the value `src/tokens/table.ts` ships.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { deriveV3 } from '../src/tokens/derive'
import { tokenByName } from '../src/tokens/table'
import { validateArea } from './release-migrating'
import type { AreaFile } from './release-migrating'

const FILE = join(import.meta.dir, '..', 'migrations', 'areas', 'ui.json')
const area: AreaFile = validateArea(
  'migrations/areas/ui.json',
  'ui',
  JSON.parse(readFileSync(FILE, 'utf8')),
)

/** ARCHITECTURE section 3, "Primitives (36, census-derived)". */
const MODULES = [
  'button',
  'input',
  'textarea',
  'number-field',
  'select',
  'combobox',
  'checkbox',
  'radio-group',
  'switch',
  'slider',
  'segmented',
  'field',
  'dialog',
  'sheet',
  'popover',
  'tooltip',
  'menu',
  'toast',
  'tabs',
  'accordion',
  'collapsible',
  'card',
  'table',
  'scroll-area',
  'separator',
  'skeleton',
  'badge',
  'status',
  'alert',
  'kbd',
  'progress',
  'meter',
  'toolbar',
  'num',
  'date-picker',
  'virtual-list',
]

const CENSUS = `
Text Stack Group Box SimpleGrid Title Center Flex Container Grid List Code Anchor VisuallyHidden
Image AspectRatio Blockquote Button ActionIcon CloseButton UnstyledButton CopyButton useClipboard
PasswordInput Badge ThemeIcon Indicator Pill Card Paper Alert Divider Kbd Skeleton Loader ColorSwatch
TextInput Textarea Input NumberInput Select NativeSelect Combobox useCombobox Autocomplete TagsInput
PillsInput Checkbox Radio Switch Slider RangeSlider Tabs Accordion Collapse ScrollArea
SegmentedControl Chip Menu Tooltip Popover Modal @mantine/modals FocusTrap Drawer Table Pagination
Progress RingProgress DatePicker DateInput notifications Notifications Spotlight createSpotlight
AppShell NavLink useForm schemaResolver MantineProvider MantineThemeProvider createTheme
mergeThemeOverrides defaultVariantColorsResolver getPrimaryShade rem useMantineTheme
useMantineColorScheme useComputedColorScheme useDisclosure useHover useFocusWithin useMergedRef
useReducedMotion Transition useElementSize useViewportSize useMediaQuery useDebouncedCallback
useDebouncedValue useLocalStorage useDocumentVisibility Rating FileButton Avatar PinInput Tree
useTree Stepper ColorInput WeekView MonthView @mantine/form
`
  .trim()
  .split(/\s+/)

const symbolOf = (from: string): string => from.split('#')[1] ?? from

describe('migrations/areas/ui.json', () => {
  test('the census list is 113 distinct symbols', () => {
    expect(CENSUS.length).toBe(113)
    expect(new Set(CENSUS).size).toBe(113)
  })

  test('every census symbol has a row', () => {
    const named = new Set(area.rows.map((row) => symbolOf(row.from)))
    expect(CENSUS.filter((symbol) => !named.has(symbol))).toEqual([])
  })

  test('manual rows carry a reason and the manual flag; others do not', () => {
    for (const row of area.rows) {
      expect(row.manual === true).toBe(row.kind === 'manual')
      if (row.kind === 'manual') expect(row.note?.length ?? 0).toBeGreaterThan(0)
    }
  })

  test('no row points at a primitive outside the 36 modules', () => {
    expect(MODULES.length).toBe(36)
    expect(new Set(MODULES).size).toBe(36)
    const referenced = area.rows.flatMap((row) =>
      [...(row.to ?? '').matchAll(/basalt-ui\/ui\/([a-z-]+)/g)].map((m) => m[1] as string),
    )
    expect(referenced.length).toBeGreaterThan(0)
    expect(referenced.filter((module) => !MODULES.includes(module))).toEqual([])
  })

  test('each valueShifts target is the value table.ts ships', () => {
    expect(area.tokens.valueShifts.length).toBeGreaterThan(0)
    for (const shift of area.tokens.valueShifts) {
      const value = tokenByName(shift.token.replace(/^--vx-/, '')).value(deriveV3())
      expect(shift.to).toBe(value as string)
      expect(shift.from).not.toBe(shift.to)
    }
  })

  test('the popover attr row and empty storage and urls', () => {
    expect(area.attrs).toEqual([
      { from: '.mantine-Popover-dropdown', to: '[data-slot="popover-content"]' },
    ])
    expect(area.storage).toEqual([])
    expect(area.urls).toEqual([])
  })
})
