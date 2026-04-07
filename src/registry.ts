import { z } from 'zod'
import type { AnyMetricDefinition } from './define-metric.ts'
import { getOutputSchema as getOutputSchemaImpl } from './define-metric.ts'
import type { MetricCatalogMetadata } from './catalog.ts'
import type {
	BaseFilters,
	MetricResult,
	TimeGranularity,
	TimeSeriesOutput
} from './schemas/index.ts'
import {
	BaseFiltersSchema,
	OutputSchemaMap,
	TimeGranularitySchema
} from './schemas/index.ts'

export interface RegistryOptions<
	TBaseFilters extends BaseFilters = BaseFilters,
	TKindSchemas extends Record<string, z.ZodTypeAny> = typeof OutputSchemaMap
> {
	baseFilterSchema?: z.ZodType<TBaseFilters>
	kindSchemas?: TKindSchemas
}

// ============================================================================
// Registry Creation
// ============================================================================

export function createRegistry<
	const TMetrics extends readonly AnyMetricDefinition[],
	TBaseFilters extends BaseFilters = BaseFilters,
	TKindSchemas extends Record<string, z.ZodTypeAny> = typeof OutputSchemaMap
>(metrics: TMetrics, options?: RegistryOptions<TBaseFilters, TKindSchemas>) {
	type Registry = TMetrics
	type AvailableMetricKey = Registry[number]['key']

	const metricKeys = metrics.map((m) => m.key) as unknown as [
		AvailableMetricKey,
		...AvailableMetricKey[]
	]

	const MetricKeySchema = z.enum(metricKeys)

	const MetricRequestSchema = z.object({
		key: MetricKeySchema,
		requestKey: z.string().optional(),
		filters: z.record(z.string(), z.unknown()).optional()
	})

	const MetricsRequestSchema = z.object({
		metrics: z
			.array(MetricRequestSchema)
			.min(1, 'At least one metric required'),
		granularity: TimeGranularitySchema.optional(),
		from: z.date().optional(),
		to: z.date().optional(),
		compareToPrevious: z.boolean().optional().default(false),
		disableCache: z.boolean().optional().default(false)
	})

	const metricsByKey = Object.fromEntries(
		metrics.map((metric) => [metric.key, metric])
	) as Record<AvailableMetricKey, AnyMetricDefinition>
	const baseFilterSchema =
		options?.baseFilterSchema ??
		(BaseFiltersSchema as unknown as z.ZodType<TBaseFilters>)
	const kindSchemas = (options?.kindSchemas ??
		OutputSchemaMap) as TKindSchemas & typeof OutputSchemaMap

	function getMetricByKey<K extends AvailableMetricKey>(
		key: K
	): Extract<Registry[number], { key: K }>
	function getMetricByKey(key: string): AnyMetricDefinition | undefined
	function getMetricByKey(key: string): AnyMetricDefinition | undefined {
		return metricsByKey[key as AvailableMetricKey]
	}

	function parseMetricRequestInput<
		K extends AvailableMetricKey,
		TRequestKey extends string | undefined = string | undefined
	>(
		metricRequest: {
			key: K
			requestKey?: TRequestKey
			filters?: Partial<
				Omit<
					z.infer<Extract<Registry[number], { key: K }>['filterSchema']>,
					'from' | 'to'
				>
			>
		},
		options?: {
			from?: Date
			to?: Date
		}
	) {
		const metric = getMetricByKey(metricRequest.key)
		if (!metric) {
			throw new Error(`Unknown metric: ${metricRequest.key}`)
		}

		const baseFilters = baseFilterSchema.parse({
			from: options?.from,
			to: options?.to,
			...(metricRequest.filters as Record<string, unknown>)
		}) as BaseFilters

		return {
			metric,
			requestKey: getMetricResultKey(metricRequest),
			filters: metric.filterSchema.parse(baseFilters) as z.infer<
				Extract<Registry[number], { key: K }>['filterSchema']
			>
		}
	}

	return {
		metrics,
		baseFilterSchema,
		kindSchemas,
		metricKeys,
		MetricKeySchema,
		MetricRequestSchema,
		MetricsRequestSchema,
		metricsByKey,
		getMetricByKey,
		parseMetricRequestInput,
		getOutputSchema: getOutputSchemaImpl
	} as const
}

