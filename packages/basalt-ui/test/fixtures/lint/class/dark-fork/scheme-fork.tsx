// expect: resolvedTheme === 'dark'
// expect: scheme === 'dark'
// expect: theme !== 'light'
// expect: colorScheme === 'dark'
// expect: resolvedTheme === 'dark'
// expect: matchMedia('(prefers-color-scheme: dark)').matches
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
  <div className={window.matchMedia('(prefers-color-scheme: dark)').matches ? 'bg-inset' : 'bg-card'} />
)
