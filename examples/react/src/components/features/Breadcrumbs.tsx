import { ChevronRight } from 'lucide-react'

export function Breadcrumbs() {
  return (
    <nav aria-label="Breadcrumb" className="ml-2">
      <ol className="flex items-center space-x-3 text-sm">
        <li className="flex">
          <a
            href="#home"
            className="text-gray-500 transition hover:text-gray-700 dark:text-gray-400 hover:dark:text-gray-300"
          >
            Home
          </a>
        </li>
        <ChevronRight
          className="size-4 shrink-0 text-gray-600 dark:text-gray-400"
          aria-hidden="true"
        />
        <li className="flex">
          <div className="flex items-center">
            <a
              href="#quotes"
              // aria-current={page.current ? 'page' : undefined}
              className="text-gray-900 dark:text-gray-50"
            >
              Quotes
            </a>
          </div>
        </li>
      </ol>
    </nav>
  )
}
