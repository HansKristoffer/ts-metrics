import { z } from 'zod'
import { TimeGranularitySchema } from './time.ts'

// ============================================================================
// Output Kind Discriminator
// ============================================================================

export const OutputKindSchema = z.enum([
	'kpi',
	'timeseries',
	'distribution',
	'table',
	'leaderboard',
	'pivot'
])
export type OutputKind = z.infer<typeof OutputKindSchema>

// ============================================================================
// Metric Unit (for KPI)
// ============================================================================

export const MetricUnitSchema = z.enum([
	'DKK',
	'EUR',
	'USD',
	'GBP',
	'SEK',
	'NOK',
	'PERCENTAGE'
])
export type MetricUnit = z.infer<typeof MetricUnitSchema>

// ============================================================================
// KPI Output
// ============================================================================

export const KpiOutputSchema = z.object({
	kind: z.literal('kpi'),
	value: z.number(),
	label: z.string().optional(),
	unit: MetricUnitSchema.optional(),
	prefix: z.string().optional(),
	suffix: z.string().optional(),
	trend: z.enum(['up', 'down', 'flat']).optional()
})
export type KpiOutput = z.infer<typeof KpiOutputSchema>

export function defineKpiOutput(
	output: Omit<KpiOutput, 'kind'> & { kind?: 'kpi' }
): KpiOutput {
	return {
		kind: 'kpi',
		...output
	}
}

// ============================================================================
// TimeSeries Output
// ============================================================================

export const TimeSeriesPointSchema = z.object({
	ts: z.date(),
	value: z.number(),
	label: z.string().optional()
})
export type TimeSeriesPoint = z.infer<typeof TimeSeriesPointSchema>

export const TimeSeriesSeriesSchema = z.object({
	key: z.string(),
	label: z.string().optional(),
	points: z.array(TimeSeriesPointSchema),
	chartType: z.enum(['line', 'bar']).optional(),
	axis: z.enum(['left', 'right']).optional(),
	meta: z.record(z.string(), z.unknown()).optional()
})
type TimeSeriesSeriesSchemaType = z.infer<typeof TimeSeriesSeriesSchema>
export type TimeSeriesSeries<
	SeriesKey extends string = string,
	SeriesMeta = Record<string, unknown> | undefined
> = Omit<TimeSeriesSeriesSchemaType, 'key' | 'meta'> & {
	key: SeriesKey
	meta?: SeriesMeta
}

export const TimeSeriesOutputSchema = z.object({
	kind: z.literal('timeseries'),
	granularity: TimeGranularitySchema,
	series: z.array(TimeSeriesSeriesSchema)
})
type TimeSeriesOutputSchemaType = z.infer<typeof TimeSeriesOutputSchema>
export type TimeSeriesOutput<
	SeriesKey extends string = string,
	SeriesMeta = Record<string, unknown> | undefined
> = Omit<TimeSeriesOutputSchemaType, 'series'> & {
	series: Array<TimeSeriesSeries<SeriesKey, SeriesMeta>>
}

type TimeSeriesSeriesInput<SeriesMeta = Record<string, unknown> | undefined> =
	Omit<TimeSeriesSeries<string, SeriesMeta>, 'key'> & {
		key: string
	}

type TimeSeriesSeriesMapValue<
	SeriesMeta = Record<string, unknown> | undefined
> = Omit<TimeSeriesSeries<string, SeriesMeta>, 'key'>
type TimeSeriesSeriesMap<SeriesMeta = Record<string, unknown> | undefined> =
	Record<string, TimeSeriesSeriesMapValue<SeriesMeta>>

type NormalizeSeriesMeta<SeriesMeta> = unknown extends SeriesMeta
	? Record<string, unknown> | undefined
	: SeriesMeta

type TimeSeriesSeriesMetaFromArray<
	Series extends readonly TimeSeriesSeriesInput[]
> =
	Series[number] extends TimeSeriesSeriesInput<infer SeriesMeta>
		? NormalizeSeriesMeta<SeriesMeta>
		: Record<string, unknown> | undefined

type TimeSeriesSeriesMetaFromMap<SeriesMap extends TimeSeriesSeriesMap> =
	SeriesMap[keyof SeriesMap] extends { meta?: infer SeriesMeta }
		? NormalizeSeriesMeta<SeriesMeta>
		: Record<string, unknown> | undefined

