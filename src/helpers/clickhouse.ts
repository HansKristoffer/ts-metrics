import type { TimeGranularity } from '../schemas/index.ts'
import { normalizeUserDate } from '../time.ts'

const CLICKHOUSE_GRANULARITY_FUNCTIONS = {
	hour: 'toStartOfHour',
	day: 'toStartOfDay',
	week: 'toStartOfWeek',
	month: 'toStartOfMonth',
	quarter: 'toStartOfQuarter',
	year: 'toStartOfYear'
} as const satisfies Record<TimeGranularity, string>

export type ClickhouseGranularityFunction =
	(typeof CLICKHOUSE_GRANULARITY_FUNCTIONS)[TimeGranularity]

export function getClickhouseGranularity(
	granularity: TimeGranularity
): ClickhouseGranularityFunction {
	return CLICKHOUSE_GRANULARITY_FUNCTIONS[granularity]
}

export function buildClickhouseBucketExpr(
	columnName: string,
	granularity: TimeGranularity
): string {
	const fn = CLICKHOUSE_GRANULARITY_FUNCTIONS[granularity]
	if (granularity === 'week') {
		return `${fn}(${columnName}, 1)`
	}
	return `${fn}(${columnName})`
}

export type DayBoundary = 'start' | 'end'

export function toClickhouseDatetime(
	date: Date,
	boundary?: DayBoundary
): string {
	let d = date

	if (boundary === 'start') {
		d = normalizeUserDate(date)
	} else if (boundary === 'end') {
		d = new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1000)
	}

	return d.toISOString().slice(0, 19).replace('T', ' ')
}

export function buildClickhouseTimeParams(filters: {
	from?: Date
	to?: Date
}): { from?: string; to?: string } {
	return {
		...(filters.from ? { from: toClickhouseDatetime(filters.from) } : {}),
		...(filters.to ? { to: toClickhouseDatetime(filters.to) } : {})
	}
}

export function buildClickhouseTimeWhere(
	columnName: string,
	options: { from?: boolean; to?: boolean }
): string {
	const parts: string[] = []

	if (options.from) {
		parts.push(`${columnName} >= {from:DateTime}`)
	}

	if (options.to) {
		parts.push(`${columnName} <= {to:DateTime}`)
	}

	return parts.join(' AND ')
}

export function parseClickhouseBucketToTimestamp(bucket: string): number {
	const isoString = `${bucket.replace(' ', 'T')}Z`
	return new Date(isoString).getTime()
}
