# metrickit

Type-safe metrics, dashboards, and transport primitives for TypeScript apps.

## Features

- Strong TypeScript inference from metric definition to request, result, and dashboard usage
- A single engine that owns shared context, base filters, caching, and custom metric kinds
- Registry-driven execution so one metric list powers runtime lookup and compile-time typing
- Built-in metric kinds for KPI, time series, distribution, table, leaderboard, and pivot outputs
- Extensible custom metric kinds through `engine.defineMetric(kind, def)`
- Pluggable caching through `CacheAdapter` with a Redis adapter at `metrickit/cache-redis`
- ORPC-friendly helpers at `metrickit/orpc`
- Framework-neutral frontend helpers at `metrickit/frontend`

## Install

```bash
bun add metrickit zod
```

or

```bash
npm install metrickit zod
```

`zod` is a peer dependency so your app and `metrickit` share the same Zod version.

## Runtime Support

- Node.js `>=18`
- Bun `>=1.0`

## Package Entry Points

- `metrickit`: engine, registry, schemas, runtime helpers, cache interfaces, and filters
- `metrickit/orpc`: typed router helpers for `runMetrics`, streaming, and catalog discovery
- `metrickit/cache-redis`: Redis cache adapter
- `metrickit/frontend`: typed frontend request, dashboard, stream-state, catalog, and formatting helpers
- `metrickit/helpers`: advanced helper utilities for ClickHouse, Prisma, distributions, timeseries shaping, pivot building, and metric-type helpers

## Supported Public API

The normal supported path is:

- `createMetricsEngine()`
- `engine.define*Metric(...)`
- `engine.createRegistry(...)`
- `runMetrics()` or `createMetricsRouter(...)`
- optional frontend helpers from `metrickit/frontend`

The following are also supported, but are more advanced:

- schemas and filter utilities re-exported from `metrickit`
- `metrickit/helpers` for framework/database-specific helper utilities

Avoid depending on internal source paths or unpublished files inside `dist`.

## Core Workflow

1. Create a metrics engine with your shared context and base filters.
2. Define metrics through that engine.
3. Register the metrics once in a registry.
4. Execute the registry directly or expose it through ORPC.
5. Reuse the same registry types in frontend helpers.

## Quick Start

```ts
import { z } from 'zod'
import {
  BaseFiltersSchema,
  createMetricsEngine,
  defineKpiOutput,
  runMetrics,
} from 'metrickit'
import { createMetricsRouter } from 'metrickit/orpc'
import { redisCacheAdapter } from 'metrickit/cache-redis'

const FunnelOutputSchema = z.object({
  kind: z.literal('funnel'),
  steps: z.array(
    z.object({
      key: z.string(),
      value: z.number(),
    }),
  ),
})

const AppFiltersSchema = BaseFiltersSchema.extend({
  country: z.string().optional(),
})

const metricsEngine = createMetricsEngine<
  { db: unknown; viewerId: string },
  z.infer<typeof AppFiltersSchema>,
  { funnel: typeof FunnelOutputSchema }
>({
  baseFilters: AppFiltersSchema,
  cache: redisCacheAdapter(redisClient),
  customKinds: {
    funnel: FunnelOutputSchema,
  },
})

const totalRevenueMetric = metricsEngine.defineKpiMetric({
  key: 'revenue.total',
  description: 'Total revenue',
  supportsTimeRange: true,
  filterSchema: AppFiltersSchema,
  async resolve({ filters }) {
    return defineKpiOutput({
      value: filters.country === 'DK' ? 1200 : 900,
      label: 'Revenue',
    })
  },
})

const pipelineFunnelMetric = metricsEngine.defineMetric('funnel', {
  key: 'pipeline.funnel',
  description: 'Pipeline conversion funnel',
  supportsTimeRange: false,
  filterSchema: AppFiltersSchema,
  async resolve() {
    return {
      kind: 'funnel',
      steps: [
        { key: 'visits', value: 1200 },
        { key: 'signups', value: 240 },
      ],
    }
  },
})

export const metricsRegistry = metricsEngine.createRegistry([
  totalRevenueMetric,
  pipelineFunnelMetric,
] as const)

export type MetricsRegistry = typeof metricsRegistry

const result = await runMetrics({
  registry: metricsRegistry,
  request: {
    metrics: [
      { key: 'revenue.total', filters: { country: 'DK' } },
      { key: 'pipeline.funnel', requestKey: 'pipeline' },
    ],
    compareToPrevious: true,
  },
  createContext: () => ({
    db,
    viewerId: 'viewer_1',
  }),
})

result.metrics['revenue.total']?.current.value
result.metrics.pipeline?.current.kind

const metricsRouter = createMetricsRouter({
  registry: metricsRegistry,
  createContext: async (orpcCtx: { db: unknown; viewerId: string }) => ({
    db: orpcCtx.db,
    viewerId: orpcCtx.viewerId,
  }),
})
```

## Define An Engine

`createMetricsEngine()` is the main entry point. It owns:

- your resolver context type
- your base filter schema
- your cache adapter
- your custom metric kinds