export function defineTimeSeriesOutput<
	const Series extends readonly TimeSeriesSeriesInput[]
>(
	output: Omit<
		TimeSeriesOutput<
			Series[number]['key'],
			TimeSeriesSeriesMetaFromArray<Series>
		>,
		'kind' | 'series'
	> & {
		kind?: 'timeseries'
		series: Series
	}
): TimeSeriesOutput<
	Series[number]['key'],
	TimeSeriesSeriesMetaFromArray<Series>
>
export function defineTimeSeriesOutput<
	const SeriesMap extends TimeSeriesSeriesMap
>(
	output: Omit<
		TimeSeriesOutput<
			Extract<keyof SeriesMap, string>,
			TimeSeriesSeriesMetaFromMap<SeriesMap>
		>,
		'kind' | 'series'
	> & {
		kind?: 'timeseries'
		series: SeriesMap
	}
): TimeSeriesOutput<
	Extract<keyof SeriesMap, string>,
	TimeSeriesSeriesMetaFromMap<SeriesMap>
>
export function defineTimeSeriesOutput(
	output: TimeSeriesMetricOutputInput
): TimeSeriesOutput<string>
export function defineTimeSeriesOutput(
	output: TimeSeriesMetricOutputInput
): TimeSeriesOutput<string> {
	if (Array.isArray(output.series)) {
		return {
			kind: 'timeseries',
			...output,
			series: [...output.series]
		}
	}

	return {
		kind: 'timeseries',
		...output,
		series: Object.entries(output.series).map(([key, series]) => ({
			key,
			...series
		}))
	}
}

// ============================================================================
// Distribution Output
// ============================================================================

export const DistributionSegmentSchema = z.object({
	key: z.string(),
	label: z.string(),
	value: z.number(),
	percent: z.number().optional()
})
type DistributionSegmentSchemaType = z.infer<typeof DistributionSegmentSchema>
export type DistributionSegment<Key extends string = string> = Omit<
	DistributionSegmentSchemaType,
	'key'
> & { key: Key }

export const DistributionChartTypeSchema = z.enum([
	'bar',
	'donut',
	'pie',
	'funnel'
])
export type DistributionChartType = z.infer<typeof DistributionChartTypeSchema>

export const DistributionOutputSchema = z.object({
	kind: z.literal('distribution'),
	total: z.number(),
	segments: z.array(DistributionSegmentSchema),
	chartType: DistributionChartTypeSchema.optional()
})
type DistributionOutputSchemaType = z.infer<typeof DistributionOutputSchema>
export type DistributionOutput<Key extends string = string> = Omit<
	DistributionOutputSchemaType,
	'segments'
> & { segments: Array<DistributionSegment<Key>> }

type DistributionSegmentInput = Omit<DistributionSegment<string>, 'key'> & {
	key: string
}

export function defineDistributionOutput<
	const Segments extends readonly DistributionSegmentInput[]
>(
	output: Omit<
		DistributionOutput<Segments[number]['key']>,
		'kind' | 'segments'
	> & {
		kind?: 'distribution'
		segments: Segments
		chartType?: DistributionChartType
	}
): DistributionOutput<Segments[number]['key']> {
	return {
		kind: 'distribution',
		...output,
		segments: [...output.segments]
	}
}

// ============================================================================
// Table Output
// ============================================================================

export const TableColumnSchema = z.object({
	key: z.string(),
	label: z.string(),
	type: z.enum(['string', 'number', 'date', 'boolean']).optional(),
	nullable: z.boolean().optional()
})
type TableColumnSchemaType = z.infer<typeof TableColumnSchema>
export type TableColumn<Key extends string = string> = Omit<
	TableColumnSchemaType,
	'key'
> & { key: Key }

export const TableOutputSchema = z.object({
	kind: z.literal('table'),
	columns: z.array(TableColumnSchema),
	rows: z.array(z.record(z.string(), z.unknown())),
	total: z.number().optional()
})
type TableOutputSchemaType = z.infer<typeof TableOutputSchema>
export type TableOutput<
	Row = Record<string, unknown>,
	ColumnKey extends string = string
> = Omit<TableOutputSchemaType, 'columns' | 'rows'> & {
	columns: Array<TableColumn<ColumnKey>>
	rows: Array<Row>
}

