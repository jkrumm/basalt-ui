# Shooting settings (expr-n96)

## Question

- Who: a photographer planning kit, opening the library's settings.
- Question: which focal lengths, apertures, ISO values and shutter speeds carry most photos, and which are almost never used?
- Decision: which lens, aperture range and ISO ceiling to buy or pack.
- Figures that answer: the busiest setting of each of the four dimensions (35 mm, f/2.8, ISO 400, 1/250 s) with its share of the photos, drawn as the one accent bar of a bar chart that keeps every bucket, empty ones included.

## Surface

Datasets: one row per dimension, each a count of the same 5,024 photos per setting; the form is `Bars` in a `ChartCard` because the reader compares counts across ordered buckets. The four dimensions are peer cards on one surface; each has its own focus, since the buckets are different items per card and no shared focus exists.

Direction: a 2x2 grid at 1800, one column at 390.

## Fixtures

- default: 5,024 photos. Focal length 20 buckets with 12 mm and 300 mm empty and one 600 mm photo; aperture 25 buckets with f/14 and f/18 empty; ISO a sparse list of 15 values from 100 to 102,400 on 2 photos; shutter 25 buckets with 2 s and 4 s empty.
- no-iso: a library with no ISO recorded; the ISO card says so and what to do, the other three read as usual.
- loading, empty and error come from `?shot-state=`: empty is a library of no photos, error a library that did not answer.

## Read aloud

| fact                                   | every slot that says it                        |
| -------------------------------------- | ---------------------------------------------- |
| Number of photos in the library        | page summary                                   |
| Busiest focal length                   | figure of the focal card, accent bar           |
| Share of photos at the busiest setting | figure period                                  |
| Settings under 1 % of photos           | footer of each card, the grey zone on the plot |
| Rarest setting and its count           | footer of each card                            |
| Count at the busiest setting           | label on the accent bar                        |
| Unit "photos"                          | y axis title                                   |

## One view

| part               | question it answers                   | x,y w×h          | what it joins                       |
| ------------------ | ------------------------------------- | ---------------- | ----------------------------------- |
| Page summary       | how many photos are counted           | 0,0 full x 1 row | none, states the base               |
| Focal length card  | which focal lengths carry most photos | 0,1 half x 1 row | its own focus (bars, figure period) |
| Aperture card      | which apertures                       | 1,1 half x 1 row | its own focus                       |
| ISO card           | which ISO values                      | 0,2 half x 1 row | its own focus                       |
| Shutter speed card | which shutter speeds                  | 1,2 half x 1 row | its own focus                       |

Frames opened: rest, loading, empty, error and the no-iso fixture in light and dark at 1800 and 390, plus the keys frame.
