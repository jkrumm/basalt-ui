import { persistentAtom } from '@nanostores/persistent'

export const sidebarOpen = persistentAtom<boolean>('sidebar:state', true, {
  encode: JSON.stringify,
  decode: JSON.parse,
})
