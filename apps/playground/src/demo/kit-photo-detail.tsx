import { useFormat } from 'basalt-ui'
import { StatCard } from 'basalt-ui/cards'
import { Sparkline } from 'basalt-ui/charts'
import { Facts } from 'basalt-ui/page'
import type { ReactElement } from 'react'
import { COLLECTION_LABELS, VERDICT_LABELS } from './kit-photos'
import type { Photo } from './kit-photos'

/** The label row under a photo's 14-day views trend. */
const VIEW_DAYS = ['14 days ago', '7 days ago', 'Today'] as const

/**
 * One photo's detail, as every Kit surface shows it (the peek, the dock, the aside, a split pane and the photo's
 * own page): its properties as `Facts`, then its views as a card with the 14-day trend.
 */
export function PhotoDetail({ photo }: { photo: Photo }): ReactElement {
  const f = useFormat()
  return (
    <div className="flex flex-col gap-4">
      <Facts
        rows={[
          { label: 'Collection', value: COLLECTION_LABELS[photo.collection] },
          { label: 'Verdict', value: VERDICT_LABELS[photo.verdict] },
          { label: 'Taken', value: f.date(Date.parse(photo.taken)) },
          { label: 'Camera', value: `${photo.camera}, ${photo.lens}` },
          { label: 'Exposure', value: `${photo.aperture}, ${photo.shutter} s, ISO ${photo.iso}` },
          { label: 'File', value: `${photo.sizeMb} MB` },
        ]}
      />
      <StatCard
        title="Views"
        subtitle="last 14 days"
        value={photo.views}
        chart={(box) => (
          <Sparkline
            points={photo.perDay}
            height={box.height}
            axisLabels={VIEW_DAYS}
            label={`Views per day of ${photo.title}, 14 days`}
          />
        )}
      />
    </div>
  )
}
