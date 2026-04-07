import type {
	DistributionOutput,
	DistributionChartType
} from '../schemas/index.ts'

export interface SegmentInput<Key extends string = string> {
	key: Key
	label: string
	value: number
}

export interface DistributionOptions {
	chartType?: DistributionChartType
}

export function calculateDistribution<
	const Segments extends readonly SegmentInput[]
>(
	segments: Segments,
	options?: DistributionOptions
): DistributionOutput<Segments[number]['key']> {
	const total = segments.reduce((sum, s) => sum + s.value, 0)

	return {
		kind: 'distribution',
		total,
		segments: segments.map((s) => ({
			key: s.key,
			label: s.label,
			value: s.value,
			percent: total > 0 ? (s.value / total) * 100 : 0
		})),
		chartType: options?.chartType
	}
}

export function calculateDistributionFromGroups<
	TKey extends string,
	TGroup extends { _count: { _all: number } } & Record<TKey, string>
>(
	groups: TGroup[],
	keyField: TKey,
	labelMap: Record<string, string> = {},
	options?: DistributionOptions
): DistributionOutput<TGroup[TKey]> {
	return calculateDistribution(
		groups.map((g) => ({
			key: g[keyField],
			label: labelMap[g[keyField]] ?? g[keyField],
			value: g._count._all
		})),
		options
	)
}
