import { typedSwitch } from 'typedswitch'
import type { MetricType } from '../schemas/metric-type.ts'
import { generateBuckets, inferGranularity } from '../time.ts'

export function resolveMetricType(
	metric: MetricType | undefined,
	defaultMetric: MetricType
): MetricType {
	return metric ?? defaultMetric
}

export function calculateMetricModeValue(args: {
	total: number
	averageDivisor: number
	metric: MetricType | undefined
	defaultMetric: MetricType
	bucketCount?: number
	postProcess?: (value: number) => number
}): number {
	const value = typedSwitch(
		resolveMetricType(args.metric, args.defaultMetric),
		{
			TOTAL: () => args.total,
			AVG: () =>
				args.averageDivisor > 0 ? args.total / args.averageDivisor : 0,
			PER_BUCKET: () =>
				args.bucketCount && args.bucketCount > 0
					? args.total / args.bucketCount
					: 0
		}
	)

	return args.postProcess ? args.postProcess(value) : value
}

export function getMetricModeLabel<
	Labels extends Record<MetricType, string>
>(args: {
	metric: MetricType | undefined
	defaultMetric: MetricType
	labels: Labels
}): Labels[MetricType] {
	return args.labels[resolveMetricType(args.metric, args.defaultMetric)]
}

export function getBucketCountForMetricMode(args: {
	metric: MetricType | undefined
	defaultMetric: MetricType
	from: Date
	to: Date
}): number | undefined {
	if (resolveMetricType(args.metric, args.defaultMetric) !== 'PER_BUCKET') {
		return undefined
	}

	return Math.max(
		1,
		generateBuckets(
			args.from,
			args.to,
			inferGranularity({ from: args.from, to: args.to })
		).length
	)
}
