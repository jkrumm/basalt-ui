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
