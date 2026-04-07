export interface RangeLabelOptions {
	now?: Date
	locale?: string
}

export function computeRangeLabel(
	from: Date | undefined,
	to: Date | undefined,
	options: RangeLabelOptions = {}
): string {
	if (!from || !to) return ''

	const now = options.now ?? new Date()
	const diffMs = to.getTime() - from.getTime()
	const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
	const toIsNow = Math.abs(now.getTime() - to.getTime()) < 1000 * 60 * 60 * 24

	if (toIsNow) {
		if (diffDays <= 1) return 'Last 24 hours'
		if (diffDays <= 7) return 'Last 7 days'
		if (diffDays <= 14) return 'Last 14 days'
		if (diffDays <= 30) return 'Last 30 days'
		if (diffDays <= 60) return 'Last 60 days'
		if (diffDays <= 90) return 'Last 90 days'
		if (diffDays <= 180) return 'Last 6 months'
		if (diffDays <= 365) return 'Last 12 months'
		return `Last ${Math.round(diffDays / 365)} years`
	}

	const locale = options.locale ?? 'en-US'
	const formatDate = (date: Date) =>
		date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })

	const fromYear = from.getFullYear()
	const toYear = to.getFullYear()

	if (fromYear === toYear) {
		return `${formatDate(from)} - ${formatDate(to)}, ${fromYear}`
	}

	return `${formatDate(from)}, ${fromYear} - ${formatDate(to)}, ${toYear}`
}