type TableColumnInput = Omit<TableColumn<string>, 'key'> & { key: string }
type TableRowInput = Record<string, unknown>
type TableColumnValueTypeBase<Column> = Column extends { type: 'string' }
	? string
	: Column extends { type: 'number' }
		? number
		: Column extends { type: 'boolean' }
			? boolean
			: Column extends { type: 'date' }
				? Date
				: unknown
type TableColumnValueType<Column> = Column extends { nullable: true }
	? TableColumnValueTypeBase<Column> | null
	: TableColumnValueTypeBase<Column>

type TableRowFromColumns<Columns extends readonly TableColumnInput[]> = {
	[Column in Columns[number] as Column['key']]: TableColumnValueType<Column>
} & Record<string, unknown>

export function defineTableOutput<
	const Columns extends readonly TableColumnInput[],
	const Rows extends readonly TableRowFromColumns<Columns>[]
>(
	output: Omit<
		TableOutput<Rows[number], Columns[number]['key']>,
		'kind' | 'columns' | 'rows'
	> & {
		kind?: 'table'
		columns: Columns
		rows: Rows
	}
): TableOutput<Rows[number], Columns[number]['key']> {
	return {
		kind: 'table',
		...output,
		columns: [...output.columns],
		rows: [...output.rows]
	}
}

// ============================================================================
// Pivot Output
// ============================================================================

export const PivotDimensionSchema = z.object({
	key: z.string(),
	label: z.string()
})
export type PivotDimension = z.infer<typeof PivotDimensionSchema>

export const PivotTotalsSchema = z.object({
	rowTotals: z.array(z.number()).optional(),
	columnTotals: z.array(z.number()).optional(),
	grandTotal: z.number().optional()
})
export type PivotTotals = z.infer<typeof PivotTotalsSchema>

function addGrandTotalMismatchIssue(
	ctx: z.RefinementCtx,
	totalsName: 'rowTotals' | 'columnTotals',
	totals: PivotTotals['rowTotals'] | PivotTotals['columnTotals'],
	grandTotal: number
): void {
	const totalsSum = totals?.reduce((total, value) => total + value, 0)
	if (totalsSum === undefined) return
	if (Math.abs(totalsSum - grandTotal) <= Number.EPSILON) return

	ctx.addIssue({
		code: z.ZodIssueCode.custom,
		path: ['totals', 'grandTotal'],
		message: `grandTotal must equal the sum of ${totalsName}`
	})
}

function clonePivotTotals(
	totals: PivotTotals | undefined
): PivotTotals | undefined {
	if (!totals) return undefined

	return {
		rowTotals: totals.rowTotals ? [...totals.rowTotals] : undefined,
		columnTotals: totals.columnTotals ? [...totals.columnTotals] : undefined,
		grandTotal: totals.grandTotal
	}
}

function clonePivotCellTooltips(
	cellTooltips: string[][] | undefined
): string[][] | undefined {
	if (!cellTooltips) return undefined
	return cellTooltips.map((row) => [...row])
}

export const PivotOutputSchema = z
	.object({
		kind: z.literal('pivot'),
		rowDimension: PivotDimensionSchema,
		columnDimension: PivotDimensionSchema,
		rows: z.array(z.string()),
		columns: z.array(z.string()),
		values: z.array(z.array(z.number())),
		cellTooltips: z.array(z.array(z.string())).optional(),
		totals: PivotTotalsSchema.optional()
	})
	.superRefine((pivot, ctx) => {
		const rowCount = pivot.rows.length
		const columnCount = pivot.columns.length

		if (pivot.values.length !== rowCount) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['values'],
				message: `Pivot values must have ${rowCount} rows`
			})
		}

		for (const [rowIndex, row] of pivot.values.entries()) {
			if (row.length !== columnCount) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['values', rowIndex],
					message: `Pivot row ${rowIndex} must have ${columnCount} columns`
				})
			}
		}

		if (pivot.cellTooltips !== undefined) {
			if (pivot.cellTooltips.length !== rowCount) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['cellTooltips'],
					message: `cellTooltips must have ${rowCount} rows`
				})
			}
			for (const [rowIndex, row] of pivot.cellTooltips.entries()) {
				if (row.length !== columnCount) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ['cellTooltips', rowIndex],
						message: `cellTooltips row ${rowIndex} must have ${columnCount} columns`
					})
				}
			}
		}

		if (pivot.totals?.rowTotals && pivot.totals.rowTotals.length !== rowCount) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['totals', 'rowTotals'],
				message: `rowTotals must have ${rowCount} entries`
			})
		}

		if (
			pivot.totals?.columnTotals &&
			pivot.totals.columnTotals.length !== columnCount
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['totals', 'columnTotals'],
				message: `columnTotals must have ${columnCount} entries`
			})
		}

		if (pivot.totals?.grandTotal !== undefined) {
			addGrandTotalMismatchIssue(
				ctx,
				'rowTotals',
				pivot.totals.rowTotals,
				pivot.totals.grandTotal
			)
			addGrandTotalMismatchIssue(
				ctx,
				'columnTotals',
				pivot.totals.columnTotals,
				pivot.totals.grandTotal
			)
		}
	})
