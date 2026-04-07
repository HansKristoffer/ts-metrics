import { expect, test } from 'bun:test'
import { redisCacheAdapter } from './cache-redis.ts'

test('redisCacheAdapter proxies mget and pipeline writes', async () => {
	const pipelineCalls: Array<[string, number, string] | ['exec']> = []

	const client = {
		async mget(...keys: string[]) {
			return keys.map((key) => `${key}:cached`)
		},
		pipeline() {
			return {
				setex(key: string, seconds: number, value: string) {
					pipelineCalls.push([key, seconds, value])
					return this
				},
				async exec() {
					pipelineCalls.push(['exec'])
				}
			}
		}
	}

	const adapter = redisCacheAdapter(client)

	await expect(adapter.mget(['a', 'b'])).resolves.toEqual([
		'a:cached',
		'b:cached'
	])

	await adapter.mset([
		{ key: 'metrics:a', value: '{"value":1}', ttl: 60 },
		{ key: 'metrics:b', value: '{"value":2}', ttl: 120 }
	])

	expect(pipelineCalls).toEqual([
		['metrics:a', 60, '{"value":1}'],
		['metrics:b', 120, '{"value":2}'],
		['exec']
	])
})
