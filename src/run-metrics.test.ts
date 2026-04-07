import { describe, test, expect, expectTypeOf } from 'bun:test'

import type { MetricsResult } from './run-metrics.ts'

import type {
	KpiOutput,
	DistributionOutput,
	TableOutput,
	LeaderboardOutput,
	PivotOutput,
	TimeSeriesOutput,
	MetricOutput,
	OutputKind,
	OutputKindMap
} from './schemas/index.ts'
import {
	defineMetricOutput,
	defineKpiOutput,
	defineTimeSeriesOutput,
	defineDistributionOutput,
	defineTableOutput,
	defineLeaderboardOutput,
	definePivotOutput,
	PivotOutputSchema,
	BaseFiltersSchema
} from './schemas/index.ts'

import {
	defineKpiMetric,
	defineTimeSeriesMetric,
	defineDistributionMetric,
	defineTableMetric,
	defineLeaderboardMetric,
	definePivotMetric
} from './define-metric.ts'

import {
	getPreviousPeriod,
	getBucketStart,
	generateBuckets,
	inferGranularity
} from './time.ts'
import { getCacheKey } from './cache-utils.ts'
import {
	isKpi,
	isDistribution,
	isTable,
	isLeaderboard,
	isTimeSeries,
	isPivot
} from './type-guards.ts'

// ═══════════════════════════════════════════════════════════════════════════
// Mock Metrics
// ═══════════════════════════════════════════════════════════════════════════

const TestKpiMetric = defineKpiMetric({
	key: 'test.kpiCount',
	description: 'Test KPI metric for counting',
	allowedRoles: ['Default'],
	supportsTimeRange: false,
	filterSchema: BaseFiltersSchema,
	cacheTtl: 0,
	async resolve() {
		return defineKpiOutput({ value: 42, label: 'Test Count' })
	}
})

const TestKpiRevenueMetric = defineKpiMetric({
	key: 'test.kpiRevenue',
	description: 'Test KPI metric for revenue',
	allowedRoles: ['Default'],
	supportsTimeRange: true,
	filterSchema: BaseFiltersSchema,
	cacheTtl: 0,
	async resolve() {
		return defineKpiOutput({ value: 10000, label: 'Test Revenue', unit: 'DKK' })
	}
})

const TestTimeSeriesMetric = defineTimeSeriesMetric({
	key: 'test.trend',
	description: 'Test trend metric over time',
	allowedRoles: ['Default'],
	supportsTimeRange: true,
	filterSchema: BaseFiltersSchema,
	cacheTtl: 0,
	async resolve() {
		return defineTimeSeriesOutput({
			granularity: 'day',
			series: {
				dataPoints: { label: 'Data Points', points: [] },
				average: { label: 'Average', points: [] }
			}
		})
	}
})

const TestDistributionMetric = defineDistributionMetric({
	key: 'test.distribution',
	description: 'Test distribution metric',
	allowedRoles: ['Default'],
	supportsTimeRange: false,
	filterSchema: BaseFiltersSchema,
	cacheTtl: 0,
	async resolve() {
		return defineDistributionOutput({
			total: 100,
			segments: [
				{ key: 'active', label: 'Active', value: 75, percent: 75 },
				{ key: 'inactive', label: 'Inactive', value: 25, percent: 25 }
			],
			chartType: 'donut'
		})
	}
})

const TestTableMetric = defineTableMetric({
	key: 'test.table',
	description: 'Test table metric with typed rows',
	allowedRoles: ['Default'],
	supportsTimeRange: false,
	filterSchema: BaseFiltersSchema,
	cacheTtl: 0,
	async resolve() {
		return defineTableOutput({
			columns: [
				{ key: 'id', label: 'ID', type: 'string' },
				{ key: 'name', label: 'Name', type: 'string' },
				{ key: 'count', label: 'Count', type: 'number' },
				{ key: 'active', label: 'Active', type: 'boolean' },
				{ key: 'score', label: 'Score', type: 'number', nullable: true }
			],
			rows: [
				{ id: 'item_1', name: 'Item One', count: 42, active: true, score: 85 },
				{
					id: 'item_2',
					name: 'Item Two',
					count: 17,
					active: false,
					score: null
				}
			],
			total: 2
		})
	}
})

const TestLeaderboardMetric = defineLeaderboardMetric({
	key: 'test.leaderboard',
	description: 'Test leaderboard metric with meta',
	allowedRoles: ['Default'],
	supportsTimeRange: true,
	filterSchema: BaseFiltersSchema,
	cacheTtl: 0,
	async resolve() {
		return defineLeaderboardOutput({
			items: [
				{
					rank: 1,
					id: 'user_1',
					label: 'Top User',
					value: 5000,
					meta: { itemCount: 15, email: 'top@example.com' }
				},
				{
					rank: 2,
					id: 'user_2',
					label: 'Second User',
					value: 4200,
					meta: { itemCount: 12 }
				}
			],
			total: 100
		})
	}
})

const TestPivotMetric = definePivotMetric({
	key: 'test.pivot',
	description: 'Test pivot metric',
	allowedRoles: ['Default'],
	supportsTimeRange: true,
	filterSchema: BaseFiltersSchema,
	cacheTtl: 0,
	async resolve() {
		return definePivotOutput({
			rowDimension: { key: 'hour', label: 'Hour' },
			columnDimension: { key: 'day', label: 'Day' },
			rows: ['00:00', '01:00'],
			columns: ['2026-01-01', '2026-01-02'],
			values: [
				[5, 10],
				[2, 8]
			],
			totals: {
				rowTotals: [15, 10],
				columnTotals: [7, 18],
				grandTotal: 25
			}
		})
	}
})

// ═══════════════════════════════════════════════════════════════════════════
// Mock Registry
// ═══════════════════════════════════════════════════════════════════════════