export type PivotOutput = z.infer<typeof PivotOutputSchema>

export function definePivotOutput(
	output: Omit<PivotOutput, 'kind'> & { kind?: 'pivot' }
): PivotOutput {
	return {
		kind: 'pivot',
		...output,
		rows: [...output.rows],
		columns: [...output.columns],
		values: output.values.map((row) => [...row]),
		cellTooltips: clonePivotCellTooltips(output.cellTooltips),
		totals: clonePivotTotals(output.totals)
	}
}

// ============================================================================
// Leaderboard Output
// ============================================================================

export const LeaderboardItemSchema = z.object({
	rank: z.number(),
	id: z.string(),
	label: z.string(),
	value: z.number(),
	meta: z.record(z.string(), z.unknown()).optional()
})
type LeaderboardItemSchemaType = z.infer<typeof LeaderboardItemSchema>
export type LeaderboardItem<Meta = Record<string, unknown> | undefined> = Omit<
	LeaderboardItemSchemaType,
	'meta'
> & { meta?: Meta }

export const LeaderboardOutputSchema = z.object({
	kind: z.literal('leaderboard'),
	items: z.array(LeaderboardItemSchema),
	total: z.number().optional()
})
type LeaderboardOutputSchemaType = z.infer<typeof LeaderboardOutputSchema>
export type LeaderboardOutput<Meta = Record<string, unknown> | undefined> =
	Omit<LeaderboardOutputSchemaType, 'items'> & {
		items: Array<LeaderboardItem<Meta>>
	}

type LeaderboardItemInput<Meta = Record<string, unknown> | undefined> = Omit<
	LeaderboardItem<Meta>,
	'meta'
> & {
	meta?: Meta
}

type LeaderboardMetaFromItems<Items extends readonly LeaderboardItemInput[]> =
	Items[number] extends LeaderboardItemInput<infer Meta> ? Meta : undefined

export function defineLeaderboardOutput<
	const Items extends readonly LeaderboardItemInput[]
>(
	output: Omit<
		LeaderboardOutput<LeaderboardMetaFromItems<Items>>,
		'kind' | 'items'
	> & {
		kind?: 'leaderboard'
		items: Items
	}
): LeaderboardOutput<LeaderboardMetaFromItems<Items>> {
	return {
		kind: 'leaderboard',
		...output,
		items: [...output.items] as Array<
			LeaderboardItem<LeaderboardMetaFromItems<Items>>
		>
	}
}

// ============================================================================
// Metric Output Helpers
// ============================================================================

export interface OutputKindMap {
	kpi: KpiOutput
	timeseries: TimeSeriesOutput
	distribution: DistributionOutput
	table: TableOutput
	leaderboard: LeaderboardOutput
	pivot: PivotOutput
}

export type OutputForKind<K extends OutputKind> = OutputKindMap[K]

type KpiMetricOutputInput = Omit<KpiOutput, 'kind'> & { kind?: 'kpi' }
type TimeSeriesMetricOutputArrayInput = Omit<
	TimeSeriesOutput<string>,
	'kind' | 'series'
> & {
	kind?: 'timeseries'
	series: ReadonlyArray<TimeSeriesSeriesInput>
}
type TimeSeriesMetricOutputMapInput = Omit<
	TimeSeriesOutput<string>,
	'kind' | 'series'
> & {
	kind?: 'timeseries'
	series: TimeSeriesSeriesMap
}
type TimeSeriesMetricOutputInput =
	| TimeSeriesMetricOutputArrayInput
	| TimeSeriesMetricOutputMapInput
