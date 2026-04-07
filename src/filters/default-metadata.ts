import {
	defineMetricFilterFieldMetadata,
	type MetricFilterFieldMetadata
} from './types.ts'

export const COMMON_METRIC_FILTER_FIELD_METADATA =
	defineMetricFilterFieldMetadata({
		metric: {
			displayName: 'Metric',
			description: 'Choose how the metric should be aggregated.',
			defaultOperator: 'is'
		},
		groupBy: {
			displayName: 'Group By',
			description: 'Split the metric into multiple groups.',
			defaultOperator: 'is'
		},
		limit: {
			displayName: 'Limit',
			description: 'Maximum number of rows to return.'
		},
		view: {
			displayName: 'View',
			description: 'Choose which interpretation of the metric to render.',
			defaultOperator: 'is'
		},
		chartType: {
			displayName: 'Chart Type',
			description: 'Choose the preferred visualization for this metric.',
			defaultOperator: 'is'
		}
	})

export function mergeMetricFilterFieldMetadata(
	...metadataEntries: Array<
		Partial<Record<string, MetricFilterFieldMetadata>> | undefined
	>
): Partial<Record<string, MetricFilterFieldMetadata>> {
	return Object.assign({}, ...metadataEntries)
}
