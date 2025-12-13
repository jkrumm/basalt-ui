import { IconMenu2, IconX } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'

import ThemeToggle from '@/components/shared/ThemeToggle'
import { Button, buttonVariants } from '@/components/ui/button'

// Create a custom event to communicate between button and panel
const MOBILE_MENU_EVENT = 'mobile-menu-toggle'

export function MobileMenuButton() {
  const [isOpen, setIsOpen] = useState(false)

  const toggleMenu = () => {
    const newState = !isOpen
    setIsOpen(newState)
    window.dispatchEvent(new CustomEvent(MOBILE_MENU_EVENT, { detail: newState }))
  }

  // Listen for menu state changes
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setIsOpen(e.detail)
    }
    window.addEventListener(MOBILE_MENU_EVENT, handler as EventListener)
    return () => window.removeEventListener(MOBILE_MENU_EVENT, handler as EventListener)
  }, [])

  return (
    <Button
      variant="outline"
      size="lg"
      onClick={toggleMenu}
      aria-expanded={isOpen}
      aria-label="Toggle navigation menu"
      aria-controls="mobile-menu"
      className="md:hidden"
    >
      {isOpen ? <IconX className="h-5 w-5" /> : <IconMenu2 className="h-5 w-5" />}
    </Button>
  )
}

export function MobileMenuPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Listen for menu toggle events
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setIsOpen(e.detail)
    }
    window.addEventListener(MOBILE_MENU_EVENT, handler as EventListener)
    return () => window.removeEventListener(MOBILE_MENU_EVENT, handler as EventListener)
  }, [])

  // Body scroll lock when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Escape key handler to close menu
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        window.dispatchEvent(new CustomEvent(MOBILE_MENU_EVENT, { detail: false }))
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen])

  // Focus trap: keep focus within menu when open
  useEffect(() => {
    if (!isOpen) return

    const menu = menuRef.current
    if (!menu) return

    const focusableElements = menu.querySelectorAll(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )

    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        // Shift + Tab: moving backwards
        if (document.activeElement === firstElement) {
          lastElement?.focus()
          e.preventDefault()
        }
      } else {
        // Tab: moving forwards
        if (document.activeElement === lastElement) {
          firstElement?.focus()
          e.preventDefault()
        }
      }
    }

    menu.addEventListener('keydown', trapFocus)

    // Focus first element when menu opens
    firstElement?.focus()

    return () => {
      menu.removeEventListener('keydown', trapFocus)
    }
  }, [isOpen])

  const closeMenu = () => {
    setIsOpen(false)
    window.dispatchEvent(new CustomEvent(MOBILE_MENU_EVENT, { detail: false }))
  }

  return (
    <div
      ref={menuRef}
      id="mobile-menu"
      className={`mobile-menu-panel md:hidden ${isOpen ? 'open' : ''}`}
      role="dialog"
      aria-modal={isOpen}
      aria-label="Mobile navigation"
      style={{
        maxHeight: isOpen ? '500px' : '0px',
        opacity: isOpen ? 1 : 0,
        transition: 'max-height 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease-in-out',
      }}
    >
      <nav className="flex flex-col gap-4 mt-4">
        <a
          href="/typography"
          className="text-lg font-medium hover:text-primary transition-colors"
          onClick={closeMenu}
        >
          Typography
        </a>
        <a
          href="/colors"
          className="text-lg font-medium hover:text-primary transition-colors"
          onClick={closeMenu}
        >
          Colors
        </a>
        <a
          href="/spacing"
          className="text-lg font-medium hover:text-primary transition-colors"
          onClick={closeMenu}
        >
          Spacing
        </a>
        <a
          href="/charts"
          className="text-lg font-medium hover:text-primary transition-colors"
          onClick={closeMenu}
        >
          Charts
        </a>

        <div className="mt-4 flex flex-col gap-3">
          <ThemeToggle />
          <a href="/docs" className={buttonVariants({ variant: 'default', size: 'lg' })}>
            {' '}
            Docs{' '}
          </a>
        </div>
      </nav>
    </div>
  )
}

export default MobileMenuButton
