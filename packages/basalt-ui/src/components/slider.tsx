'use client'

import { Slider as SliderPrimitive } from '@base-ui/react/slider'

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
  const values: number[] = Array.isArray(value)
    ? (value as number[])
    : Array.isArray(defaultValue)
      ? (defaultValue as number[])
      : [min, max]

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
            className="relative grow overflow-hidden rounded-md bg-muted select-none data-horizontal:h-3 data-horizontal:w-full data-vertical:h-full data-vertical:w-3"
          >
            <SliderPrimitive.Indicator
              data-slot="slider-range"
              className={cn(
                indicatorColors[intent],
                'select-none data-horizontal:h-full data-vertical:w-full',
              )}
            />
          </SliderPrimitive.Track>
          {values.map((v) => (
            <SliderPrimitive.Thumb
              data-slot="slider-thumb"
              key={v}
              className="block size-4 shrink-0 cursor-pointer rounded-md border border-primary bg-white shadow-sm ring-ring/30 transition-colors select-none data-disabled:cursor-not-allowed hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden"
            />
          ))}
        </SliderPrimitive.Control>
      </SliderPrimitive.Root>
      {labelRenderer && (
        <div className="relative mt-1 h-4">
          {values.map((v) => (
            <span
              key={v}
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
