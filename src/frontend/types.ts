import type { AvailableMetricFor, AvailableMetricsResult } from '../orpc.ts'
import type {
	AnyRegistry,
	InferAvailableMetricKey,
	MetricOutputFor,
	MetricRequestFor,
	MetricRequestFiltersFor,
	MetricRequestResultKey
} from '../registry.ts'
import type { MetricResult } from '../schemas/output.ts'
import type { TimeGranularity } from '../schemas/time.ts'
import type { MetricsRendererRegistry } from './renderers.ts'

export type DashboardSlotId = string
export type RendererId = string

export interface WidgetLayout {
	cols?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
	rows?: number
	minHeight?: string
}

export type BarMode = 'stacked' | 'grouped'

export interface DashboardControls {
	showTimeRange?: boolean
	showGranularity?: boolean
	showCompare?: boolean
	showFilters?: boolean
	defaultFrom?: Date
	defaultTo?: Date
	defaultGranularity?: TimeGranularity
	defaultCompareToPrevious?: boolean
	defaultDisableCache?: boolean
}

export interface MetricsFilterControlConfig<
	R extends AnyRegistry,
	K extends InferAvailableMetricKey<R>
> {
	scope?: 'dashboard' | 'widget' | 'both'
	includeFields?: Array<Extract<keyof MetricRequestFiltersFor<R, K>, string>>
}

export interface MetricsWidgetConfig<
	R extends AnyRegistry,
	K extends InferAvailableMetricKey<R> = InferAvailableMetricKey<R>,
	TRequestKey extends string | undefined = string | undefined,
	TRendererId extends string = RendererId
> {
	key: K
	requestKey?: TRequestKey
	title?: string
	description?: string
	layout?: WidgetLayout
	filters?: Partial<MetricRequestFiltersFor<R, K>>
	filterControls?: MetricsFilterControlConfig<R, K>
	rendererId?: TRendererId
	barMode?: BarMode
	showTrendLine?: boolean
}

export interface MetricsHeadlineConfig {
	_type: 'headline'
	title: string
	description?: string
}

export interface MetricsSpacerConfig {
	_type: 'spacer'
	layout?: WidgetLayout
}

export interface MetricsCustomSlotConfig<
	TSlotId extends string = DashboardSlotId
> {
	_type: 'slot'
	slotId: TSlotId
	layout?: WidgetLayout
	props?: Record<string, unknown>
}

export type DashboardItem<
	R extends AnyRegistry = AnyRegistry,
	TRendererId extends string = RendererId,
	TSlotId extends string = DashboardSlotId
> =
	| MetricsWidgetConfig<
			R,
			InferAvailableMetricKey<R>,
			string | undefined,
			TRendererId
	  >
	| MetricsHeadlineConfig
	| MetricsSpacerConfig
	| MetricsCustomSlotConfig<TSlotId>

export interface MetricsDashboardConfig<
	R extends AnyRegistry = AnyRegistry,
	TRendererId extends string = RendererId,
	TSlotId extends string = DashboardSlotId,
	Items extends readonly DashboardItem<
		R,
		TRendererId,
		TSlotId
	>[] = readonly DashboardItem<R, TRendererId, TSlotId>[]
> {
	title?: string
	description?: string
	controls?: DashboardControls
	persistKey?: string
	widgets: Items
	renderers?: MetricsRendererRegistry<R, TRendererId>
	markers?: ChartMarker[]
}

export interface WidgetState<TOutput = unknown> {
	isLoading: boolean
	result?: MetricResult<TOutput>
	error?: string
}

type DashboardWidgetItem<
	R extends AnyRegistry,
	TRendererId extends string = RendererId
> = MetricsWidgetConfig<
	R,
	InferAvailableMetricKey<R>,
	string | undefined,
	TRendererId
>

type DashboardMetricRequestFromItem<R extends AnyRegistry, TItem> =
	TItem extends MetricsWidgetConfig<
		infer K extends InferAvailableMetricKey<R>,
		infer TRequestKey extends string | undefined,
		infer _TRendererId extends string
	>
		? MetricRequestFor<R, K, TRequestKey>
		: never

type DashboardItemResultKey<R extends AnyRegistry, TItem> =
	DashboardMetricRequestFromItem<R, TItem> extends infer TMetricRequest
		? TMetricRequest extends MetricRequestFor<R>
			? MetricRequestResultKey<TMetricRequest>
			: never
		: never

type DashboardItemForResultKey<
	R extends AnyRegistry,
	Items extends readonly DashboardItem<R, string, string>[],
	TResultKey extends DashboardResultKey<R, Items>
> =
	Extract<
		Extract<Items[number], DashboardWidgetItem<R>>,
		{ requestKey: TResultKey }
	> extends never
		? Extract<
				Extract<Items[number], DashboardWidgetItem<R>>,
				{ key: TResultKey }
			>
		: Extract<
				Extract<Items[number], DashboardWidgetItem<R>>,
				{ requestKey: TResultKey }
			>

export type DashboardResultKey<
	R extends AnyRegistry,
	Items extends readonly DashboardItem<R, string, string>[]
> = DashboardItemResultKey<R, Extract<Items[number], DashboardWidgetItem<R>>>

export type DashboardState<
	R extends AnyRegistry,
	Items extends readonly DashboardItem<R, string, string>[]
> = {
	[TResultKey in DashboardResultKey<R, Items>]?: WidgetState<
		DashboardItemForResultKey<R, Items, TResultKey> extends {
			key: infer TMetricKey extends InferAvailableMetricKey<R>
		}
			? MetricOutputFor<R, TMetricKey>
			: never
	>
}

export interface ChartMarker {
	id: string
	timestamp: Date
	type: string
	label: string
	title: string
	description?: string
	severity?: 'info' | 'success' | 'warning' | 'danger'
	icon?: string
	meta?: Record<string, unknown>
}

export interface MarkerCategory {
	type: string
	label: string
	count: number
	enabled: boolean
}

export interface FrontendCatalogState<R extends AnyRegistry = AnyRegistry> {
	metrics: AvailableMetricFor<R>[]
	total: AvailableMetricsResult<R>['total']
}
