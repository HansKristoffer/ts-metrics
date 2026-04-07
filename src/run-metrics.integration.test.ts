import { describe, expect, expectTypeOf, test } from 'bun:test'
import { z } from 'zod'
import { createMetricsEngine } from './engine.ts'
import {
	createGetAvailableMetricsProcedure,
	createRunMetricsStreamProcedure
} from './orpc.ts'
import { runMetrics, runMetricsStream } from './run-metrics.ts'
import { defineKpiOutput, BaseFiltersSchema } from './schemas/index.ts'

function createMemoryCache() {
	const store = new Map<string, string>()
	const writes: Array<{ key: string; value: string; ttl: number }> = []

	return {
		writes,
		adapter: {
			async mget(keys: string[]) {
				return keys.map((key) => store.get(key) ?? null)
			},
			async mset(entries: { key: string; value: string; ttl: number }[]) {
				for (const entry of entries) {
					writes.push(entry)
					store.set(entry.key, entry.value)
				}
			}
		}
	}
}

describe('runMetrics integration', () => {
	test('returns request-aware typed results with aliases', async () => {
		const FunnelOutputSchema = z.object({
			kind: z.literal('funnel'),
			steps: z.array(
				z.object({
					key: z.string(),
					value: z.number()
				})
			)
		})

		const FilterSchema = BaseFiltersSchema.extend({
			country: z.string().optional()
		})

		const engine = createMetricsEngine<
			{ tenantId: string },
			z.infer<typeof FilterSchema>,
			{ funnel: typeof FunnelOutputSchema }
		>({
			baseFilters: FilterSchema,
			customKinds: {
				funnel: FunnelOutputSchema
			}
		})

		const revenueMetric = engine.defineKpiMetric({
			key: 'revenue.total',
			description: 'Revenue',
			supportsTimeRange: false,
			filterSchema: FilterSchema,
			cacheTtl: 0,
			async resolve({ filters }) {
				return defineKpiOutput({
					value: filters.country === 'DK' ? 25 : 10,
					label: 'Revenue'
				})
			}
		})

		const funnelMetric = engine.defineMetric('funnel', {
			key: 'pipeline.funnel',
			description: 'Funnel',
			supportsTimeRange: false,
			filterSchema: FilterSchema,
			cacheTtl: 0,
			async resolve() {
				return {
					kind: 'funnel',
					steps: [{ key: 'visits', value: 100 }]
				}
			}
		})

		const registry = engine.createRegistry([
			revenueMetric,
			funnelMetric
		] as const)
		const request = {
			metrics: [
				{
					key: 'revenue.total',
					requestKey: 'revenue',
					filters: { country: 'DK' }
				},
				{ key: 'pipeline.funnel' }
			] as const
		}

		const result = await runMetrics({
			registry,
			request,
			createContext: () => ({ tenantId: 'tenant_1' })
		})

		expectTypeOf(result.metrics.revenue?.current).toEqualTypeOf<
			| {
					kind: 'kpi'
					value: number
					label?: string | undefined
					unit?:
						| 'DKK'
						| 'EUR'
						| 'USD'
						| 'GBP'
						| 'SEK'
						| 'NOK'
						| 'PERCENTAGE'
						| undefined
					prefix?: string | undefined
					suffix?: string | undefined
					trend?: 'up' | 'down' | 'flat' | undefined
			  }
			| undefined
		>()
		expectTypeOf(result.metrics['pipeline.funnel']?.current).toEqualTypeOf<
			| {
					kind: 'funnel'
					steps: Array<{ key: string; value: number }>
			  }
			| undefined
		>()

		expect(result.metrics.revenue?.current).toEqual(
			defineKpiOutput({
				value: 25,
				label: 'Revenue'
			})
		)
		expect(result.metrics['pipeline.funnel']?.current).toEqual({
			kind: 'funnel',
			steps: [{ key: 'visits', value: 100 }]
		})
	})

	test('uses cache hits without rerunning the resolver', async () => {
		const cache = createMemoryCache()
		const engine = createMetricsEngine<{ tenantId: string }>({
			cache: cache.adapter
		})

		let resolveCalls = 0
		const metric = engine.defineKpiMetric({
			key: 'users.active',
			description: 'Active users',
			supportsTimeRange: false,
			filterSchema: BaseFiltersSchema,
			cacheTtl: 60,
			async resolve() {
				resolveCalls++
				return defineKpiOutput({ value: 42, label: 'Users' })
			}
		})

		const registry = engine.createRegistry([metric] as const)
		const request = {
			metrics: [{ key: 'users.active' }] as const
		}

		const first = await runMetrics({
			registry,
			request,
			createContext: () => ({ tenantId: 'tenant_1' }),
			cache: cache.adapter
		})
		const second = await runMetrics({
			registry,
			request,
			createContext: () => ({ tenantId: 'tenant_1' }),
			cache: cache.adapter
		})

		expect(resolveCalls).toBe(1)
		expect(cache.writes).toHaveLength(1)
		expect(first.metrics['users.active']?.execution?.cacheStatus).toBe('miss')
		expect(second.metrics['users.active']?.execution?.cacheStatus).toBe('hit')
	})

	test('streams metric results and exposes ORPC helpers with real runtime behavior', async () => {
		const FilterSchema = BaseFiltersSchema.extend({
			country: z.string().optional()
		})
		const engine = createMetricsEngine<
			{ viewerId: string },
			z.infer<typeof FilterSchema>
		>({
			baseFilters: FilterSchema
		})

		const fastMetric = engine.defineKpiMetric({
			key: 'users.active',
			description: 'Active users',
			supportsTimeRange: false,
			filterSchema: FilterSchema,
			cacheTtl: 0,
			async resolve() {
				return defineKpiOutput({ value: 10, label: 'Users' })
			}
		})

		const slowMetric = engine.defineKpiMetric({
			key: 'revenue.total',
			description: 'Revenue',
			supportsTimeRange: false,
			filterSchema: FilterSchema,
			cacheTtl: 0,
			async resolve({ filters }) {
				await Bun.sleep(10)
				return defineKpiOutput({
					value: filters.country === 'DK' ? 20 : 5,
					label: 'Revenue'
				})
			}
		})

		const registry = engine.createRegistry([fastMetric, slowMetric] as const)
		const streamRequest = {
			metrics: [
				{ key: 'users.active', requestKey: 'users' },
				{
					key: 'revenue.total',
					requestKey: 'revenue',
					filters: { country: 'DK' }
				}
			] as const
		}

		const chunks = []
		for await (const chunk of runMetricsStream({
			registry,
			request: streamRequest,
			createContext: () => ({ viewerId: 'viewer_1' })
		})) {
			chunks.push(chunk)
		}

		expect(chunks).toHaveLength(2)
		expect(chunks.at(-1)?.done).toBe(true)
		expect(chunks.map((chunk) => chunk.requestKey)).toEqual(
			expect.arrayContaining(['users', 'revenue'])
		)

		const getAvailableMetrics = createGetAvailableMetricsProcedure({
			registry,
			hasAccess: (metric, ctx: { allowRevenue: boolean }) =>
				ctx.allowRevenue || metric.key !== 'revenue.total'
		})
		const runStreamProcedure = createRunMetricsStreamProcedure({
			registry,
			createContext: async (ctx: { viewerId: string }) => ctx
		})

		const availableMetrics = getAvailableMetrics({ allowRevenue: false })
		expect(availableMetrics.metrics.map((metric) => metric.key)).toEqual([
			'users.active'
		])

		const procedureChunks = []
		for await (const chunk of runStreamProcedure(streamRequest, {
			viewerId: 'viewer_1'
		})) {
			procedureChunks.push(chunk)
		}

		expect(procedureChunks).toHaveLength(2)
		expect(
			procedureChunks.find((chunk) => chunk.requestKey === 'revenue')?.result
				?.current
		).toEqual(
			defineKpiOutput({
				value: 20,
				label: 'Revenue'
			})
		)
	})
})
