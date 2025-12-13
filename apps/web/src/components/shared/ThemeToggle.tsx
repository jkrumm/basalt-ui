import { IconDeviceDesktopFilled, IconMoonFilled, IconSunFilled } from '@tabler/icons-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

type Theme = 'light' | 'dark' | 'system'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  // Get initial theme from DOM on mount
  useEffect(() => {
    const preference = document.documentElement.getAttribute(
      'data-theme-preference',
    ) as Theme | null
    if (preference) {
      setTheme(preference)
    }
    setMounted(true)
  }, [])

  // Listen to system preference changes when theme is set to system
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', e.matches)
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [theme])

  const cycleTheme = () => {
    // Cycle: system -> light -> dark -> system
    const nextTheme: Theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'

    setTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)

    const root = document.documentElement
    root.setAttribute('data-theme-preference', nextTheme)

    // Resolve theme
    if (nextTheme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', systemDark)
      root.setAttribute('data-theme', systemDark ? 'dark' : 'light')
    } else {
      root.classList.toggle('dark', nextTheme === 'dark')
      root.setAttribute('data-theme', nextTheme)
    }
  }

  const icons = {
    light: IconSunFilled,
    dark: IconMoonFilled,
    system: IconDeviceDesktopFilled,
  }

  const Icon = icons[theme]

  const labels = {
    light: 'Light',
    dark: 'Dark',
    system: 'System',
  }

  // Show a loading state until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="lg"
        aria-label="Loading theme toggle"
        className="cursor-pointer gap-2"
        type="button"
        disabled
      >
        <IconDeviceDesktopFilled className="h-4 w-4" />
        <span>System</span>
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      size="lg"
      onClick={cycleTheme}
      aria-label={`Current theme: ${theme}. Click to cycle.`}
      className="cursor-pointer gap-2"
      type="button"
    >
      <Icon className="h-4 w-4" />
      <span>{labels[theme]}</span>
    </Button>
  )
}
