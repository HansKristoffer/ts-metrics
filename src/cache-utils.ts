type JsonPrimitive = string | number | boolean | null | JsonPrimitive[]

export function stableHash(obj: Record<string, JsonPrimitive>): string {
	const stable = JSON.stringify(obj, Object.keys(obj).sort())
	let h = 2166136261
	for (let i = 0; i < stable.length; i++) {
		h ^= stable.charCodeAt(i)
		h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)
	}
	return (h >>> 0).toString(16)
}

export function normalizeForCache(
	obj: Record<string, unknown>
): Record<string, JsonPrimitive> {
	const result: Record<string, JsonPrimitive> = {}

	for (const [key, value] of Object.entries(obj)) {
		if (value === undefined) continue

		if (value instanceof Date) {
			result[key] = value.toISOString()
		} else if (Array.isArray(value)) {
			result[key] = value.map((v) =>
				v instanceof Date ? v.toISOString() : v
			) as JsonPrimitive[]
		} else if (typeof value === 'object' && value !== null) {
			const nested = normalizeForCache(value as Record<string, unknown>)
			for (const [nk, nv] of Object.entries(nested)) {
				result[`${key}.${nk}`] = nv
			}
		} else if (
			typeof value === 'string' ||
			typeof value === 'number' ||
			typeof value === 'boolean' ||
			value === null
		) {
			result[key] = value
		}
	}

	return result
}

export function getCacheKey(
	metricKey: string,
	filters: Record<string, unknown>,
	period: 'current' | 'previous' = 'current',
	granularity?: string
): string {
	const normalized = normalizeForCache({
		...filters,
		granularity
	})
	const hash = stableHash(normalized)
	return `metrics:${metricKey}:${period}:${hash}`
}
