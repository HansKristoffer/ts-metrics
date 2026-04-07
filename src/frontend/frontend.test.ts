import { describe, expect, expectTypeOf, test } from 'bun:test'
import { createMetricsEngine } from '../engine.ts'
import { defineKpiOutput, BaseFiltersSchema } from '../schemas/index.ts'
import {
	createAvailableMetricMap,
	computeRangeLabel,
	createMetricsStreamState,
	type DashboardResultKey,
	type DashboardState,
	defineCustomSlot,
	defineHeadline,
	defineMetricRequest,
	defineMetricsDashboard,
	defineMetricsRequest,
	defineRendererRegistry,
	defineSpacer,
	defineWidget,
	filterChartMarkers,
	formatKpiValue,
	formatMetricCurrency,
	formatMetricDecimal,
	formatMetricNumber,
	getAvailableMetric,
	getMarkerCategories,
	getMetricFilterFields,
	getMetricResult,
	getRequestedMetricKey,
	groupAvailableMetricsByKind,
	mapLogItemsToMarkers,
	resolveRendererHandle,
	SEVERITY_COLORS,
	toggleAllMarkerTypes,
	toggleMarkerType,
	applyMetricResultChunk
} from './index.ts'

describe('frontend helpers', () => {
	test('preserve registry-aware request and result typing', async () => {
		const engine = createMetricsEngine<{ tenantId: string }>({
			baseFilters: BaseFiltersSchema
		})

		const usersMetric = engine.defineKpiMetric({
			key: 'users.active',
			description: 'Active users',
			supportsTimeRange: false,
			filterSchema: BaseFiltersSchema,
			cacheTtl: 0,
			async resolve() {
				return defineKpiOutput({ value: 12, label: 'Users' })
			}
		})

		const revenueMetric = engine.defineKpiMetric({
			key: 'revenue.total',
			description: 'Revenue',
			supportsTimeRange: false,
			filterSchema: BaseFiltersSchema,
			cacheTtl: 0,
			async resolve() {
				return defineKpiOutput({ value: 30, label: 'Revenue', unit: 'DKK' })
			}
		})

		const registry = engine.createRegistry([
			usersMetric,
			revenueMetric
		] as const)
		const request = defineMetricsRequest({
			metrics: [
				defineMetricRequest<typeof registry, 'users.active'>({
					key: 'users.active',
					requestKey: 'users'
				}),
				defineMetricRequest<typeof registry, 'revenue.total'>({
					key: 'revenue.total'
				})
			] as const
		})

		expect(getRequestedMetricKey(request.metrics[0])).toBe('users')
		expect(getRequestedMetricKey(request.metrics[1])).toBe('revenue.total')

		const result = {
			metrics: {
				users: {
					current: defineKpiOutput({ value: 12, label: 'Users' }),
					previous: undefined,
					supportsTimeRange: false
				},
				'revenue.total': {
					current: defineKpiOutput({
						value: 30,
						label: 'Revenue',
						unit: 'DKK'
					}),
					previous: undefined,
					supportsTimeRange: false
				}
			},
			errors: {}
		}

		expectTypeOf(getMetricResult(result, 'users')?.current.value).toEqualTypeOf<
			number | undefined
		>()
		expectTypeOf(
			getRequestedMetricKey(request.metrics[0])
		).toEqualTypeOf<'users'>()
		expect(getMetricResult(result, 'users')?.current.label).toBe('Users')
	})

	test('merge stream chunks into stable frontend state', () => {
		const engine = createMetricsEngine<{ tenantId: string }>({
			baseFilters: BaseFiltersSchema
		})
		const metric = engine.defineKpiMetric({
			key: 'users.active',
			description: 'Active users',
			supportsTimeRange: false,
			filterSchema: BaseFiltersSchema,
			cacheTtl: 0,
			async resolve() {
				return defineKpiOutput({ value: 10, label: 'Users' })
			}
		})
		const registry = engine.createRegistry([metric] as const)
		const request = defineMetricsRequest({
			metrics: [{ key: 'users.active', requestKey: 'users' }] as const
		})

		const initialState = createMetricsStreamState<
			typeof registry,
			typeof request.metrics
		>(request)
		expect(initialState.pendingKeys).toEqual(['users'])

		const nextState = applyMetricResultChunk(initialState, {
			key: 'users.active',
			requestKey: 'users',
			result: {
				current: defineKpiOutput({ value: 10, label: 'Users' }),
				previous: undefined,
				supportsTimeRange: false
			},
			done: true
		})

		expect(nextState.status).toBe('complete')
		expect(nextState.done).toBe(true)
		expect(nextState.pendingKeys).toEqual([])
		expect(nextState.metrics.users?.current.value).toBe(10)
	})

	test('format helpers stay pure and configurable', () => {
		expect(formatMetricNumber(1200, { locale: 'en-US' })).toBe('1,200')
		expect(formatMetricDecimal(12.345, { locale: 'en-US' })).toBe('12.35')
		expect(formatMetricCurrency(1200, 'USD', { locale: 'en-US' })).toBe(
			'$1,200'
		)
		expect(formatKpiValue(12.3, 'PERCENTAGE')).toBe('12.3%')
		expect(
			formatKpiValue(42, undefined, '~', 'units', { locale: 'en-US' })
		).toBe('~42 units')
	})

	test('time helpers create human readable range labels', () => {
		expect(
			computeRangeLabel(
				new Date('2026-01-02T00:00:00Z'),
				new Date('2026-02-01T00:00:00Z'),
				{
					now: new Date('2026-02-01T12:00:00Z')
				}
			)
		).toBe('Last 30 days')

		expect(
			computeRangeLabel(
				new Date('2025-01-01T00:00:00Z'),
				new Date('2025-01-15T00:00:00Z'),
				{
					now: new Date('2026-02-01T00:00:00Z'),
					locale: 'en-US'
				}
			)
		).toBe('Jan 1 - Jan 15, 2025')
	})

	test('marker helpers stay framework neutral', () => {
		const markers = mapLogItemsToMarkers([
			{
				id: '1',
				createdAt: '2026-01-01T00:00:00Z',
				data: {
					type: 'UNIT_STATUS',
					title: 'Status updated',
					severity: 'warning'
				}
			},
			{
				id: '2',
				createdAt: '2026-01-02T00:00:00Z',
				data: {
					type: 'UNIT_DESTROYED',
					title: 'Destroyed',
					severity: 'danger'
				}
			}
		])

		const enabledTypes = toggleAllMarkerTypes(markers, true)
		expect(SEVERITY_COLORS.warning).toBe('#f59e0b')
		expect(filterChartMarkers(markers, enabledTypes)).toHaveLength(2)
		expect(getMarkerCategories(markers, enabledTypes)).toEqual([
			{
				type: 'UNIT_STATUS',
				label: 'Status Changes',
				count: 1,
				enabled: true
			},
			{
				type: 'UNIT_DESTROYED',
				label: 'Destroyed',
				count: 1,
				enabled: true
			}
		])
		expect(
			toggleMarkerType(enabledTypes, 'UNIT_STATUS').has('UNIT_STATUS')
		).toBe(false)
	})

	test('dashboard and renderer helpers avoid framework components', () => {
		const engine = createMetricsEngine<{ tenantId: string }>({
			baseFilters: BaseFiltersSchema
		})
		const usersMetric = engine.defineKpiMetric({
			key: 'users.active',
			description: 'Active users',
			supportsTimeRange: false,
			filterSchema: BaseFiltersSchema,
			cacheTtl: 0,
			async resolve() {
				return defineKpiOutput({ value: 10, label: 'Users' })
			}
		})
		const registry = engine.createRegistry([usersMetric] as const)

		const dashboard = defineMetricsDashboard<typeof registry>({
			title: 'Overview',
			widgets: [
				defineHeadline('Core metrics'),
				defineWidget<typeof registry, 'users.active'>('users.active', {
					requestKey: 'users',
					layout: { cols: 6 }
				}),
				defineSpacer({ cols: 6 }),
				defineCustomSlot('marketing-banner', {
					layout: { cols: 12 },
					props: { tone: 'info' }
				})
			] as const
		})

		type ResultKeys = DashboardResultKey<
			typeof registry,
			typeof dashboard.widgets
		>
		type DashboardWidgetState = DashboardState<
			typeof registry,
			typeof dashboard.widgets
		>

		const rendererRegistry = defineRendererRegistry<
			typeof registry,
			'custom:users'
		>({
			byMetricKey: {
				'users.active': 'custom:users'
			}
		})

		expectTypeOf<ResultKeys>().toEqualTypeOf<'users'>()
		expectTypeOf<DashboardWidgetState['users']>().toMatchTypeOf<
			| {
					isLoading: boolean
					result?: {
						current: { kind: 'kpi'; value: number }
					}
			  }
			| undefined
		>()
		expectTypeOf(dashboard.widgets[3]).toEqualTypeOf<{
			_type: 'slot'
			slotId: 'marketing-banner'
			layout?: { cols?: 12 }
			props?: Record<string, unknown>
		}>()
		expect(dashboard.widgets).toHaveLength(4)
		expectTypeOf(
			resolveRendererHandle('users.active', 'kpi', rendererRegistry).rendererId
		).toEqualTypeOf<'custom:users' | 'kind:kpi'>()
		expect(
			resolveRendererHandle('users.active', 'kpi', rendererRegistry)
		).toEqual({
			rendererId: 'custom:users',
			source: 'metric',
			metricKey: 'users.active',
			kind: 'kpi'
		})
	})

	test('catalog helpers shape runtime metadata for frontend forms', () => {
		const metrics = [
			{
				key: 'users.active',
				kind: 'kpi',
				displayName: 'Active users',
				description: 'Current active users',
				supportsTimeRange: false,
				filters: [
					{
						id: 'country',
						displayName: 'Country',
						type: 'text'
					}
				]
			},
			{
				key: 'revenue.total',
				kind: 'kpi',
				displayName: 'Revenue',
				description: 'Total revenue',
				supportsTimeRange: true,
				filters: []
			}
		] as const

		expectTypeOf(
			createAvailableMetricMap(metrics)['users.active']?.kind
		).toEqualTypeOf<'kpi' | undefined>()
		expect(createAvailableMetricMap(metrics)['users.active']?.displayName).toBe(
			'Active users'
		)
		expect(
			getAvailableMetric(metrics, 'revenue.total')?.supportsTimeRange
		).toBe(true)
		expect(groupAvailableMetricsByKind(metrics).kpi).toHaveLength(2)
		expect(getMetricFilterFields(metrics[0])).toEqual([
			{
				id: 'country',
				displayName: 'Country',
				type: 'text'
			}
		])
	})
})