const testMetrics = [
	TestKpiMetric,
	TestKpiRevenueMetric,
	TestTimeSeriesMetric,
	TestDistributionMetric,
	TestTableMetric,
	TestLeaderboardMetric,
	TestPivotMetric
] as const

type TestMetricRegistry = typeof testMetrics
type TestAvailableMetricKey = TestMetricRegistry[number]['key']

type GetTestMetricByKey<K extends TestAvailableMetricKey> = Extract<
	TestMetricRegistry[number],
	{ key: K }
>

type TestMetricOutputFor<K extends TestAvailableMetricKey> = Awaited<
	ReturnType<GetTestMetricByKey<K>['resolve']>
>

type TestMetricFiltersFor<K extends TestAvailableMetricKey> =
	import('zod').infer<GetTestMetricByKey<K>['filterSchema']>

type TestMetricKindFor<K extends TestAvailableMetricKey> =
	GetTestMetricByKey<K>['kind']

type TestMetricSeriesKeysFor<K extends TestAvailableMetricKey> =
	TestMetricOutputFor<K> extends TimeSeriesOutput<infer SeriesKey>
		? SeriesKey
		: never

type TestIsValidMetricKey<K extends string> = K extends TestAvailableMetricKey
	? true
	: false

type TestMetricKeysOfKind<Kind extends OutputKind> = {
	[K in TestAvailableMetricKey]: TestMetricKindFor<K> extends Kind ? K : never
}[TestAvailableMetricKey]

type TestKpiMetricKeys = TestMetricKeysOfKind<'kpi'>
type TestTimeSeriesMetricKeys = TestMetricKeysOfKind<'timeseries'>
type TestDistributionMetricKeys = TestMetricKeysOfKind<'distribution'>
type TestTableMetricKeys = TestMetricKeysOfKind<'table'>
type TestLeaderboardMetricKeys = TestMetricKeysOfKind<'leaderboard'>
type TestPivotMetricKeys = TestMetricKeysOfKind<'pivot'>

interface TestTypedMetricResult<K extends TestAvailableMetricKey> {
	current: TestMetricOutputFor<K>
	previous: TestMetricOutputFor<K> | undefined
	supportsTimeRange: boolean
}

type TestTypedMetricsResult<Keys extends readonly TestAvailableMetricKey[]> = {
	metrics: {
		[K in Keys[number]]?: TestTypedMetricResult<K>
	}
	errors: Partial<Record<Keys[number], string>>
}

interface TestTypedMetricRequest<K extends TestAvailableMetricKey> {
	key: K
	requestKey?: string
	filters?: Partial<
		Omit<TestMetricFiltersFor<K>, 'organizationIds' | 'from' | 'to'>
	>
}

interface TestTypedMetricsRequest<
	Keys extends readonly TestAvailableMetricKey[]
> {
	metrics: { [I in keyof Keys]: TestTypedMetricRequest<Keys[I]> }
	granularity?: import('./schemas/index.ts').TimeGranularity
	compareToPrevious?: boolean
	from?: Date
	to?: Date
}

function getMetric<
	Keys extends readonly TestAvailableMetricKey[],
	K extends Keys[number]
>(
	result: TestTypedMetricsResult<Keys>,
	key: K
):
	| {
			current: TestMetricOutputFor<K>
			previous: TestMetricOutputFor<K> | undefined
	  }
	| undefined {
	return result.metrics[key] as
		| {
				current: TestMetricOutputFor<K>
				previous: TestMetricOutputFor<K> | undefined
		  }
		| undefined
}

// ═══════════════════════════════════════════════════════════════════════════
// Type Tests - Metric Key Inference
// ═══════════════════════════════════════════════════════════════════════════

describe('AvailableMetricKey type inference', () => {
	test('includes all expected metric keys', () => {
		type Keys = TestAvailableMetricKey

		expectTypeOf<'test.kpiCount'>().toMatchTypeOf<Keys>()
		expectTypeOf<'test.kpiRevenue'>().toMatchTypeOf<Keys>()
		expectTypeOf<'test.trend'>().toMatchTypeOf<Keys>()
		expectTypeOf<'test.distribution'>().toMatchTypeOf<Keys>()
		expectTypeOf<'test.table'>().toMatchTypeOf<Keys>()
		expectTypeOf<'test.leaderboard'>().toMatchTypeOf<Keys>()
		expectTypeOf<'test.pivot'>().toMatchTypeOf<Keys>()
	})

	test('rejects invalid metric keys', () => {
		type Keys = TestAvailableMetricKey

		// @ts-expect-error - invalid metric key
		expectTypeOf<'invalid.metric'>().toMatchTypeOf<Keys>()
	})

	test('IsValidMetricKey correctly validates keys', () => {
		expectTypeOf<TestIsValidMetricKey<'test.kpiCount'>>().toEqualTypeOf<true>()
		expectTypeOf<
			TestIsValidMetricKey<'test.distribution'>
		>().toEqualTypeOf<true>()
		expectTypeOf<TestIsValidMetricKey<'invalid.key'>>().toEqualTypeOf<false>()
		expectTypeOf<TestIsValidMetricKey<'random'>>().toEqualTypeOf<false>()
	})
})

// ═══════════════════════════════════════════════════════════════════════════
// Type Tests - Metric Kind Grouping
// ═══════════════════════════════════════════════════════════════════════════

