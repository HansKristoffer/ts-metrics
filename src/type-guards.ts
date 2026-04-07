import type {
	MetricOutput,
	KpiOutput,
	TimeSeriesOutput,
	DistributionOutput,
	TableOutput,
	LeaderboardOutput,
	PivotOutput
} from './schemas/index.ts'

export function isKpi(output: MetricOutput): output is KpiOutput {
	return output.kind === 'kpi'
}

export function isTimeSeries(output: MetricOutput): output is TimeSeriesOutput {
	return output.kind === 'timeseries'
}

export function isDistribution(
	output: MetricOutput
): output is DistributionOutput {
	return output.kind === 'distribution'
}

export function isTable(output: MetricOutput): output is TableOutput {
	return output.kind === 'table'
}

export function isLeaderboard(
	output: MetricOutput
): output is LeaderboardOutput {
	return output.kind === 'leaderboard'
}

export function isPivot(output: MetricOutput): output is PivotOutput {
	return output.kind === 'pivot'
}
