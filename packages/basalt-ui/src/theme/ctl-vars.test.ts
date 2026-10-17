import { expect, test } from 'bun:test'
import { DEFAULT_THEME, mergeMantineTheme } from '@mantine/core'
import { CTL_HEIGHT_VARS, denseCtlBlock } from '../tokens/ctl-vars'
import { baseTheme, cssVariablesResolver } from './index'

const CTL_HEIGHT = 'calc(var(--vx-space-control-height-ctl) * var(--mantine-scale))'

test('the vars ctlSizeVars sets to the ctl height ARE CTL_HEIGHT_VARS, and the dense block restates exactly those', () => {
  const theme = mergeMantineTheme(DEFAULT_THEME, baseTheme)
  const variables = cssVariablesResolver(theme).variables
  const atCtlHeight = Object.entries(variables)
    .filter(([, value]) => value === CTL_HEIGHT)
    .map(([name]) => name)
    .toSorted()
  expect(atCtlHeight).toEqual([...CTL_HEIGHT_VARS].toSorted())

  const dense = [...denseCtlBlock().matchAll(/^\s+(--[\w-]+):/gm)].map((m) => m[1] as string)
  expect(dense.filter((name) => name !== '--vx-space-control-height-ctl').toSorted()).toEqual(
    [...CTL_HEIGHT_VARS].toSorted(),
  )
})
