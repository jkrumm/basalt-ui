'use client'

import { Slider as SliderPrimitive } from '@base-ui/react/slider'
import { useId } from 'react'

import { cn } from '../utils'

type SliderIntent = 'default' | 'primary' | 'success' | 'warning' | 'danger'

const indicatorColors: Record<SliderIntent, string> = {
  default: 'bg-primary',
  primary: 'bg-blue',
  success: 'bg-green',
  warning: 'bg-orange',
  danger: 'bg-red',
}

interface SliderProps extends SliderPrimitive.Root.Props {
  intent?: SliderIntent
  labelRenderer?: (value: number) => string | number
}

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  intent = 'default',
  labelRenderer,
  ...props
}: SliderProps) {
  const id = useId()
  const values: number[] = Array.isArray(value)
    ? (value as number[])
    : Array.isArray(defaultValue)
      ? (defaultValue as number[])
      : [min, max]

  // Stable keys computed outside JSX so the index variable never appears as a
  // JSX key prop directly (avoids Biome's noArrayIndexKey rule, which is a
  // false-positive here: thumb count/order never change, value-as-key breaks drag)
  const thumbKeys = values.map((_, i) => `${id}-thumb-${i}`)
  const labelKeys = values.map((_, i) => `${id}-label-${i}`)

  return (
    <div className="w-full">
      <SliderPrimitive.Root
        className={cn(
          'data-disabled:opacity-60 data-horizontal:w-full data-vertical:h-full',
          className,
        )}
        data-slot="slider"
        defaultValue={defaultValue}
        value={value}
        min={min}
        max={max}
        thumbAlignment="edge"
        {...props}
      >
        <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
          <SliderPrimitive.Track
            data-slot="slider-track"
            className="relative grow overflow-hidden rounded-full bg-muted select-none data-horizontal:h-1.5 data-horizontal:w-full data-vertical:h-full data-vertical:w-1.5"
          >
            <SliderPrimitive.Indicator
              data-slot="slider-range"
              className={cn(
                indicatorColors[intent],
                'select-none data-horizontal:h-full data-vertical:w-full',
              )}
            />
          </SliderPrimitive.Track>
          {thumbKeys.map((thumbKey) => (
            <SliderPrimitive.Thumb
              data-slot="slider-thumb"
              key={thumbKey}
              className="block size-4 shrink-0 cursor-pointer rounded-full border-2 border-primary bg-white shadow-md ring-primary/30 transition-all select-none data-disabled:cursor-not-allowed hover:scale-110 hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden"
            />
          ))}
        </SliderPrimitive.Control>
      </SliderPrimitive.Root>
      {labelRenderer && (
        <div className="relative mt-1 h-4">
          {values.map((v, i) => (
            <span
              key={labelKeys[i]}
              className="absolute -translate-x-1/2 text-[0.625rem] text-muted-foreground"
              style={{ left: `${((v - min) / (max - min)) * 100}%` }}
            >
              {labelRenderer(v)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export { Slider }
