import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { noopCacheAdapter, parseCache } from './cache.ts'

describe('cache helpers', () => {
	test('noopCacheAdapter returns cache misses and ignores writes', async () => {
		await expect(noopCacheAdapter.mget(['a', 'b'])).resolves.toEqual([
			null,
			null
		])
		await expect(
			noopCacheAdapter.mset([{ key: 'a', value: '1', ttl: 60 }])
		).resolves.toBeUndefined()
	})

	test('parseCache returns parsed data for valid cache values', () => {
		const schema = z.object({ count: z.number() })

		expect(parseCache('{"count":2}', schema)).toEqual({ count: 2 })
	})

	test('parseCache returns null for invalid JSON or invalid schema data', () => {
		const schema = z.object({ count: z.number() })

		expect(parseCache('not-json', schema)).toBeNull()
		expect(parseCache('{"count":"2"}', schema)).toBeNull()
	})
})
