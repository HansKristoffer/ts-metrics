// ============================================================================
// Cache Adapter Interface
// ============================================================================

export interface CacheAdapter {
	mget(keys: string[]): Promise<(string | null)[]>
	mset(entries: { key: string; value: string; ttl: number }[]): Promise<void>
}

// ============================================================================
// Noop Cache (default - no caching)
// ============================================================================

export const noopCacheAdapter: CacheAdapter = {
	async mget(keys: string[]): Promise<(string | null)[]> {
		return keys.map(() => null)
	},
	async mset(): Promise<void> {}
}

// ============================================================================
// Cache Parsing
// ============================================================================

interface SafeParseResult<T> {
	success: boolean
	data?: T
}

interface SafeParser<T> {
	safeParse: (data: unknown) => SafeParseResult<T>
}

export function parseCache<T>(
	cached: string | null,
	schema: SafeParser<T>
): T | null {
	if (!cached) return null

	try {
		const parsed = JSON.parse(cached)
		const result = schema.safeParse(parsed)
		if (result.success) {
			return result.data as T
		}
		return null
	} catch {
		return null
	}
}
