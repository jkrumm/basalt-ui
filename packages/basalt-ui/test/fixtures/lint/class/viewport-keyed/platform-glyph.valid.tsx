import { Kbd } from 'basalt-ui/ui/kbd'
export const Shortcut = () => (
  <>
    <Kbd>Mod</Kbd>
    <Kbd>K</Kbd>
  </>
)
export const named = /Mac|Win/.test(fileName)
export const logged = () => console.log(navigator.userAgent)
export const href = /Mac|Win/.test(navigator.userAgent) ? '/dl/app.dmg' : '/dl/app.exe'
export const build = navigator.userAgent.includes('Win') ? `/dl/setup.msi` : '/dl/app.AppImage'
