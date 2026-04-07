import type { TimeGranularity, TimeRange } from './schemas/index.ts'

export function getPreviousPeriod(range: TimeRange): TimeRange | null {
	if (!range.from || !range.to) return null

	const durationMs = range.to.getTime() - range.from.getTime()
	return {
		from: new Date(range.from.getTime() - durationMs),
		to: new Date(range.from.getTime())
	}
}

export function getBucketStart(date: Date, granularity: TimeGranularity): Date {
	const d = new Date(date)

	switch (granularity) {
		case 'hour':
			d.setUTCMinutes(0, 0, 0)
			break
		case 'day':
			d.setUTCHours(0, 0, 0, 0)
			break
		case 'week': {
			const day = d.getUTCDay()
			const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1)
			d.setUTCDate(diff)
			d.setUTCHours(0, 0, 0, 0)
			break
		}
		case 'month':
			d.setUTCDate(1)
			d.setUTCHours(0, 0, 0, 0)
			break
		case 'quarter': {
			const month = d.getUTCMonth()
			const quarterStart = month - (month % 3)
			d.setUTCMonth(quarterStart, 1)
			d.setUTCHours(0, 0, 0, 0)
			break
		}
		case 'year':
			d.setUTCMonth(0, 1)
			d.setUTCHours(0, 0, 0, 0)
			break
	}

	return d
}

export function normalizeUserDate(date: Date): Date {
	const d = new Date(date)
	const hours = d.getUTCHours()

	if (hours >= 20) {
		d.setUTCDate(d.getUTCDate() + 1)
	}

	d.setUTCHours(0, 0, 0, 0)
	return d
}

export function generateBuckets(
	from: Date,
	to: Date,
	granularity: TimeGranularity
): Date[] {
	const buckets: Date[] = []

	const normalizedFrom = granularity === 'hour' ? from : normalizeUserDate(from)
	const normalizedTo = granularity === 'hour' ? to : normalizeUserDate(to)
	let current = getBucketStart(normalizedFrom, granularity)

	while (current <= normalizedTo) {
		buckets.push(new Date(current))
		current = getNextBucket(current, granularity)
	}

	return buckets
}

function getNextBucket(date: Date, granularity: TimeGranularity): Date {
	const d = new Date(date)

	switch (granularity) {
		case 'hour':
			d.setUTCHours(d.getUTCHours() + 1)
			break
		case 'day':
			d.setUTCDate(d.getUTCDate() + 1)
			break
		case 'week':
			d.setUTCDate(d.getUTCDate() + 7)
			break
		case 'month':
			d.setUTCMonth(d.getUTCMonth() + 1)
			break
		case 'quarter':
			d.setUTCMonth(d.getUTCMonth() + 3)
			break
		case 'year':
			d.setUTCFullYear(d.getUTCFullYear() + 1)
			break
	}

	return d
}

export function inferGranularity(range: TimeRange): TimeGranularity {
	if (!range.from || !range.to) return 'day'

	const diffMs = range.to.getTime() - range.from.getTime()
	const diffDays = diffMs / (1000 * 60 * 60 * 24)

	if (diffDays <= 2) return 'hour'
	if (diffDays <= 31) return 'day'
	if (diffDays <= 90) return 'week'
	if (diffDays <= 365) return 'month'
	if (diffDays <= 730) return 'quarter'
	return 'year'
}
