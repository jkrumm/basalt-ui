// Fixture: import-boundary/base-ui. Cases split on the @valid / @invalid marker lines.
// @invalid
import { Dialog } from '@base-ui/react/dialog'
// @invalid
import * as BaseUi from '@base-ui/react'
// @invalid
const mod = await import('@base-ui/react/menu')
// @invalid
export { Tabs } from '@base-ui/react/tabs'
// @valid
import { Dialog } from 'basalt-ui/ui/dialog'
// @valid
import { base } from '@base-ui-kit/other'
