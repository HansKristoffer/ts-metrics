import type { z } from 'zod'
import type { MetricCatalogMetadata } from './catalog.ts'
import type {
	BaseFilters,
	OutputForKind,
	OutputKind,
	OutputSchemaForKind,
	TimeSeriesOutput
} from './schemas/index.ts'
import {
	DistributionOutputSchema,
	KpiOutputSchema,
	LeaderboardOutputSchema,
	PivotOutputSchema,
	TableOutputSchema,
	TimeSeriesOutputSchema
} from './schemas/index.ts'
import type { TimeGranularity } from './schemas/time.ts'
import type { MetricFilterFieldMetadata } from './filters/types.ts'

// ============================================================================
// Metric Definition
// ============================================================================

export type MetricFilterFieldMetadataMap<TFilters extends BaseFilters> =
	Partial<
		Record<
			Extract<keyof Omit<TFilters, 'organizationIds' | 'from' | 'to'>, string>,
			MetricFilterFieldMetadata
		>
	>

export interface MetricDefinition<
	TKey extends string,
	TKind extends string,
	TFilters extends BaseFilters,
	TOutput,
	TContext = unknown,
	TCatalog extends MetricCatalogMetadata | undefined =
		| MetricCatalogMetadata
		| undefined
> {
	key: TKey
	kind: TKind
	outputSchema: z.ZodType<TOutput>
	description: string
	allowedRoles?: string[]
	supportsTimeRange: boolean
	filterSchema: z.ZodType<TFilters>
	filterFieldMetadata?: MetricFilterFieldMetadataMap<TFilters>
	catalog?: TCatalog
	cacheTtl?: number
	resolve(args: {
		filters: TFilters
		ctx: TContext & { granularity?: TimeGranularity }
	}): Promise<TOutput>
}

export type MetricDefinitionInput<
	TKey extends string,
	TKind extends string,
	TFilters extends BaseFilters,
	TOutput,
	TContext = unknown,
	TCatalog extends MetricCatalogMetadata | undefined =
		| MetricCatalogMetadata
		| undefined
> = Omit<
	MetricDefinition<TKey, TKind, TFilters, TOutput, TContext, TCatalog>,
	'kind' | 'outputSchema'
>

export function defineMetricWithSchema<
	TKey extends string,
	TKind extends string,
	TFilters extends BaseFilters,
	TSchema extends z.ZodTypeAny,
	TContext = unknown,
	TCatalog extends MetricCatalogMetadata | undefined =
		| MetricCatalogMetadata
		| undefined
>(
	kind: TKind,
	outputSchema: TSchema,
	def: MetricDefinitionInput<
		TKey,
		TKind,
		TFilters,
		z.output<TSchema>,
		TContext,
		TCatalog
	>
): MetricDefinition<
	TKey,
	TKind,
	TFilters,
	z.output<TSchema>,
	TContext,
	TCatalog
> {
	return {
		kind,
		outputSchema: outputSchema as unknown as z.ZodType<z.output<TSchema>>,
		...def
	}
}

// ============================================================================
// Built-in Metric Definition Helpers
// ============================================================================

export function defineKpiMetric<
	TKey extends string,
	TFilters extends BaseFilters,
	TContext = unknown,
	TCatalog extends MetricCatalogMetadata | undefined =
		| MetricCatalogMetadata
		| undefined
>(
	def: MetricDefinitionInput<
		TKey,
		'kpi',
		TFilters,
		OutputForKind<'kpi'>,
		TContext,
		TCatalog
	>
): MetricDefinition<
	TKey,
	'kpi',
	TFilters,
	OutputForKind<'kpi'>,
	TContext,
	TCatalog
> {
	return defineMetricWithSchema('kpi', KpiOutputSchema, def)
}

export function defineTimeSeriesMetric<
	TKey extends string,
	TFilters extends BaseFilters,
	TContext = unknown,
	TCatalog extends MetricCatalogMetadata | undefined =
		| MetricCatalogMetadata
		| undefined
