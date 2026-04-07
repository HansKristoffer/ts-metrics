import type { MetricUnit } from '../schemas/output.ts'

export interface MetricFormatOptions {
	locale?: string
	defaultCurrency?: string
	maximumFractionDigits?: number
}

const CURRENCY_UNITS: MetricUnit[] = ['DKK', 'EUR', 'USD', 'GBP', 'SEK', 'NOK']
const formatterCache = new Map<string, Intl.NumberFormat>()

function getFormatter(
	locale: string,
	options: Intl.NumberFormatOptions = {}
): Intl.NumberFormat {
	const cacheKey = JSON.stringify([locale, options])
	const cached = formatterCache.get(cacheKey)
	if (cached) {
		return cached
	}

	const formatter = new Intl.NumberFormat(locale, options)
	formatterCache.set(cacheKey, formatter)
	return formatter
}

export function formatMetricNumber(
	value: number,
	options: MetricFormatOptions = {}
): string {
	return getFormatter(options.locale ?? 'da-DK').format(value)
}

export function formatMetricDecimal(
	value: number | undefined,
	options: MetricFormatOptions = {}
): string {
	const safeValue = Number.isFinite(value) ? (value as number) : 0
	return getFormatter(options.locale ?? 'da-DK', {
		maximumFractionDigits: options.maximumFractionDigits ?? 2
	}).format(safeValue)
}

export function formatMetricCurrency(
	value: number,
	currency?: string,
	options: MetricFormatOptions = {}
): string {
	return getFormatter(options.locale ?? 'da-DK', {
		style: 'currency',
		currency: currency ?? options.defaultCurrency ?? 'DKK',
		maximumFractionDigits: options.maximumFractionDigits ?? 0
	}).format(value)
}

export function formatKpiValue(
	value: number,
	unit?: MetricUnit,
	prefix?: string,
	suffix?: string,
	options: MetricFormatOptions = {}
): string {
	if (unit && CURRENCY_UNITS.includes(unit)) {
		return formatMetricCurrency(value, unit, options)
	}

	if (unit === 'PERCENTAGE') {
		return `${value.toFixed(options.maximumFractionDigits ?? 1)}%`
	}

	const formatted = formatMetricNumber(value, options)
	const leading = prefix ?? ''
	const trailing = suffix ? ` ${suffix}` : ''
	return `${leading}${formatted}${trailing}`
}