describe('MetricKeysOfKind type grouping', () => {
	test('KpiMetricKeys includes only KPI metrics', () => {
		type Keys = TestKpiMetricKeys

		expectTypeOf<'test.kpiCount'>().toMatchTypeOf<Keys>()
		expectTypeOf<'test.kpiRevenue'>().toMatchTypeOf<Keys>()

		// @ts-expect-error - not a KPI metric
		expectTypeOf<'test.distribution'>().toMatchTypeOf<Keys>()
	})

	test('DistributionMetricKeys includes only distribution metrics', () => {
		type Keys = TestDistributionMetricKeys

		expectTypeOf<'test.distribution'>().toMatchTypeOf<Keys>()

		// @ts-expect-error - not a distribution metric
		expectTypeOf<'test.kpiCount'>().toMatchTypeOf<Keys>()
	})

	test('TableMetricKeys includes only table metrics', () => {
		type Keys = TestTableMetricKeys
		expectTypeOf<'test.table'>().toMatchTypeOf<Keys>()
		// @ts-expect-error - not a table metric
		expectTypeOf<'test.kpiCount'>().toMatchTypeOf<Keys>()
	})

	test('TimeSeriesMetricKeys includes only timeseries metrics', () => {
		type Keys = TestTimeSeriesMetricKeys
		expectTypeOf<'test.trend'>().toMatchTypeOf<Keys>()
		// @ts-expect-error - not a timeseries metric
		expectTypeOf<'test.kpiCount'>().toMatchTypeOf<Keys>()
	})

	test('LeaderboardMetricKeys includes only leaderboard metrics', () => {
		type Keys = TestLeaderboardMetricKeys
		expectTypeOf<'test.leaderboard'>().toMatchTypeOf<Keys>()
		// @ts-expect-error - not a leaderboard metric
		expectTypeOf<'test.kpiCount'>().toMatchTypeOf<Keys>()
	})

	test('PivotMetricKeys includes only pivot metrics', () => {
		type Keys = TestPivotMetricKeys
		expectTypeOf<'test.pivot'>().toMatchTypeOf<Keys>()
		// @ts-expect-error - not a pivot metric
		expectTypeOf<'test.kpiCount'>().toMatchTypeOf<Keys>()
	})
})

// ═══════════════════════════════════════════════════════════════════════════
// Type Tests - Filter Type Inference
// ═══════════════════════════════════════════════════════════════════════════

describe('MetricFiltersFor type inference', () => {
	test('infers base filters for simple metrics', () => {
		type Filters = TestMetricFiltersFor<'test.kpiCount'>
		expectTypeOf<Filters['organizationIds']>().toEqualTypeOf<
			string[] | undefined
		>()
	})

	test('MetricKindFor returns correct kind', () => {
		expectTypeOf<TestMetricKindFor<'test.kpiCount'>>().toEqualTypeOf<'kpi'>()
		expectTypeOf<
			TestMetricKindFor<'test.distribution'>
		>().toEqualTypeOf<'distribution'>()
		expectTypeOf<TestMetricKindFor<'test.table'>>().toEqualTypeOf<'table'>()
		expectTypeOf<
			TestMetricKindFor<'test.trend'>
		>().toEqualTypeOf<'timeseries'>()
		expectTypeOf<
			TestMetricKindFor<'test.leaderboard'>
		>().toEqualTypeOf<'leaderboard'>()
		expectTypeOf<TestMetricKindFor<'test.pivot'>>().toEqualTypeOf<'pivot'>()
	})
})

// ═══════════════════════════════════════════════════════════════════════════
// Type Tests - Output Detail Inference
// ═══════════════════════════════════════════════════════════════════════════

describe('Metric output detail inference', () => {
	test('timeseries series keys are inferred per metric', () => {
		expectTypeOf<TestMetricSeriesKeysFor<'test.trend'>>().toEqualTypeOf<
			'dataPoints' | 'average'
		>()
	})

	test('table output has typed rows array', () => {
		type Output = TestMetricOutputFor<'test.table'>
		expectTypeOf<Output>().toMatchTypeOf<TableOutput>()
		expectTypeOf<Output['kind']>().toEqualTypeOf<'table'>()
		expectTypeOf<Output['rows']>().toMatchTypeOf<
			Array<{
				id: string
				name: string
				count: number
				active: boolean
				score: number | null
			}>
		>()
	})

	test('leaderboard meta infers exact shape for test.leaderboard', () => {
		type Meta = TestMetricOutputFor<'test.leaderboard'>['items'][number]['meta']
		expectTypeOf<Meta>().toMatchTypeOf<
			{ itemCount: number; email?: string } | undefined
		>()
	})

	test('pivot output has typed matrix and dimensions', () => {
		type Output = TestMetricOutputFor<'test.pivot'>
		expectTypeOf<Output>().toMatchTypeOf<PivotOutput>()
		expectTypeOf<Output['kind']>().toEqualTypeOf<'pivot'>()
		expectTypeOf<Output['rows']>().toMatchTypeOf<string[]>()
		expectTypeOf<Output['columns']>().toMatchTypeOf<string[]>()
		expectTypeOf<Output['values']>().toMatchTypeOf<number[][]>()
	})
})

// ═══════════════════════════════════════════════════════════════════════════
// Type Tests - Output Type Mapping
// ═══════════════════════════════════════════════════════════════════════════

