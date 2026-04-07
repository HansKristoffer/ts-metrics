import type { z } from 'zod'
import type { CacheAdapter } from './cache.ts'
import { noopCacheAdapter } from './cache.ts'
import type { MetricCatalogMetadata } from './catalog.ts'
import type {
	AnyMetricDefinition,
	MetricDefinition,
	MetricDefinitionInput
} from './define-metric.ts'
import {
	defineDistributionMetric as defineDistributionMetricBase,
	defineKpiMetric as defineKpiMetricBase,
	defineLeaderboardMetric as defineLeaderboardMetricBase,
	defineMetricWithSchema,
	definePivotMetric as definePivotMetricBase,
	defineTableMetric as defineTableMetricBase,
	defineTimeSeriesMetric as defineTimeSeriesMetricBase
} from './define-metric.ts'
import { createRegistry as createBaseRegistry } from './registry.ts'
import type {
	BaseFilters,
	OutputForKind,
	TimeSeriesOutput
} from './schemas/index.ts'
import { BaseFiltersSchema, OutputSchemaMap } from './schemas/index.ts'

// ============================================================================
// Engine Config
// ============================================================================

export type MetricKindSchemaMap = Record<string, z.ZodTypeAny>

type BuiltinMetricKindSchemaMap = typeof OutputSchemaMap
type EngineMetricKindSchemaMap<TCustomKinds extends MetricKindSchemaMap> =
	BuiltinMetricKindSchemaMap & TCustomKinds
type EngineMetricKind<TKindSchemas extends MetricKindSchemaMap> = Extract<
	keyof TKindSchemas,
	string
>
type OutputForSchema<TSchema extends z.ZodTypeAny> = z.output<TSchema>
type EmptyMetricKindSchemaMap = Record<string, never>

export interface MetricsEngineConfig<
	TBaseFilters extends BaseFilters,
	TCustomKinds extends MetricKindSchemaMap = EmptyMetricKindSchemaMap
> {
	baseFilters?: z.ZodType<TBaseFilters>
	cache?: CacheAdapter
	customKinds?: TCustomKinds
}

// ============================================================================
// Engine Builder
// ============================================================================

export function createMetricsEngine<
	TContext,
	TBaseFilters extends BaseFilters = BaseFilters,
	TCustomKinds extends MetricKindSchemaMap = EmptyMetricKindSchemaMap
>(config?: MetricsEngineConfig<TBaseFilters, TCustomKinds>) {
	const cache = config?.cache ?? noopCacheAdapter
	const baseFilterSchema =
		config?.baseFilters ??
		(BaseFiltersSchema as unknown as z.ZodType<TBaseFilters>)
	const kindSchemas = {
		...OutputSchemaMap,
		...(config?.customKinds ?? {})
	} as EngineMetricKindSchemaMap<TCustomKinds>

	type AvailableKinds = EngineMetricKind<typeof kindSchemas>

	function defineMetric<
		TKey extends string,
		TKind extends AvailableKinds,
		TFilters extends TBaseFilters,
		TCatalog extends MetricCatalogMetadata | undefined =
			| MetricCatalogMetadata
			| undefined
	>(
		kind: TKind,
		def: MetricDefinitionInput<
			TKey,
			TKind,
			TFilters,
			OutputForSchema<(typeof kindSchemas)[TKind]>,
			TContext,
			TCatalog
		>
	): MetricDefinition<
		TKey,
		TKind,
		TFilters,
		OutputForSchema<(typeof kindSchemas)[TKind]>,
		TContext,
		TCatalog
	> {
		return defineMetricWithSchema(kind, kindSchemas[kind], def)
	}

	function defineKpiMetric<
		TKey extends string,
		TFilters extends TBaseFilters,
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
		return defineKpiMetricBase<TKey, TFilters, TContext, TCatalog>(def)
	}

	function defineTimeSeriesMetric<
		TKey extends string,
		TFilters extends TBaseFilters,
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
		return defineTimeSeriesMetricBase<TKey, TFilters, TContext, TCatalog>(def)
	}

	function defineDistributionMetric<
		TKey extends string,
		TFilters extends TBaseFilters,
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
		return defineDistributionMetricBase<TKey, TFilters, TContext, TCatalog>(def)
	}

	function defineTableMetric<
		TKey extends string,
		TFilters extends TBaseFilters,
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
		return defineTableMetricBase<TKey, TFilters, TContext, TCatalog>(def)
	}

	function defineLeaderboardMetric<
		TKey extends string,
		TFilters extends TBaseFilters,
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
		return defineLeaderboardMetricBase<TKey, TFilters, TContext, TCatalog>(def)
	}

	function definePivotMetric<
		TKey extends string,
		TFilters extends TBaseFilters,
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
		return definePivotMetricBase<TKey, TFilters, TContext, TCatalog>(def)
	}

	function createRegistry<
		const TMetrics extends readonly AnyMetricDefinition[]
	>(metrics: TMetrics) {
		return createBaseRegistry(metrics, {
			baseFilterSchema,
			kindSchemas
		})
	}

	return {
		cache,
		baseFilterSchema,
		kindSchemas,
		defineMetric,
		defineKpiMetric,
		defineTimeSeriesMetric,
		defineDistributionMetric,
		defineTableMetric,
		defineLeaderboardMetric,
		definePivotMetric,
		createRegistry
	}
}
