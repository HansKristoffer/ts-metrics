import type { FilterFieldDefinition } from '../filters/types.ts'

type AvailableMetricLike = {
	key: string
	kind: string
	filters: readonly FilterFieldDefinition[]
}

export type AvailableMetricMap<
	TMetrics extends readonly AvailableMetricLike[]
> = {
	[K in TMetrics[number]['key']]: Extract<TMetrics[number], { key: K }>
}

export function createAvailableMetricMap<
	const TMetrics extends readonly AvailableMetricLike[]
>(metrics: TMetrics): AvailableMetricMap<TMetrics> {
	return Object.fromEntries(
		metrics.map((metric) => [metric.key, metric])
	) as AvailableMetricMap<TMetrics>
}

export function getAvailableMetric<
	const TMetrics extends readonly AvailableMetricLike[],
	K extends TMetrics[number]['key']
>(
	metrics: TMetrics,
	key: K
): Extract<TMetrics[number], { key: K }> | undefined {
	return metrics.find((metric) => metric.key === key) as
		| Extract<TMetrics[number], { key: K }>
		| undefined
}

export function getMetricFilterFields(
	metric: { filters: readonly FilterFieldDefinition[] } | undefined
): readonly FilterFieldDefinition[] {
	return metric?.filters ?? []
}

export function groupAvailableMetricsByKind<
	const TMetrics extends readonly AvailableMetricLike[]
>(
	metrics: TMetrics
): {
	[K in TMetrics[number]['kind']]: Array<Extract<TMetrics[number], { kind: K }>>
} {
	const groups: Partial<Record<TMetrics[number]['kind'], TMetrics[number][]>> =
		{}

	for (const metric of metrics) {
		const kind = metric.kind as TMetrics[number]['kind']
		const group = groups[kind] ?? []
		groups[kind] = [...group, metric]
	}

	return groups as {
		[K in TMetrics[number]['kind']]: Array<
			Extract<TMetrics[number], { kind: K }>
		>
	}
}