describe('MetricOutputFor type mapping', () => {
	test('test.kpiCount returns KpiOutput', () => {
		type Output = TestMetricOutputFor<'test.kpiCount'>
		expectTypeOf<Output>().toMatchTypeOf<KpiOutput>()
		expectTypeOf<Output['kind']>().toEqualTypeOf<'kpi'>()
	})

	test('defineMetricOutput infers kind output type', () => {
		const output = defineMetricOutput('kpi', {
			value: 42,
			label: 'Total Units'
		})
		expectTypeOf(output).toMatchTypeOf<KpiOutput>()
		expectTypeOf(output.kind).toEqualTypeOf<'kpi'>()
	})

	test('defineMetricOutput normalizes object-form timeseries series', () => {
		const output = defineMetricOutput('timeseries', {
			granularity: 'day',
			series: {
				sprays: { label: 'Sprays', points: [] },
				battery: { label: 'Battery', points: [], axis: 'right' }
			}
		})

		expectTypeOf(output).toMatchTypeOf<TimeSeriesOutput>()
		expectTypeOf(output.kind).toEqualTypeOf<'timeseries'>()
		expect(output.series).toEqual([
			{ key: 'sprays', label: 'Sprays', points: [] },
			{ key: 'battery', label: 'Battery', points: [], axis: 'right' }
		])
	})

	test('test.distribution returns DistributionOutput', () => {
		type Output = TestMetricOutputFor<'test.distribution'>
		expectTypeOf<Output>().toMatchTypeOf<DistributionOutput>()
		expectTypeOf<Output['kind']>().toEqualTypeOf<'distribution'>()
	})

	test('defineMetricOutput infers distribution output type', () => {
		const output = defineMetricOutput('distribution', {
			total: 100,
			segments: [{ key: 'active', label: 'Active', value: 100 }],
			chartType: 'bar'
		})

		expectTypeOf(output).toMatchTypeOf<DistributionOutput>()
		expectTypeOf(output.kind).toEqualTypeOf<'distribution'>()
		expect(output.chartType).toBe('bar')
		expect(output.segments[0]?.key).toBe('active')
	})

	test('test.table returns TableOutput', () => {
		type Output = TestMetricOutputFor<'test.table'>
		expectTypeOf<Output>().toMatchTypeOf<TableOutput>()
		expectTypeOf<Output['kind']>().toEqualTypeOf<'table'>()
	})

	test('defineMetricOutput infers table output type', () => {
		const output = defineMetricOutput('table', {
			columns: [{ key: 'name', label: 'Name', type: 'string' }],
			rows: [{ name: 'Unit A' }],
			total: 1
		})
		expectTypeOf(output).toMatchTypeOf<TableOutput>()
		expectTypeOf(output.kind).toEqualTypeOf<'table'>()
		expect(output.rows[0]).toEqual({ name: 'Unit A' })
	})

	test('test.trend returns TimeSeriesOutput', () => {
		type Output = TestMetricOutputFor<'test.trend'>
		expectTypeOf<Output>().toMatchTypeOf<TimeSeriesOutput>()
		expectTypeOf<Output['kind']>().toEqualTypeOf<'timeseries'>()
	})

	test('test.leaderboard returns LeaderboardOutput', () => {
		type Output = TestMetricOutputFor<'test.leaderboard'>
		expectTypeOf<Output>().toMatchTypeOf<LeaderboardOutput>()
		expectTypeOf<Output['kind']>().toEqualTypeOf<'leaderboard'>()
	})

	test('defineMetricOutput infers leaderboard output type', () => {
		const output = defineMetricOutput('leaderboard', {
			items: [{ rank: 1, id: 'user_1', label: 'Top User', value: 5000 }],
			total: 1
		})
		expectTypeOf(output).toMatchTypeOf<LeaderboardOutput>()
		expectTypeOf(output.kind).toEqualTypeOf<'leaderboard'>()
		expect(output.items[0]?.label).toBe('Top User')
	})

	test('test.pivot returns PivotOutput', () => {
		type Output = TestMetricOutputFor<'test.pivot'>
		expectTypeOf<Output>().toMatchTypeOf<PivotOutput>()
		expectTypeOf<Output['kind']>().toEqualTypeOf<'pivot'>()
	})

	test('defineMetricOutput infers pivot output type', () => {
		const output = defineMetricOutput('pivot', {
			rowDimension: { key: 'hour', label: 'Hour' },
			columnDimension: { key: 'day', label: 'Day' },
			rows: ['00:00'],
			columns: ['2026-01-01'],
			values: [[42]]
		})
		expectTypeOf(output).toMatchTypeOf<PivotOutput>()
		expectTypeOf(output.kind).toEqualTypeOf<'pivot'>()
	})

	test('OutputKindMap includes pivot in kind map', () => {
		expectTypeOf<'pivot'>().toMatchTypeOf<keyof OutputKindMap>()
	})
})

// ═══════════════════════════════════════════════════════════════════════════
// Type Tests - TypedMetricsResult Inference
// ═══════════════════════════════════════════════════════════════════════════

describe('TypedMetricsResult type inference', () => {
	test('result metrics have correct types for requested keys', () => {
		type Result = TestTypedMetricsResult<
			readonly ['test.kpiCount', 'test.distribution']
		>
		type Metrics = Result['metrics']

		type KpiCountResult = Metrics['test.kpiCount']
		expectTypeOf<KpiCountResult>().toMatchTypeOf<
			TestTypedMetricResult<'test.kpiCount'> | undefined
		>()

		type DistributionResult = Metrics['test.distribution']
		expectTypeOf<DistributionResult>().toMatchTypeOf<
			TestTypedMetricResult<'test.distribution'> | undefined
		>()
	})

	test('accessing current property gives exact output type', () => {
		type Result = TestTypedMetricsResult<readonly ['test.kpiCount']>
		type CurrentType = NonNullable<
			Result['metrics']['test.kpiCount']
		>['current']
		expectTypeOf<CurrentType>().toMatchTypeOf<KpiOutput>()
		expectTypeOf<CurrentType['value']>().toEqualTypeOf<number>()
	})

	test('errors are typed to requested keys', () => {
		type Result = TestTypedMetricsResult<
			readonly ['test.kpiCount', 'test.distribution']
		>
		type ErrorKeys = keyof Result['errors']
		expectTypeOf<'test.kpiCount'>().toMatchTypeOf<ErrorKeys>()
		expectTypeOf<'test.distribution'>().toMatchTypeOf<ErrorKeys>()
	})
})

// ═══════════════════════════════════════════════════════════════════════════
// Type Tests - runMetrics Function Overloads
// ═══════════════════════════════════════════════════════════════════════════

