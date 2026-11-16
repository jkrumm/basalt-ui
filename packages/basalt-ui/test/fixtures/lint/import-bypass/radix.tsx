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
import { Dialog } from 'react-aria-lookalike'
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