// ============================================================================
// Registry Types
// ============================================================================

// biome-ignore lint/suspicious/noExplicitAny: Required for generic registry inference
export type AnyRegistry = ReturnType<typeof createRegistry<any>>

export type InferRegistryMetrics<R extends AnyRegistry> = R['metrics']
export type InferBaseFilters<R extends AnyRegistry> = z.infer<
	R['baseFilterSchema']
>

export type InferAvailableMetricKey<R extends AnyRegistry> =
	InferRegistryMetrics<R>[number]['key']

export type GetMetricByKey<
	R extends AnyRegistry,
	K extends InferAvailableMetricKey<R>
> = Extract<InferRegistryMetrics<R>[number], { key: K }>

export type MetricOutputFor<
	R extends AnyRegistry,
	K extends InferAvailableMetricKey<R>
> = Awaited<ReturnType<GetMetricByKey<R, K>['resolve']>>

export type MetricFiltersFor<
	R extends AnyRegistry,
	K extends InferAvailableMetricKey<R>
> = z.infer<GetMetricByKey<R, K>['filterSchema']>

export type MetricCatalogFor<
	R extends AnyRegistry,
	K extends InferAvailableMetricKey<R>
> = GetMetricByKey<R, K>['catalog'] extends MetricCatalogMetadata | undefined
	? GetMetricByKey<R, K>['catalog']
	: MetricCatalogMetadata | undefined

type GlobalRequestFilterKeys = 'from' | 'to'

export type MetricRequestFiltersFor<
	R extends AnyRegistry,
	K extends InferAvailableMetricKey<R>
> = Omit<MetricFiltersFor<R, K>, GlobalRequestFilterKeys>

export type MetricKindFor<
	R extends AnyRegistry,
	K extends InferAvailableMetricKey<R>
> = GetMetricByKey<R, K>['kind']

export type MetricSeriesKeysFor<
	R extends AnyRegistry,
	K extends InferAvailableMetricKey<R>
> =
	MetricOutputFor<R, K> extends TimeSeriesOutput<infer SeriesKey>
		? SeriesKey
		: never

export type MetricKeyToOutput<R extends AnyRegistry> = {
	[K in InferAvailableMetricKey<R>]: MetricOutputFor<R, K>
}

export type MetricKeyToFilters<R extends AnyRegistry> = {
	[K in InferAvailableMetricKey<R>]: MetricFiltersFor<R, K>
}

export type MetricKeyToKind<R extends AnyRegistry> = {
	[K in InferAvailableMetricKey<R>]: MetricKindFor<R, K>
}

export type MetricRequestFor<
	R extends AnyRegistry,
	K extends InferAvailableMetricKey<R> = InferAvailableMetricKey<R>,
	TRequestKey extends string | undefined = string | undefined
> =
	K extends InferAvailableMetricKey<R>
		? {
				key: K
				requestKey?: TRequestKey
				filters?: Partial<MetricRequestFiltersFor<R, K>>
			}
		: never

export interface MetricsRequestFor<R extends AnyRegistry> {
	metrics: readonly MetricRequestFor<R>[]
	granularity?: TimeGranularity
	from?: Date
	to?: Date
	compareToPrevious?: boolean
	disableCache?: boolean
}

export type IsValidMetricKey<R extends AnyRegistry, K extends string> =
	K extends InferAvailableMetricKey<R> ? true : false

export type MetricKeysOfKind<
	R extends AnyRegistry,
	Kind extends InferRegistryMetrics<R>[number]['kind']
