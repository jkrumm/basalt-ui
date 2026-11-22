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
import { Command } from 'cmdk-lite'
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
import { Allotment } from 'allotment'
// @valid
import { MapContainer, Tooltip, Popup } from 'react-leaflet'
// @valid
import { Button, Section, Text } from '@react-email/components'
// @valid
import { DndContext } from '@dnd-kit-lite/core'
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
// @invalid
import Popup from 'reactjs-popup'
// @invalid
import { DateRange } from 'react-date-range'
// @invalid
import Select from 'react-select'
// @invalid
import Calendar from 'react-calendar'
// @valid
import { Chart as ChartIcon } from 'iconsax-react'
// @valid
import { Home } from 'iconoir-react'
// @valid
import { markdownTable } from 'markdown-table'
// @valid
import { convert } from 'html-to-markdown'
// @valid
import Selecto from 'react-selecto'
// @valid
import { selectAll } from 'hast-util-select'
// @valid
import { selectOne } from 'css-select'
// @valid
import { Calendar } from 'react-big-calendar'
// @invalid
import { useCombobox } from 'downshift'
// @invalid
import { useSelect } from 'downshift'
// @invalid
import { useDatePicker } from 'picker-kit'
// @invalid
import { toast } from 'toastify-lite'
// @invalid
import 'react-datepicker-lite/dist/style.css'
// @valid
import markdownEscape from 'markdown-escape'
// @valid
import { google as calendarLink } from 'calendar-link'
// @valid
import removeMd from 'remove-markdown'
// @valid
import removeMarkdown from 'remove-markdown'
export const plain = (s) => removeMarkdown(s)
// @valid
import { NodeHtmlMarkdown } from 'node-html-markdown'
export const toMd = (html) => NodeHtmlMarkdown.translate(html)
// @valid
import { NodeHtmlMarkdown } from 'node-html-markdown'
export const converter = new NodeHtmlMarkdown()
// @valid
import { useSelect } from 'react-supabase'
export const US = useSelect
// @invalid
import { render as markdown } from 'markdown-view-lite'
export const Doc = ({ text }) => <markdown.View>{text}</markdown.View>
// @invalid
import MarkdownView from 'markdown-view-lite'
export const MD = MarkdownView
// @invalid
import { useModal } from 'react-modal-hook'
export function Open() {
  const [show] = useModal(() => null)
  return show
}
// @invalid
import { toast } from 'toastify-lite'
export const saved = () => toast('Saved')
// @invalid
import { useDayzed } from 'dayzed'
export const DZ = useDayzed
// @invalid
import { createChart } from 'lightweight-charts'
export const draw = (el) => createChart(el)
// @invalid
import toast from 'toastify-lite'
export const saved = () => toast.success('Saved')
// @valid
import tablemark from 'tablemark'
export const asTable = (rows) => tablemark(rows)
// @invalid
import { TabulatorFull as Tabulator } from 'tabulator-tables'
export const grid = (el) => new Tabulator(el, {})