describe('runMetrics function type inference', () => {
	test('typed result infers types from const metrics', async () => {
		type MockResult = TestTypedMetricsResult<
			readonly ['test.kpiCount', 'test.distribution']
		>
		type KpiCount = NonNullable<
			MockResult['metrics']['test.kpiCount']
		>['current']
		type Distribution = NonNullable<
			MockResult['metrics']['test.distribution']
		>['current']
		expectTypeOf<KpiCount>().toMatchTypeOf<KpiOutput>()
		expectTypeOf<Distribution>().toMatchTypeOf<DistributionOutput>()
	})

	test('untyped result returns generic MetricsResult', async () => {
		const mockResult = {} as MetricsResult
		type MetricsType = typeof mockResult.metrics
		expectTypeOf<MetricsType>().toMatchTypeOf<
			Record<string, { current: MetricOutput; previous?: MetricOutput }>
		>()
	})
})

// ═══════════════════════════════════════════════════════════════════════════
// Type Tests - getMetric Helper
// ═══════════════════════════════════════════════════════════════════════════

describe('getMetric helper type inference', () => {
	test('returns correctly typed result for key', () => {
		const _mockResult = {} as TestTypedMetricsResult<
			readonly ['test.kpiCount', 'test.leaderboard']
		>

		type KpiCountMetric = ReturnType<
			typeof getMetric<
				readonly ['test.kpiCount', 'test.leaderboard'],
				'test.kpiCount'
			>
		>
		expectTypeOf<KpiCountMetric>().toMatchTypeOf<
			{ current: KpiOutput; previous: KpiOutput | undefined } | undefined
		>()

		type LeaderboardMetric = ReturnType<
			typeof getMetric<
				readonly ['test.kpiCount', 'test.leaderboard'],
				'test.leaderboard'
			>
		>
		expectTypeOf<LeaderboardMetric>().toMatchTypeOf<
			| { current: LeaderboardOutput; previous: LeaderboardOutput | undefined }
			| undefined
		>()
	})
})

// ═══════════════════════════════════════════════════════════════════════════
// Type Tests - Type Guards
// ═══════════════════════════════════════════════════════════════════════════

describe('type guard functions', () => {
	test('isKpi narrows to KpiOutput', () => {
		const output: MetricOutput = { kind: 'kpi', value: 42 }
		if (isKpi(output)) {
			expectTypeOf(output).toMatchTypeOf<KpiOutput>()
			expectTypeOf(output.value).toEqualTypeOf<number>()
		}
	})

	test('isDistribution narrows to DistributionOutput', () => {
		const output: MetricOutput = {
			kind: 'distribution',
			total: 100,
			segments: []
		}
		if (isDistribution(output)) {
			expectTypeOf(output).toMatchTypeOf<DistributionOutput>()
		}
	})

	test('isTable narrows to TableOutput', () => {
		const output: MetricOutput = { kind: 'table', columns: [], rows: [] }
		if (isTable(output)) {
			expectTypeOf(output).toMatchTypeOf<TableOutput>()
		}
	})

	test('isLeaderboard narrows to LeaderboardOutput', () => {
		const output: MetricOutput = { kind: 'leaderboard', items: [] }
		if (isLeaderboard(output)) {
			expectTypeOf(output).toMatchTypeOf<LeaderboardOutput>()
		}
	})

	test('isTimeSeries narrows to TimeSeriesOutput', () => {
		const output: MetricOutput = {
			kind: 'timeseries',
			granularity: 'day',
			series: [{ key: 'sprays', points: [] }]
		}
		if (isTimeSeries(output)) {
			expectTypeOf(output).toMatchTypeOf<TimeSeriesOutput>()
		}
	})

	test('isPivot narrows to PivotOutput', () => {
		const output: MetricOutput = {
			kind: 'pivot',
			rowDimension: { key: 'hour', label: 'Hour' },
			columnDimension: { key: 'day', label: 'Day' },
			rows: ['00:00'],
			columns: ['2026-01-01'],
			values: [[1]]
		}
		if (isPivot(output)) {
			expectTypeOf(output).toMatchTypeOf<PivotOutput>()
		}
	})
})

// ═══════════════════════════════════════════════════════════════════════════
// Compile-time Guards (Negative Tests)
// ═══════════════════════════════════════════════════════════════════════════

describe('compile-time type guards', () => {
	test('TypedMetricsRequest rejects invalid metric keys', () => {
		const _validRequest: TestTypedMetricsRequest<
			readonly ['test.kpiCount', 'test.distribution']
		> = {
			metrics: [{ key: 'test.kpiCount' }, { key: 'test.distribution' }]
		}

		// @ts-expect-error - 'invalid.key' is not a valid metric key
		const _invalidRequest: TestTypedMetricsRequest<readonly ['invalid.key']> = {
			metrics: [{ key: 'invalid.key' }]
		}
	})

	test('TypedMetricsResult types metrics based on requested keys', () => {
		type Result = TestTypedMetricsResult<readonly ['test.kpiCount']>
		type ValidAccess = Result['metrics']['test.kpiCount']
		expectTypeOf<ValidAccess>().toMatchTypeOf<
			TestTypedMetricResult<'test.kpiCount'> | undefined
		>()
	})
})

// ═══════════════════════════════════════════════════════════════════════════
// Runtime Tests - Type Guards
// ═══════════════════════════════════════════════════════════════════════════

