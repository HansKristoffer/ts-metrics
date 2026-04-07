import type { CacheAdapter } from './cache.ts'

export interface RedisLikeClient {
	mget(...keys: string[]): Promise<(string | null)[]>
	pipeline(): RedisPipeline
}

export interface RedisPipeline {
	setex(key: string, seconds: number, value: string): RedisPipeline
	exec(): Promise<unknown>
}

export function redisCacheAdapter(client: RedisLikeClient): CacheAdapter {
	return {
		async mget(keys: string[]): Promise<(string | null)[]> {
			if (keys.length === 0) return []
			return client.mget(...keys)
		},

		async mset(
			entries: { key: string; value: string; ttl: number }[]
		): Promise<void> {
			if (entries.length === 0) return

			const pipeline = client.pipeline()

			for (const { key, value, ttl } of entries) {
				if (ttl > 0) {
					pipeline.setex(key, ttl, value)
				}
			}

			await pipeline.exec()
		}
	}
}
