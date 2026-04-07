export type MetricCatalogFreshness =
	| 'realtime'
	| 'nearRealtime'
	| 'hourly'
	| 'daily'
	| 'manual'

export type MetricCatalogSource = 'prisma' | 'clickhouse' | 'redis' | 'computed'

export interface MetricCatalogMetadata {
	displayName?: string
	owner?: string
	freshness?: MetricCatalogFreshness
	sources?: MetricCatalogSource[]
	intendedUse?: string
	drilldownRoute?: string
	tags?: string[]
}

export function defineMetricCatalogMetadata<T extends MetricCatalogMetadata>(
	metadata: T
): T {
	return metadata
}