```ts
const engine = createMetricsEngine<
  { db: DbClient; tenantId: string },
  z.infer<typeof AppFiltersSchema>
>({
  baseFilters: AppFiltersSchema,
})
```

Use the engine methods to define metrics:

- `engine.defineKpiMetric(def)`
- `engine.defineTimeSeriesMetric(def)`
- `engine.defineDistributionMetric(def)`
- `engine.defineTableMetric(def)`
- `engine.defineLeaderboardMetric(def)`
- `engine.definePivotMetric(def)`
- `engine.defineMetric(kind, def)` for custom kinds

## Create A Registry

The registry is the central typed contract for your app.

```ts
export const metricsRegistry = engine.createRegistry([
  totalRevenueMetric,
  pipelineFunnelMetric,
] as const)
```

The registry drives:

- valid metric keys
- request filter typing per metric
- result typing per request
- ORPC procedures
- frontend request and dashboard helpers

## Output Types

There are two similarly named output concepts:

- `MetricOutput` from `metrickit` is the schema-level union of built-in output shapes
- `MetricOutputFromDef` from `metrickit` gives you the resolved output type for a specific metric definition

Use `MetricOutputFromDef` when you want the output type of a concrete metric definition.

## Run Metrics Directly

Use `runMetrics()` on the server when you do not need ORPC.

```ts
const result = await runMetrics({
  registry: metricsRegistry,
  request: {
    metrics: [
      { key: 'revenue.total' },
      { key: 'pipeline.funnel', requestKey: 'pipeline' },
    ],
  },
  createContext: async () => ({ db, viewerId }),
})
```

Use `runMetricsStream()` when your consumer wants streamed chunks as metrics resolve.

## ORPC Integration

`metrickit/orpc` exposes typed helpers for the common API surface.

```ts
import { createMetricsRouter } from 'metrickit/orpc'

export const metricsRouter = createMetricsRouter({
  registry: metricsRegistry,
  createContext: async (orpcCtx: { db: DbClient; viewerId: string }) => ({
    db: orpcCtx.db,
    viewerId: orpcCtx.viewerId,
  }),
})

const availableMetrics = metricsRouter.getAvailableMetrics({
  db,
  viewerId: 'viewer_1',
})

const result = await metricsRouter.runMetrics(
  {
    metrics: [{ key: 'revenue.total' }],
  },
  { db, viewerId: 'viewer_1' },
)
```

## Caching

The engine accepts any `CacheAdapter`. If you already have a Redis-like client, use the built-in adapter:

```ts
import { redisCacheAdapter } from 'metrickit/cache-redis'

const engine = createMetricsEngine({
  cache: redisCacheAdapter(redisClient),
})
```

Your Redis client only needs:

- `mget(...keys)`
- `pipeline().setex(...).exec()`

## Frontend Helpers

`metrickit/frontend` is intentionally framework-neutral. It gives you typed request builders, stream-state helpers, catalog helpers, and dashboard config utilities that can be wrapped by React, Vue, or another UI layer.

```ts
import {
  createMetricsStreamState,
  defineHeadline,
  defineMetricRequest,
  defineMetricsDashboard,
  defineMetricsRequest,
  defineWidget,
  getMetricResult,
} from 'metrickit/frontend'

const request = defineMetricsRequest<typeof metricsRegistry>({
  metrics: [
    defineMetricRequest<typeof metricsRegistry, 'revenue.total'>({
      key: 'revenue.total',
      requestKey: 'revenue',
    }),
  ] as const,
})

const revenueResult = getMetricResult(
  {
    metrics: {
      revenue: {
        current: defineKpiOutput({ value: 1200, label: 'Revenue' }),
        previous: undefined,
        supportsTimeRange: true,
      },
    },
    errors: {},
  },
  'revenue',
)

const dashboard = defineMetricsDashboard<typeof metricsRegistry>({
  title: 'Overview',
  widgets: [
    defineHeadline('Revenue'),
    defineWidget<typeof metricsRegistry, 'revenue.total'>('revenue.total', {
      requestKey: 'revenue',
      layout: { cols: 6 },
    }),
  ] as const,
})

const streamState = createMetricsStreamState(request)
```

The frontend package includes helpers for:

- typed requests and results
- stream-state handling
- dashboard config and widget definitions
- available metric catalog shaping
- formatting and time labels
- chart markers and renderer registries

## Advanced Helpers

Advanced utility helpers are grouped under `metrickit/helpers` instead of the root package so the primary API stays smaller and easier to learn.

```ts
import {
  buildTimeRangeWhere,
  mapBucketsToPoints,
  resolveMetricType,
} from 'metrickit/helpers'
```

## Notes

- `createRegistry()` is the main typed contract you should export from your app.
- `requestKey` lets you alias a metric result key while preserving type safety.
- `runMetrics()` and `runMetricsStream()` validate requests against the registry before executing resolvers.
- Most consumers only need the engine, registry, runtime helpers, and optional ORPC/frontend entry points.
- `metrickit/helpers` is the place for more specialized utilities that are not part of the minimal happy path.

## Local Development

```bash
bun run typecheck
bun test
bun run lint
bun run build
bun run smoke:pack
```