>(
	def: MetricDefinitionInput<
		TKey,
		'timeseries',
		TFilters,
		TimeSeriesOutput,
		TContext,
		TCatalog
	>
): MetricDefinition<
	TKey,
	'timeseries',
	TFilters,
	TimeSeriesOutput,
	TContext,
	TCatalog
> {
	return defineMetricWithSchema('timeseries', TimeSeriesOutputSchema, def)
}

export function defineDistributionMetric<
	TKey extends string,
	TFilters extends BaseFilters,
	TContext = unknown,
	TCatalog extends MetricCatalogMetadata | undefined =
		| MetricCatalogMetadata
		| undefined
>(
	def: MetricDefinitionInput<
		TKey,
		'distribution',
		TFilters,
		OutputForKind<'distribution'>,
		TContext,
		TCatalog
	>
): MetricDefinition<
	TKey,
	'distribution',
	TFilters,
	OutputForKind<'distribution'>,
	TContext,
	TCatalog
> {
	return defineMetricWithSchema('distribution', DistributionOutputSchema, def)
}

export function defineTableMetric<
	TKey extends string,
	TFilters extends BaseFilters,
	TContext = unknown,
	TCatalog extends MetricCatalogMetadata | undefined =
		| MetricCatalogMetadata
		| undefined
>(
	def: MetricDefinitionInput<
		TKey,
		'table',
		TFilters,
		OutputForKind<'table'>,
		TContext,
		TCatalog
	>
): MetricDefinition<
	TKey,
	'table',
	TFilters,
	OutputForKind<'table'>,
	TContext,
	TCatalog
> {
	return defineMetricWithSchema('table', TableOutputSchema, def)
}

export function defineLeaderboardMetric<
	TKey extends string,
	TFilters extends BaseFilters,
	TContext = unknown,
	TCatalog extends MetricCatalogMetadata | undefined =
		| MetricCatalogMetadata
		| undefined
>(
	def: MetricDefinitionInput<
		TKey,
		'leaderboard',
		TFilters,
		OutputForKind<'leaderboard'>,
		TContext,
		TCatalog
	>
): MetricDefinition<
	TKey,
	'leaderboard',
	TFilters,
	OutputForKind<'leaderboard'>,
	TContext,
	TCatalog
> {
	return defineMetricWithSchema('leaderboard', LeaderboardOutputSchema, def)
}

export function definePivotMetric<
	TKey extends string,
	TFilters extends BaseFilters,
	TContext = unknown,
	TCatalog extends MetricCatalogMetadata | undefined =
		| MetricCatalogMetadata
		| undefined
>(
	def: MetricDefinitionInput<
		TKey,
		'pivot',
		TFilters,
		OutputForKind<'pivot'>,
		TContext,
		TCatalog
	>
): MetricDefinition<
	TKey,
	'pivot',
	TFilters,
	OutputForKind<'pivot'>,
	TContext,
	TCatalog
> {
	return defineMetricWithSchema('pivot', PivotOutputSchema, def)
}

// ============================================================================
// Output Schema Helpers
// ============================================================================

export function getOutputSchema<T extends AnyMetricDefinition>(
	metric: T
): T['outputSchema'] | OutputSchemaForKind<Extract<T['kind'], OutputKind>> {
	return metric.outputSchema as
		| T['outputSchema']
		| OutputSchemaForKind<Extract<T['kind'], OutputKind>>
}

export function validateMetricOutput<T extends AnyMetricDefinition>(
	metric: T,
	output: unknown
): Awaited<ReturnType<T['resolve']>> {
	return getOutputSchema(metric).parse(output) as Awaited<
		ReturnType<T['resolve']>
	>
}

// ============================================================================
// Registry Types
// ============================================================================

export type AnyMetricDefinition = MetricDefinition<
	string,
	string,
	BaseFilters,
	unknown,
	unknown,
	MetricCatalogMetadata | undefined
>

export type MetricKey<T extends AnyMetricDefinition> = T['key']

export type MetricOutput<T extends AnyMetricDefinition> = Awaited<
	ReturnType<T['resolve']>
>
