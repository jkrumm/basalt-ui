import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// ShadCN cn helper
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Tremor Raw cx helper [v0.0.0] - identical to cn() above
export function cx(...args: ClassValue[]) {
  return twMerge(clsx(...args))
}

// Tremor focusInput [v0.0.2]
export const focusInput = [
  // base
  'focus:ring-2',
  // ring color
  'focus:ring-blue-200 dark:focus:ring-blue-700/30',
  // border color
  'focus:border-blue-500 dark:focus:border-blue-700',
]

// Tremor Raw focusRing [v0.0.1]
export const focusRing = [
  // base
  'outline outline-offset-2 outline-0 focus-visible:outline-2',
  // outline color
  'outline-blue-500 dark:outline-blue-500',
]

// Tremor Raw hasErrorInput [v0.0.1]
export const hasErrorInput = [
  // base
  'ring-2',
  // border color
  'border-red-500 dark:border-red-700',
  // ring color
  'ring-red-200 dark:ring-red-700/30',
]

/* Extension from dashboard template */

interface CurrencyParams {
  number: number
  maxFractionDigits?: number
  currency?: string
}

interface PercentageParams {
  number: number
  decimals?: number
}

interface MillionParams {
  number: number
  decimals?: number
}

type FormatterFunctions = {
  currency: (params: CurrencyParams) => string
  unit: (number: number) => string
  percentage: (params: PercentageParams) => string
  million: (params: MillionParams) => string
}

export const formatters: FormatterFunctions = {
  currency: ({ number, maxFractionDigits = 2, currency = 'USD' }: CurrencyParams): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: maxFractionDigits,
    }).format(number)
  },

  unit: (number: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
    }).format(number)
  },

  percentage: ({ number, decimals = 1 }: PercentageParams): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(number)
  },

  million: ({ number, decimals = 1 }: MillionParams): string => {
    return `${new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(number)}M`
  },
}
