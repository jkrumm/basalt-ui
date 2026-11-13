// Fixture: import-boundary/engine-subpath
// @invalid
import { defineChart } from '@tanstack/charts'
// @invalid
import { Chart } from '@tanstack/charts/react'
// @invalid
import { x } from '@tanstack/charts/transform'
// @invalid
import { x } from '@tanstack/charts/scales/../react'
// @invalid
import { x } from '@tanstack/charts/internal/runtime'
// @valid
import { lineY } from '@tanstack/charts/line'
// @valid
import { scaleBand } from '@tanstack/charts/scales/band'
// @valid
import { binX } from '@tanstack/charts/transform/bin'
// @valid
import { Lines } from 'basalt-ui/charts'
// @valid
import { query } from '@tanstack/react-query'
