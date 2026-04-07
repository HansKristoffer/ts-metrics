import type { CacheAdapter } from './cache.ts'
import type { MetricResultChunk, MetricsResult } from './run-metrics.ts'
import type { MetricsRequestFor } from './registry.ts'
import { runMetrics, runMetricsStream } from './run-metrics.ts'
import type { FilterFieldDefinition } from './filters/types.ts'
import {
	parseMetricFilterSchema,
	mergeMetricFilterFieldMetadata,
	COMMON_METRIC_FILTER_FIELD_METADATA
} from './filters/index.ts'
import type {
	AnyRegistry,
	GetMetricByKey,
	InferAvailableMetricKey,
	InferRegistryMetrics,
	MetricCatalogFor,
	MetricKindFor
} from './registry.ts'

export interface MetricsRouterOptions<
	TORPCContext,
	TResolverContext,
	R extends AnyRegistry = AnyRegistry
> {
	registry: R
	createContext: (
		orpcCtx: TORPCContext
	) => TResolverContext | Promise<TResolverContext>
	hasAccess?: (
		metric: InferRegistryMetrics<R>[number],
		orpcCtx: TORPCContext
	) => boolean
	cache?: CacheAdapter
}

export function createRunMetricsProcedure<
	TORPCContext,
	TResolverContext,
	R extends AnyRegistry
>(options: MetricsRouterOptions<TORPCContext, TResolverContext, R>) {
	return async <TRequest extends MetricsRequestFor<R>>(
		input: TRequest,
		orpcCtx: TORPCContext
	): Promise<
		MetricsResult<R, TRequest['metrics']> & { hasErrors: boolean }
	> => {
		const result = await runMetrics({
			registry: options.registry,
			request: input,
			createContext: () => options.createContext(orpcCtx),
			cache: options.cache,
			hasAccess: options.hasAccess
				? (metric) => options.hasAccess!(metric, orpcCtx)
				: undefined
		})

		return {
			...result,
			hasErrors: Object.keys(result.errors).length > 0
		}
	}
}

export function createRunMetricsStreamProcedure<
	TORPCContext,
	TResolverContext,
	R extends AnyRegistry
>(options: MetricsRouterOptions<TORPCContext, TResolverContext, R>) {
	return async function* <TRequest extends MetricsRequestFor<R>>(
		input: TRequest,
		orpcCtx: TORPCContext
	): AsyncGenerator<MetricResultChunk<R, TRequest['metrics']>, void, unknown> {
		yield* runMetricsStream({
			registry: options.registry,
			request: input,
			createContext: () => options.createContext(orpcCtx),
			cache: options.cache,
			hasAccess: options.hasAccess
				? (metric) => options.hasAccess!(metric, orpcCtx)
				: undefined
		})
	}
}

export type AvailableMetricFor<
	R extends AnyRegistry,
	K extends InferAvailableMetricKey<R> = InferAvailableMetricKey<R>
> = {
	key: K
	kind: MetricKindFor<R, K>
	displayName: string
	description: string
	supportsTimeRange: GetMetricByKey<R, K>['supportsTimeRange']
	catalog?: MetricCatalogFor<R, K>
	filters: FilterFieldDefinition[]
}

export type AvailableMetricsResult<R extends AnyRegistry> = {
	metrics: AvailableMetricFor<R>[]
	total: number
}

function toAvailableMetric<
	R extends AnyRegistry,
	K extends InferAvailableMetricKey<R>
>(metric: GetMetricByKey<R, K>): AvailableMetricFor<R, K> {
	const fieldMetadata = mergeMetricFilterFieldMetadata(
		COMMON_METRIC_FILTER_FIELD_METADATA,
		metric.filterFieldMetadata as
			| Record<string, { displayName?: string; description?: string }>
			| undefined
	)

	return {
		key: metric.key,
		kind: metric.kind,
		displayName: metric.catalog?.displayName ?? metric.key,
		description: metric.description,
		supportsTimeRange: metric.supportsTimeRange,
		catalog: metric.catalog,
		filters: parseMetricFilterSchema(metric.filterSchema, {
			excludeFields: ['organizationIds', 'from', 'to'],
			fieldMetadata
		})
	}
}

export function createGetAvailableMetricsProcedure<
	TORPCContext,
	R extends AnyRegistry
>(
	options: Pick<
		MetricsRouterOptions<TORPCContext, unknown, R>,
		'registry' | 'hasAccess'
	>
) {
	return (orpcCtx: TORPCContext): AvailableMetricsResult<R> => {
		const accessibleMetrics: InferRegistryMetrics<R> = options.hasAccess
			? options.registry.metrics.filter(
					(metric: InferRegistryMetrics<R>[number]) =>
						options.hasAccess!(metric, orpcCtx)
				)
			: options.registry.metrics

		const metrics = accessibleMetrics.map(
			(metric: InferRegistryMetrics<R>[number]) =>
				toAvailableMetric(metric as GetMetricByKey<R, typeof metric.key>)
		) as AvailableMetricsResult<R>['metrics']

		return { metrics, total: metrics.length }
	}
}

export function createMetricsRouter<
	TORPCContext,
	TResolverContext,
	R extends AnyRegistry
>(options: MetricsRouterOptions<TORPCContext, TResolverContext, R>) {
	return {
		runMetrics: createRunMetricsProcedure(options),
		runMetricsStream: createRunMetricsStreamProcedure(options),
		getAvailableMetrics: createGetAvailableMetricsProcedure(options)
	}
}
