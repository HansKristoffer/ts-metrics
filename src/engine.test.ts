import { describe, expect, expectTypeOf, test } from 'bun:test'
import { z } from 'zod'
import { defineMetricCatalogMetadata } from './catalog.ts'
import { createMetricsEngine } from './engine.ts'
import { createMetricsRouter } from './orpc.ts'
import { runMetrics } from './run-metrics.ts'
import { BaseFiltersSchema, defineKpiOutput } from './schemas/index.ts'
import type { MetricsRequestFor } from './registry.ts'

const FunnelOutputSchema = z.object({
	kind: z.literal('funnel'),
	steps: z.array(
		z.object({
			key: z.string(),
			value: z.number()
		})
	)
})

describe('createMetricsEngine', () => {
	test('supports custom metric kinds owned by the engine', async () => {
		const EngineFiltersSchema = BaseFiltersSchema.extend({
			segment: z.enum(['smb', 'enterprise']).optional()
		})

		const engine = createMetricsEngine<
			{ tenantId: string },
			z.infer<typeof EngineFiltersSchema>,
			{ funnel: typeof FunnelOutputSchema }
		>({
			baseFilters: EngineFiltersSchema,
			customKinds: {
				funnel: FunnelOutputSchema
			}
		})

		const funnelMetric = engine.defineMetric('funnel', {
			key: 'pipeline.funnel',
			description: 'Pipeline funnel',
			supportsTimeRange: false,
			filterSchema: EngineFiltersSchema,
			cacheTtl: 0,
			async resolve({ filters, ctx }) {
				expectTypeOf(filters.segment).toEqualTypeOf<
					'smb' | 'enterprise' | undefined
				>()
				expectTypeOf(ctx.tenantId).toEqualTypeOf<string>()

				return {
					kind: 'funnel',
					steps: [{ key: filters.segment ?? 'all', value: 3 }]
				}
			}
		})

		const registry = engine.createRegistry([funnelMetric] as const)
		const result = await runMetrics({
			registry,
			request: {
				metrics: [{ key: 'pipeline.funnel', filters: { segment: 'smb' } }]
			},
			createContext: () => ({ tenantId: 'tenant_1' })
		})

		expect(result.errors).toEqual({})
		expect(result.metrics['pipeline.funnel']?.current).toEqual({
			kind: 'funnel',
			steps: [{ key: 'smb', value: 3 }]
		})
		expect(registry.getOutputSchema(funnelMetric)).toBe(FunnelOutputSchema)
	})

	test('validates engine-owned base filters before executing metrics', async () => {
		const EngineFiltersSchema = BaseFiltersSchema.extend({
			segment: z.enum(['smb', 'enterprise']).optional()
		})

		const engine = createMetricsEngine<
			{ tenantId: string },
			z.infer<typeof EngineFiltersSchema>
		>({
			baseFilters: EngineFiltersSchema
		})

		const metric = engine.defineKpiMetric({
			key: 'users.active',
			description: 'Active users',
			supportsTimeRange: false,
			filterSchema: EngineFiltersSchema,
			cacheTtl: 0,
			async resolve() {
				return defineKpiOutput({ value: 42 })
			}
		})

		const registry = engine.createRegistry([metric] as const)
		expect(() =>
			registry.parseMetricRequestInput(
				{
					key: 'users.active',
					filters: { segment: 'midmarket' } as Record<string, unknown>
				},
				{}
			)
		).toThrow()

		const result = await runMetrics({
			registry,
			request: {
				metrics: [
					{
						key: 'users.active',
						filters: { segment: 'midmarket' } as Record<string, unknown>
					}
				]
			},
			createContext: () => ({ tenantId: 'tenant_1' })
		})

		expect(result.metrics).toEqual({})
		expect(result.errors['users.active']).toBeDefined()
	})

	test('exposes typed ORPC procedures from ts-metrics/orpc', async () => {
		const EngineFiltersSchema = BaseFiltersSchema.extend({
			country: z.string().optional()
		})

		const engine = createMetricsEngine<
			{ viewerId: string },
			z.infer<typeof EngineFiltersSchema>
		>({
			baseFilters: EngineFiltersSchema
		})

		const metric = engine.defineKpiMetric({
			key: 'revenue.total',
			description: 'Total revenue',
			supportsTimeRange: false,
			filterSchema: EngineFiltersSchema,
			catalog: defineMetricCatalogMetadata({
				displayName: 'Revenue',
				freshness: 'daily',
				tags: ['finance']
			}),
			cacheTtl: 0,
			async resolve({ filters, ctx }) {
				expectTypeOf(filters.country).toEqualTypeOf<string | undefined>()
				expectTypeOf(ctx.viewerId).toEqualTypeOf<string>()

				return defineKpiOutput({
					value: filters.country === 'DK' ? 10 : 5,
					label: 'Revenue'
				})
			}
		})

		const registry = engine.createRegistry([metric] as const)
		const router = createMetricsRouter({
			registry,
			createContext: async (orpcCtx: { viewerId: string }) => ({
				viewerId: orpcCtx.viewerId
			})
		})

		expectTypeOf<Parameters<typeof router.runMetrics>[0]>().toEqualTypeOf<
			MetricsRequestFor<typeof registry>
		>()

		const availableMetrics = router.getAvailableMetrics({
			viewerId: 'viewer_1'
		})
		expectTypeOf(availableMetrics.metrics[0]?.key).toEqualTypeOf<
			'revenue.total' | undefined
		>()
		expectTypeOf(availableMetrics.metrics[0]?.kind).toEqualTypeOf<
			'kpi' | undefined
		>()
		expectTypeOf(availableMetrics.metrics[0]?.catalog?.freshness).toEqualTypeOf<
			'daily' | undefined
		>()

		const result = await router.runMetrics(
			{
				metrics: [{ key: 'revenue.total', filters: { country: 'DK' } }]
			},
			{ viewerId: 'viewer_1' }
		)

		expect(result.hasErrors).toBe(false)
		expect(result.metrics['revenue.total']?.current).toEqual(
			defineKpiOutput({
				value: 10,
				label: 'Revenue'
			})
		)
		expect(availableMetrics.metrics).toHaveLength(1)
	})
})