describe('type guard runtime behavior', () => {
	test('isKpi returns true for kpi output', () => {
		const kpi: MetricOutput = { kind: 'kpi', value: 42 }
		expect(isKpi(kpi)).toBe(true)
		expect(isDistribution(kpi)).toBe(false)
	})

	test('isDistribution returns true for distribution output', () => {
		const dist: MetricOutput = {
			kind: 'distribution',
			total: 100,
			segments: []
		}
		expect(isDistribution(dist)).toBe(true)
		expect(isKpi(dist)).toBe(false)
	})

	test('isTable returns true for table output', () => {
		const table: MetricOutput = { kind: 'table', columns: [], rows: [] }
		expect(isTable(table)).toBe(true)
	})

	test('isLeaderboard returns true for leaderboard output', () => {
		const lb: MetricOutput = { kind: 'leaderboard', items: [] }
		expect(isLeaderboard(lb)).toBe(true)
	})

	test('isTimeSeries returns true for timeseries output', () => {
		const ts: MetricOutput = {
			kind: 'timeseries',
			granularity: 'day',
			series: [{ key: 'sprays', points: [] }]
		}
		expect(isTimeSeries(ts)).toBe(true)
	})

	test('isPivot returns true for pivot output', () => {
		const pivot: MetricOutput = {
			kind: 'pivot',
			rowDimension: { key: 'hour', label: 'Hour' },
			columnDimension: { key: 'day', label: 'Day' },
			rows: ['00:00'],
			columns: ['2026-01-01'],
			values: [[1]]
		}
		expect(isPivot(pivot)).toBe(true)
	})
})

describe('pivot schema validation', () => {
	test('rejects pivot matrix with wrong row count', () => {
		const result = PivotOutputSchema.safeParse({
			kind: 'pivot',
			rowDimension: { key: 'hour', label: 'Hour' },
			columnDimension: { key: 'day', label: 'Day' },
			rows: ['00:00', '01:00'],
			columns: ['2026-01-01'],
			values: [[1]]
		})
		expect(result.success).toBe(false)
	})

	test('rejects pivot totals length mismatch', () => {
		const result = PivotOutputSchema.safeParse({
			kind: 'pivot',
			rowDimension: { key: 'hour', label: 'Hour' },
			columnDimension: { key: 'day', label: 'Day' },
			rows: ['00:00'],
			columns: ['2026-01-01'],
			values: [[1]],
			totals: { rowTotals: [1, 2], columnTotals: [1], grandTotal: 1 }
		})
		expect(result.success).toBe(false)
	})

	test('rejects pivot matrix rows with wrong column count', () => {
		const result = PivotOutputSchema.safeParse({
			kind: 'pivot',
			rowDimension: { key: 'hour', label: 'Hour' },
			columnDimension: { key: 'day', label: 'Day' },
			rows: ['00:00'],
			columns: ['2026-01-01'],
			values: [[1, 2]]
		})
		expect(result.success).toBe(false)
		if (result.success) return
		expect(result.error.issues).toContainEqual(
			expect.objectContaining({
				path: ['values', 0],
				message: 'Pivot row 0 must have 1 columns'
			})
		)
	})

	test('rejects pivot grandTotal mismatching rowTotals', () => {
		const result = PivotOutputSchema.safeParse({
			kind: 'pivot',
			rowDimension: { key: 'hour', label: 'Hour' },
			columnDimension: { key: 'day', label: 'Day' },
			rows: ['00:00'],
			columns: ['2026-01-01'],
			values: [[1]],
			totals: { rowTotals: [2], columnTotals: [1], grandTotal: 1 }
		})
		expect(result.success).toBe(false)
		if (result.success) return
		expect(result.error.issues).toContainEqual(
			expect.objectContaining({
				path: ['totals', 'grandTotal'],
				message: 'grandTotal must equal the sum of rowTotals'
			})
		)
	})

	test('rejects pivot grandTotal mismatching columnTotals', () => {
		const result = PivotOutputSchema.safeParse({
			kind: 'pivot',
			rowDimension: { key: 'hour', label: 'Hour' },
			columnDimension: { key: 'day', label: 'Day' },
			rows: ['00:00'],
			columns: ['2026-01-01'],
			values: [[1]],
			totals: { rowTotals: [1], columnTotals: [2], grandTotal: 1 }
		})
		expect(result.success).toBe(false)
		if (result.success) return
		expect(result.error.issues).toContainEqual(
			expect.objectContaining({
				path: ['totals', 'grandTotal'],
				message: 'grandTotal must equal the sum of columnTotals'
			})
		)
	})

	test('accepts pivot with cellTooltips matching values shape', () => {
		const result = PivotOutputSchema.safeParse({
			kind: 'pivot',
			rowDimension: { key: 'hour', label: 'Hour' },
			columnDimension: { key: 'day', label: 'Day' },
			rows: ['00:00', '01:00'],
			columns: ['2026-01-01', '2026-01-02'],
			values: [
				[1, 2],
				[3, 4]
			],
			cellTooltips: [
				['', 'tip'],
				['a', 'b']
			]
		})
		expect(result.success).toBe(true)
	})

	test('rejects pivot cellTooltips with wrong row count', () => {
		const result = PivotOutputSchema.safeParse({
			kind: 'pivot',
			rowDimension: { key: 'hour', label: 'Hour' },
			columnDimension: { key: 'day', label: 'Day' },
			rows: ['00:00', '01:00'],
			columns: ['2026-01-01'],
			values: [[1], [2]],
			cellTooltips: [['a']]
		})
		expect(result.success).toBe(false)
	})

	test('rejects pivot cellTooltips row with wrong column count', () => {
		const result = PivotOutputSchema.safeParse({
			kind: 'pivot',
			rowDimension: { key: 'hour', label: 'Hour' },
			columnDimension: { key: 'day', label: 'Day' },
			rows: ['00:00'],
			columns: ['2026-01-01', '2026-01-02'],
			values: [[1, 2]],
			cellTooltips: [['a', 'b', 'c']]
		})
		expect(result.success).toBe(false)
		if (result.success) return
		expect(result.error.issues).toContainEqual(
			expect.objectContaining({
				path: ['cellTooltips', 0],
				message: 'cellTooltips row 0 must have 2 columns'
			})
		)
	})
})

