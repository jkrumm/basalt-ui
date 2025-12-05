import { useStore } from '@nanostores/react'

import { Button } from '@/components/ui/button'
import { themeAtom } from '@/lib/theme-store'

export default function ThemeToggle() {
  const theme = useStore(themeAtom)

  const toggleTheme = () => {
    themeAtom.set(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
      {theme === 'dark' ? '☀️' : '🌙'}
    </Button>
  )
}