> = {
	[K in InferAvailableMetricKey<R>]: MetricKindFor<R, K> extends Kind
		? K
		: never
}[InferAvailableMetricKey<R>]

// ============================================================================
// Typed Result Types
// ============================================================================

export type TypedMetricResult<
	R extends AnyRegistry,
	K extends InferAvailableMetricKey<R>
> = MetricResult<MetricOutputFor<R, K>>

export type TypedMetricsResult<
	R extends AnyRegistry,
	Keys extends readonly InferAvailableMetricKey<R>[]
> = {
	metrics: {
		[K in Keys[number]]?: TypedMetricResult<R, K>
	}
	errors: Partial<Record<Keys[number], string>>
}

type RequestedMetricResultKey<TMetricRequest> = TMetricRequest extends {
	requestKey: infer TRequestKey extends string
}
	? TRequestKey
	: TMetricRequest extends { key: infer TMetricKey extends string }
		? TMetricKey
		: never

export type MetricRequestResultKey<TMetricRequest> =
	RequestedMetricResultKey<TMetricRequest>

export function getMetricResultKey<
	TMetricRequest extends { key: string; requestKey?: string }
>(metricRequest: TMetricRequest): MetricRequestResultKey<TMetricRequest> {
	return (metricRequest.requestKey ??
		metricRequest.key) as MetricRequestResultKey<TMetricRequest>
}

export type RequestedMetricKeys<
	R extends AnyRegistry,
	TMetricRequests extends readonly MetricRequestFor<R>[]
> = RequestedMetricResultKey<TMetricRequests[number]>

export type MetricRequestForResultKey<
	R extends AnyRegistry,
	TMetricRequests extends readonly MetricRequestFor<R>[],
	TResultKey extends RequestedMetricKeys<R, TMetricRequests>
> =
	Extract<TMetricRequests[number], { requestKey: TResultKey }> extends never
		? Extract<TMetricRequests[number], { key: TResultKey }>
		: Extract<TMetricRequests[number], { requestKey: TResultKey }>

export type MetricResultForResultKey<
	R extends AnyRegistry,
	TMetricRequests extends readonly MetricRequestFor<R>[],
	TResultKey extends RequestedMetricKeys<R, TMetricRequests>
> =
	MetricRequestForResultKey<R, TMetricRequests, TResultKey> extends {
		key: infer TMetricKey extends InferAvailableMetricKey<R>
	}
		? TypedMetricResult<R, TMetricKey>
		: never

export type MetricsExecutionResult<
	R extends AnyRegistry,
	TMetricRequests extends readonly MetricRequestFor<R>[]
> = {
	metrics: {
		[TResultKey in RequestedMetricKeys<
			R,
			TMetricRequests
		>]?: MetricResultForResultKey<R, TMetricRequests, TResultKey>
	}
	errors: Partial<Record<RequestedMetricKeys<R, TMetricRequests>, string>>
}

export type MetricResultChunkFor<
	R extends AnyRegistry,
	TMetricRequests extends readonly MetricRequestFor<R>[]
> = TMetricRequests[number] extends infer TMetricRequest
	? TMetricRequest extends {
			key: infer TMetricKey extends InferAvailableMetricKey<R>
		}
		? {
				key: TMetricKey
				requestKey?: RequestedMetricResultKey<TMetricRequest>
				result?: TypedMetricResult<R, TMetricKey>
				error?: string
				done: boolean
			}
		: never
	: never

export function getMetric<
	R extends AnyRegistry,
	Keys extends readonly InferAvailableMetricKey<R>[],
	K extends Keys[number]
>(
	result: TypedMetricsResult<R, Keys>,
	key: K
):
	| {
			current: MetricOutputFor<R, K>
			previous: MetricOutputFor<R, K> | undefined
	  }
	| undefined {
	return result.metrics[key] as
		| {
				current: MetricOutputFor<R, K>
				previous: MetricOutputFor<R, K> | undefined
		  }
		| undefined
}
