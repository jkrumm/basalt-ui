// Fixture: import-boundary/rival-signature. An unscoped package on no ban row, outside the stack.
// @invalid
import Modal from 'react-modal'
// @invalid
import { createChart } from 'lightweight-charts'
// @invalid
import MarkdownView from 'react-markdown-view'
// @invalid
import { Tooltip } from 'react-tooltip'
// @invalid
import { Dialog } from 'tiny-kit/dialog'
// @invalid
import { Button, Modal } from 'tiny-ui-kit'
// @invalid
import { DataTable } from 'grid-kit'
// @invalid
import { DatePicker } from 'picker-kit'
// @invalid
export { Popover as Pop } from 'overlay-kit'
// @invalid
import { useTable } from 'react-table'
// @invalid
import { ResponsiveFunnelChart } from 'some-chart-kit'
// @invalid
import useLocalStorageState from 'react-localstorage-hook'
// @invalid
import { cmdkLike } from 'cmdk-lite'
// @valid
import useLocalStorageState from 'react-localstorage-hook'
export const adapter = { kind: StorageLike, getItem, setItem }
// @valid
import { Dialog, DataTable } from '@repo/ui'
// @valid
import { Modal } from '@ui/dialog'
// @valid
import { Dialog } from 'ui/dialog'
// @valid
import { PieChart } from 'react-feather'
// @valid
import { Panel, PanelGroup } from 'react-resizable-panels'
// @valid
import { MapContainer, Tooltip, Popup } from 'react-leaflet'
// @valid
import { Button, Section, Text } from '@react-email/components'
// @valid
import { DndContext } from '@dnd-kit/core'
// @valid
import { Menu, Calendar, Table } from 'lucide-react'
// @valid
import { Bars3Icon } from '@heroicons/react/24/outline'
// @valid
import { format } from 'date-fns'
// @valid
import { createColumnHelper } from '@tanstack/react-table'
// @valid
import { useQuery } from '@tanstack/react-query'
// @valid
import { parseDate } from '@internationalized/date'
// @valid
import { DataTable } from 'components/data-table'
// @valid
import { Dialog } from 'basalt-ui/ui/dialog'
// @valid
import { Lines } from 'basalt-ui/charts'
// @valid
import { rechartsLike } from 'recharts-like'