type DistributionMetricOutputInput = Omit<
	DistributionOutput<string>,
	'kind' | 'segments'
> & {
	kind?: 'distribution'
	segments: readonly DistributionSegmentInput[]
	chartType?: DistributionChartType
}
type TableMetricOutputInput = Omit<
	TableOutput<Record<string, unknown>, string>,
	'kind' | 'columns' | 'rows'
> & {
	kind?: 'table'
	columns: readonly TableColumnInput[]
	rows: readonly TableRowInput[]
}
type LeaderboardMetricOutputInput = Omit<
	LeaderboardOutput<Record<string, unknown> | undefined>,
	'kind' | 'items'
> & {
	kind?: 'leaderboard'
	items: readonly LeaderboardItemInput[]
}
type PivotMetricOutputInput = Omit<PivotOutput, 'kind'> & {
	kind?: 'pivot'
}

interface MetricOutputInputByKind {
	kpi: KpiMetricOutputInput
	timeseries: TimeSeriesMetricOutputInput
	distribution: DistributionMetricOutputInput
	table: TableMetricOutputInput
	leaderboard: LeaderboardMetricOutputInput
	pivot: PivotMetricOutputInput
}

type MetricOutputInput<K extends OutputKind> = MetricOutputInputByKind[K]

export function defineMetricOutput<K extends OutputKind>(
	kind: K,
	output: MetricOutputInput<K>
): OutputForKind<K> {
	const handlers: Record<OutputKind, () => MetricOutput> = {
		kpi: () => defineKpiOutput(output as MetricOutputInput<'kpi'>),
		timeseries: () =>
			defineTimeSeriesOutput(output as MetricOutputInput<'timeseries'>),
		distribution: () =>
			defineDistributionOutput(output as MetricOutputInput<'distribution'>),
		table: () => defineTableOutput(output as MetricOutputInput<'table'>),
		leaderboard: () =>
			defineLeaderboardOutput(output as MetricOutputInput<'leaderboard'>),
		pivot: () => definePivotOutput(output as MetricOutputInput<'pivot'>)
	}
	return handlers[kind]() as OutputForKind<K>
}

export function validateOutput<K extends OutputKind>(
	kind: K,
	output: unknown
): OutputForKind<K> {
	return OutputSchemaMap[kind].parse(output) as OutputForKind<K>
}

// ============================================================================
// Union Output (discriminated by kind)
// ============================================================================

export const MetricOutputSchema = z.discriminatedUnion('kind', [
	KpiOutputSchema,
	TimeSeriesOutputSchema,
	DistributionOutputSchema,
	TableOutputSchema,
	LeaderboardOutputSchema,
	PivotOutputSchema
])
export type MetricOutput = z.infer<typeof MetricOutputSchema>

// ============================================================================
// Output Schema Map (kind -> schema)
// ============================================================================

export const OutputSchemaMap = {
	kpi: KpiOutputSchema,
	timeseries: TimeSeriesOutputSchema,
	distribution: DistributionOutputSchema,
	table: TableOutputSchema,
	leaderboard: LeaderboardOutputSchema,
	pivot: PivotOutputSchema
} as const satisfies {
	[K in OutputKind]: z.ZodType<OutputForKind<K>>
}

export type OutputSchemaForKind<K extends OutputKind> =
	(typeof OutputSchemaMap)[K]

// ============================================================================
// Wrapped Output (with optional previous period)
// ============================================================================

export const MetricExecutionCacheStatusSchema = z.enum([
	'hit',
	'partialHit',
	'miss',
	'bypassed'
])
export type MetricExecutionCacheStatus = z.infer<
	typeof MetricExecutionCacheStatusSchema
>

export const MetricExecutionSchema = z.object({
	cacheStatus: MetricExecutionCacheStatusSchema,
	durationMs: z.number().nonnegative(),
	granularity: TimeGranularitySchema.optional()
})
export type MetricExecution = z.infer<typeof MetricExecutionSchema>

export const MetricResultSchema = z.object({
	current: MetricOutputSchema,
	previous: MetricOutputSchema.optional(),
	supportsTimeRange: z.boolean(),
	execution: MetricExecutionSchema.optional()
})
export interface MetricResult<TOutput = unknown> {
	current: TOutput
	previous: TOutput | undefined
	supportsTimeRange: boolean
	execution?: MetricExecution
}