// ═══════════════════════════════════════════════════════════════════════════
// Runtime Tests - getMetric Helper
// ═══════════════════════════════════════════════════════════════════════════

describe('getMetric runtime behavior', () => {
	test('returns metric result when present', () => {
		const result: TestTypedMetricsResult<readonly ['test.kpiCount']> = {
			metrics: {
				'test.kpiCount': {
					current: { kind: 'kpi', value: 42, label: 'Test Count' },
					previous: undefined,
					supportsTimeRange: false
				}
			},
			errors: {}
		}
		const metric = getMetric(result, 'test.kpiCount')
		expect(metric).toBeDefined()
		expect(metric?.current.kind).toBe('kpi')
		expect(metric?.current.value).toBe(42)
	})

	test('returns undefined when metric not present', () => {
		const result: TestTypedMetricsResult<readonly ['test.kpiCount']> = {
			metrics: {},
			errors: {}
		}
		const metric = getMetric(result, 'test.kpiCount')
		expect(metric).toBeUndefined()
	})

	test('includes previous period when present', () => {
		const result: TestTypedMetricsResult<readonly ['test.kpiCount']> = {
			metrics: {
				'test.kpiCount': {
					current: { kind: 'kpi', value: 50, label: 'Test Count' },
					previous: { kind: 'kpi', value: 40, label: 'Test Count' },
					supportsTimeRange: false
				}
			},
			errors: {}
		}
		const metric = getMetric(result, 'test.kpiCount')
		expect(metric?.current.value).toBe(50)
		expect(metric?.previous?.value).toBe(40)
	})
})

// ═══════════════════════════════════════════════════════════════════════════
// Runtime Tests - Cache Key Utilities
// ═══════════════════════════════════════════════════════════════════════════

describe('getCacheKey', () => {
	test('generates stable keys for same input', () => {
		const filters = {
			organizationIds: ['org_123'],
			from: new Date('2024-01-01')
		}
		const key1 = getCacheKey('test.kpiCount', filters, 'current')
		const key2 = getCacheKey('test.kpiCount', filters, 'current')
		expect(key1).toBe(key2)
	})

	test('generates different keys for different metrics', () => {
		const filters = { organizationIds: ['org_123'] }
		const key1 = getCacheKey('test.kpiCount', filters, 'current')
		const key2 = getCacheKey('test.distribution', filters, 'current')
		expect(key1).not.toBe(key2)
	})

	test('generates different keys for different periods', () => {
		const filters = { organizationIds: ['org_123'] }
		const key1 = getCacheKey('test.kpiCount', filters, 'current')
		const key2 = getCacheKey('test.kpiCount', filters, 'previous')
		expect(key1).not.toBe(key2)
	})

	test('generates different keys for different granularities', () => {
		const filters = { organizationIds: ['org_123'] }
		const key1 = getCacheKey('test.kpiCount', filters, 'current', 'day')
		const key2 = getCacheKey('test.kpiCount', filters, 'current', 'month')
		expect(key1).not.toBe(key2)
	})

	test('normalizes dates to ISO strings for stable hashing', () => {
		const date = new Date('2024-01-01T00:00:00.000Z')
		const filters1 = { organizationIds: ['org_123'], from: date }
		const filters2 = {
			organizationIds: ['org_123'],
			from: new Date(date.getTime())
		}
		const key1 = getCacheKey('test.kpiCount', filters1, 'current')
		const key2 = getCacheKey('test.kpiCount', filters2, 'current')
		expect(key1).toBe(key2)
	})

	test('includes metric key in cache key', () => {
		const filters = { organizationIds: ['org_123'] }
		const key = getCacheKey('test.kpiCount', filters, 'current')
		expect(key).toContain('metrics:test.kpiCount')
	})
})

// ═══════════════════════════════════════════════════════════════════════════
// Runtime Tests - Time Utilities
// ═══════════════════════════════════════════════════════════════════════════

describe('getPreviousPeriod', () => {
	test('returns null when from/to not provided', () => {
		expect(getPreviousPeriod({})).toBeNull()
		expect(getPreviousPeriod({ from: new Date() })).toBeNull()
		expect(getPreviousPeriod({ to: new Date() })).toBeNull()
	})

	test('calculates previous period with same duration', () => {
		const from = new Date('2024-02-01')
		const to = new Date('2024-02-29')
		const prev = getPreviousPeriod({ from, to })
		expect(prev).not.toBeNull()
		expect(prev?.from).toBeDefined()
		expect(prev?.to).toBeDefined()
		if (prev?.from && prev?.to) {
			expect(prev.to.getTime()).toBe(from.getTime())
			const originalDuration = to.getTime() - from.getTime()
			const prevDuration = prev.to.getTime() - prev.from.getTime()
			expect(prevDuration).toBe(originalDuration)
		}
	})
})

