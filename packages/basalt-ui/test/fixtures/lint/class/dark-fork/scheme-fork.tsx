// expect: resolvedTheme === 'dark'
// expect: scheme === 'dark'
// expect: theme !== 'light'
// expect: colorScheme === 'dark'
// expect: resolvedTheme === 'dark'
// expect: matchMedia('(prefers-color-scheme: dark)').matches
// expect: resolvedTheme === 'dark'
// expect: isDarkMode
// expect: dark, bound to matchMedia('(prefers-color-scheme: dark)').matches
// expect: darkMode
// expect: root.classList.remove
// expect: root.classList.add
// expect: document.documentElement.classList.toggle
// expect: document.body.classList.add
export function Well() {
  const { resolvedTheme } = useTheme()
  return <div className={resolvedTheme === 'dark' ? 'bg-inset' : 'bg-card'}>w</div>
}
export function Logo() {
  const scheme = readScheme()
  return <div className={cn('p-2', scheme === 'dark' ? 'text-faint' : 'text-foreground')}>l</div>
}
export const Chip = ({ theme }) => (
  <span className={'light' !== theme ? 'bg-inset' : 'bg-card'}>c</span>
)
export const Row = ({ settings }) => (
  <div className={settings.colorScheme === 'dark' ? 'bg-inset' : 'bg-card'}>r</div>
)
export const Edge = ({ resolvedTheme }) => (
  <hr className={cn('border-t', resolvedTheme === 'dark' && 'border-strong')} />
)
export const Os = () => (
  <div
    className={window.matchMedia('(prefers-color-scheme: dark)').matches ? 'bg-inset' : 'bg-card'}
  />
)
export const Avatar = ({ resolvedTheme }) => (
  <img alt="" className={cn('size-8', { invert: resolvedTheme === 'dark' })} />
)
export function Mark() {
  const { isDarkMode } = useDarkMode()
  return <img alt="" className={isDarkMode ? 'invert' : ''} />
}
export function Hero() {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return <div className={dark ? 'opacity-90' : 'opacity-100'} />
}
export const Flip = ({ darkMode }) => <i className={cn(!darkMode && 'opacity-90')} />
export function applyTheme(theme) {
  const root = window.document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(theme)
}
export const flip = (on) => document.documentElement.classList.toggle('dark', on)
export const bodyLight = () => document.body.classList.add('light')
