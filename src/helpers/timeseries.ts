import type { TimeGranularity } from '../schemas/index.ts'
import type { TimeSeriesPoint } from '../schemas/output.ts'
import { generateBuckets } from '../time.ts'
import { parseClickhouseBucketToTimestamp } from './clickhouse.ts'

export function mapBucketsToPoints<T extends { bucket?: string }>(
	buckets: Date[],
	rows: T[],
	valueExtractor: (row: T) => number
): TimeSeriesPoint[] {
	const dataMap = new Map<number, T>()
	for (const row of rows) {
		if (row.bucket) {
			const ts = parseClickhouseBucketToTimestamp(row.bucket)
			dataMap.set(ts, row)
		}
	}

	return buckets.map((ts) => ({
		ts,
		value: dataMap.has(ts.getTime())
			? valueExtractor(dataMap.get(ts.getTime())!)
			: 0
	}))
}

export function createEmptyPoints(
	from: Date,
	to: Date,
	granularity: TimeGranularity
): TimeSeriesPoint[] {
	const buckets = generateBuckets(from, to, granularity)
	return buckets.map((ts) => ({ ts, value: 0 }))
}
