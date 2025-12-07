import { useStore } from '@nanostores/react'
import { Monitor, Moon, Sun } from 'lucide-react'

import { cx, focusRing } from '@/lib/utils'
import { setTheme, type Theme, themePreference } from '@/stores/theme'

const themes: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function ThemeToggle() {
  const currentTheme = useStore(themePreference)

  return (
    <div className="flex items-center gap-1 rounded-md bg-gray-100 p-1 dark:bg-gray-900">
      {themes.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={cx(
            'flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors',
            currentTheme === value
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-50'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200',
            focusRing,
          )}
          aria-label={`Switch to ${label} theme`}
          aria-pressed={currentTheme === value}
        >
          <Icon className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}
