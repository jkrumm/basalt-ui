// Fixture: import-boundary/radix
// @invalid
import * as Dialog from '@radix-ui/react-dialog'
// @invalid
import { Dialog } from 'radix-ui'
// @invalid
const { Slot } = require('@radix-ui/react-slot')
// @valid
import { Dialog } from 'basalt-ui/ui/dialog'
// @valid
import { radix } from 'radix-colors'
// @invalid
import { Drawer } from 'vaul'
// @invalid
import { Listbox } from '@headlessui/react'
// @valid
import { ArrowRightIcon } from '@radix-ui/react-icons'
// @invalid
import { useFloating, autoUpdate } from '@floating-ui/react'
// @invalid
import { useFloating } from '@floating-ui/react-dom'
// @invalid
import { Dialog } from 'react-aria-components'
// @invalid
import { Dialog } from '@ark-ui/react/dialog'
// @valid
import { useLookalike } from 'react-aria-lookalike'
// @invalid
import { Button, Modal } from '@mantine/core'
// @invalid
import { DatePickerInput } from '@mantine/dates'
// @valid
import { useDisclosure } from '@mantine/hooks'
// @invalid
import { Button } from '@chakra-ui/react'
// @invalid
import { Dialog } from '@mui/material/Dialog'
// @invalid
import { Button } from '@mui/joy'
// @invalid
import { useButton } from 'react-aria'
// @valid
import { DataGrid } from 'basalt-ui/table'
// @invalid
import { Button } from 'antd'
// @invalid
import { Button } from '@heroui/react'
// @invalid
import { Button } from '@nextui-org/react'
// @valid
import { Button } from 'antd-lookalike'
// @invalid
import { Button as AntButton } from 'antd'
// @invalid
import { Modal } from '@heroui/react'
// @invalid
import { Popper } from '@mui/base'
// @invalid
import { useDatePicker } from '@react-aria/datepicker'
// @invalid
import { ProTable } from '@ant-design/pro-components'
// @invalid
import { Dialog } from 'primereact/dialog'
// @invalid
import { Button, Modal } from 'react-bootstrap'
// @invalid
import { DataTable } from '@carbon/react'
// @invalid
export { Popover as Pop } from '@blueprintjs/core'
// @invalid
import { Dialog } from '@fluentui/react-components'
// @invalid
import { DatePicker } from 'rsuite'
// @valid
import AddIcon from '@mui/icons-material/Add'
// @valid
import { SearchOutlined } from '@ant-design/icons'
