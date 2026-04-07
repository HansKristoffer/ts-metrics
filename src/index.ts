// Engine builder (main entry point)
export {
	createMetricsEngine,
	type MetricKindSchemaMap,
	type MetricsEngineConfig
} from './engine.ts'

// Registry
export {
	createRegistry,
	getMetric,
	type AnyRegistry,
	type InferBaseFilters,
	type InferRegistryMetrics,
	type InferAvailableMetricKey,
	type GetMetricByKey,
	type MetricOutputFor,
	type MetricFiltersFor,
	type MetricKindFor,
	type MetricSeriesKeysFor,
	type MetricRequestFiltersFor,
	type MetricRequestFor,
	type MetricResultChunkFor,
	type MetricsExecutionResult,
	type MetricsRequestFor,
	type IsValidMetricKey,
	type MetricKeysOfKind
} from './registry.ts'

// Metric definition
export {
	defineKpiMetric,
	defineTimeSeriesMetric,
	defineDistributionMetric,
	defineTableMetric,
	defineLeaderboardMetric,
	definePivotMetric,
	getOutputSchema,
	validateMetricOutput,
	defineMetricWithSchema,
	type MetricDefinition,
	type MetricDefinitionInput,
	type MetricFilterFieldMetadataMap,
	type AnyMetricDefinition,
	type MetricKey,
	type MetricOutput as MetricOutputFromDef
} from './define-metric.ts'

// Run metrics engine
export {
	runMetrics,
	runMetricsStream,
	type MetricsRequest,
	type MetricsResult,
	type MetricResultChunk,
	type RunMetricsOptions
} from './run-metrics.ts'

// Cache
export {
	noopCacheAdapter,
	parseCache,
	type CacheAdapter
} from './cache.ts'
export {
	redisCacheAdapter,
	type RedisLikeClient,
	type RedisPipeline
} from './cache-redis.ts'

// Schemas
export * from './schemas/index.ts'

// Time utilities
export {
	getPreviousPeriod,
	getBucketStart,
	normalizeUserDate,
	generateBuckets,
	inferGranularity
} from './time.ts'

// Type guards
export {
	isKpi,
	isTimeSeries,
	isDistribution,
	isTable,
	isLeaderboard,
	isPivot
} from './type-guards.ts'

// Catalog
export {
	defineMetricCatalogMetadata,
	type MetricCatalogMetadata,
	type MetricCatalogFreshness,
	type MetricCatalogSource
} from './catalog.ts'

// Filters
export * from './filters/index.ts'
