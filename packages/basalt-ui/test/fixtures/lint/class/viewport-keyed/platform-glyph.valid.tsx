import { Kbd } from 'basalt-ui/ui/kbd'
export const Shortcut = () => (
  <>
    <Kbd>Mod</Kbd>
    <Kbd>K</Kbd>
  </>
)
export const named = /Mac|Win/.test(fileName)
export const logged = () => console.log(navigator.userAgent)