describe('getBucketStart', () => {
	test('returns start of hour (UTC)', () => {
		const date = new Date('2024-01-15T14:35:22.123Z')
		const bucket = getBucketStart(date, 'hour')
		expect(bucket.getUTCHours()).toBe(14)
		expect(bucket.getUTCMinutes()).toBe(0)
		expect(bucket.getUTCSeconds()).toBe(0)
		expect(bucket.getUTCMilliseconds()).toBe(0)
	})

	test('returns start of day (UTC)', () => {
		const date = new Date('2024-01-15T14:35:22.123Z')
		const bucket = getBucketStart(date, 'day')
		expect(bucket.toISOString()).toBe('2024-01-15T00:00:00.000Z')
	})

	test('returns start of week (Monday, UTC)', () => {
		const wednesday = new Date('2024-01-17T14:35:22.123Z')
		const bucket = getBucketStart(wednesday, 'week')
		expect(bucket.toISOString()).toBe('2024-01-15T00:00:00.000Z')
		expect(bucket.getUTCDay()).toBe(1)
	})

	test('returns start of week for Sunday (goes back to previous Monday)', () => {
		const sunday = new Date('2024-01-21T14:35:22.123Z')
		const bucket = getBucketStart(sunday, 'week')
		expect(bucket.toISOString()).toBe('2024-01-15T00:00:00.000Z')
		expect(bucket.getUTCDay()).toBe(1)
	})

	test('returns start of week for Monday (stays on same day)', () => {
		const monday = new Date('2024-01-15T14:35:22.123Z')
		const bucket = getBucketStart(monday, 'week')
		expect(bucket.toISOString()).toBe('2024-01-15T00:00:00.000Z')
		expect(bucket.getUTCDay()).toBe(1)
	})

	test('returns start of month (UTC)', () => {
		const date = new Date('2024-01-15T14:35:22.123Z')
		const bucket = getBucketStart(date, 'month')
		expect(bucket.toISOString()).toBe('2024-01-01T00:00:00.000Z')
	})

	test('returns start of quarter (UTC)', () => {
		const may = new Date('2024-05-15T14:35:22.123Z')
		const bucket = getBucketStart(may, 'quarter')
		expect(bucket.toISOString()).toBe('2024-04-01T00:00:00.000Z')
	})

	test('returns start of year (UTC)', () => {
		const date = new Date('2024-06-15T14:35:22.123Z')
		const bucket = getBucketStart(date, 'year')
		expect(bucket.toISOString()).toBe('2024-01-01T00:00:00.000Z')
	})
})

describe('generateBuckets', () => {
	test('generates daily buckets', () => {
		const from = new Date('2024-01-15T00:00:00.000Z')
		const to = new Date('2024-01-18T00:00:00.000Z')
		const buckets = generateBuckets(from, to, 'day')
		expect(buckets).toHaveLength(4)
		expect(buckets[0].toISOString()).toBe('2024-01-15T00:00:00.000Z')
		expect(buckets[3].toISOString()).toBe('2024-01-18T00:00:00.000Z')
	})

	test('generates hourly buckets', () => {
		const from = new Date('2024-01-15T10:00:00.000Z')
		const to = new Date('2024-01-15T13:00:00.000Z')
		const buckets = generateBuckets(from, to, 'hour')
		expect(buckets).toHaveLength(4)
		expect(buckets[0].toISOString()).toBe('2024-01-15T10:00:00.000Z')
		expect(buckets[3].toISOString()).toBe('2024-01-15T13:00:00.000Z')
	})

	test('generates weekly buckets (Monday-based)', () => {
		const from = new Date('2024-01-15T00:00:00.000Z')
		const to = new Date('2024-01-29T00:00:00.000Z')
		const buckets = generateBuckets(from, to, 'week')
		expect(buckets).toHaveLength(3)
		expect(buckets[0].toISOString()).toBe('2024-01-15T00:00:00.000Z')
		expect(buckets[1].toISOString()).toBe('2024-01-22T00:00:00.000Z')
		expect(buckets[2].toISOString()).toBe('2024-01-29T00:00:00.000Z')
	})

	test('generates monthly buckets', () => {
		const from = new Date('2024-01-01T00:00:00.000Z')
		const to = new Date('2024-04-01T00:00:00.000Z')
		const buckets = generateBuckets(from, to, 'month')
		expect(buckets).toHaveLength(4)
		expect(buckets[0].toISOString()).toBe('2024-01-01T00:00:00.000Z')
		expect(buckets[3].toISOString()).toBe('2024-04-01T00:00:00.000Z')
	})

	test('normalizes late-night UTC times to next day for user-selected dates', () => {
		const from = new Date('2024-01-15T23:00:00.000Z')
		const to = new Date('2024-01-18T00:00:00.000Z')
		const buckets = generateBuckets(from, to, 'day')
		expect(buckets).toHaveLength(3)
		expect(buckets[0].toISOString()).toBe('2024-01-16T00:00:00.000Z')
		expect(buckets[2].toISOString()).toBe('2024-01-18T00:00:00.000Z')
	})

	test('bucket timestamps can be used for direct Map lookup', () => {
		const from = new Date('2024-01-15T00:00:00.000Z')
		const to = new Date('2024-01-17T00:00:00.000Z')
		const buckets = generateBuckets(from, to, 'day')
		const dataMap = new Map<number, number>()
		dataMap.set(new Date('2024-01-15T00:00:00.000Z').getTime(), 100)
		dataMap.set(new Date('2024-01-16T00:00:00.000Z').getTime(), 200)
		expect(dataMap.get(buckets[0].getTime())).toBe(100)
		expect(dataMap.get(buckets[1].getTime())).toBe(200)
		expect(dataMap.get(buckets[2].getTime())).toBeUndefined()
	})
})

describe('inferGranularity', () => {
	test('returns day for empty range', () => {
		expect(inferGranularity({})).toBe('day')
	})

	test('returns hour for ranges up to 2 days', () => {
		const from = new Date('2024-01-01')
		const to = new Date('2024-01-02')
		expect(inferGranularity({ from, to })).toBe('hour')
	})

	test('returns day for ranges up to 31 days', () => {
		const from = new Date('2024-01-01')
		const to = new Date('2024-01-15')
		expect(inferGranularity({ from, to })).toBe('day')
	})

	test('returns week for ranges up to 90 days', () => {
		const from = new Date('2024-01-01')
		const to = new Date('2024-03-01')
		expect(inferGranularity({ from, to })).toBe('week')
	})

	test('returns month for ranges up to 365 days', () => {
		const from = new Date('2024-01-01')
		const to = new Date('2024-06-01')
		expect(inferGranularity({ from, to })).toBe('month')
	})

	test('returns year for very long ranges', () => {
		const from = new Date('2020-01-01')
		const to = new Date('2024-01-01')
		expect(inferGranularity({ from, to })).toBe('year')
	})
})
