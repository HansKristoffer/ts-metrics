import type { AnyRegistry, InferAvailableMetricKey } from '../registry.ts'
import type {
	DashboardControls,
	DashboardItem,
	DashboardSlotId,
	MetricsCustomSlotConfig,
	MetricsDashboardConfig,
	MetricsHeadlineConfig,
	MetricsSpacerConfig,
	MetricsWidgetConfig,
	WidgetLayout
} from './types.ts'

export function defineMetricsDashboard<
	R extends AnyRegistry,
	TRendererId extends string = string,
	TSlotId extends string = DashboardSlotId,
	const Items extends readonly DashboardItem<
		R,
		TRendererId,
		TSlotId
	>[] = readonly DashboardItem<R, TRendererId, TSlotId>[]
>(
	config: MetricsDashboardConfig<R, TRendererId, TSlotId, Items>
): MetricsDashboardConfig<R, TRendererId, TSlotId, Items> {
	return config
}

export function defineWidget<
	R extends AnyRegistry,
	const K extends InferAvailableMetricKey<R>,
	TRequestKey extends string | undefined = string | undefined,
	TRendererId extends string = string
>(
	key: K,
	config?: Omit<MetricsWidgetConfig<R, K, TRequestKey, TRendererId>, 'key'>
): MetricsWidgetConfig<R, K, TRequestKey, TRendererId>
export function defineWidget<
	R extends AnyRegistry,
	const K extends InferAvailableMetricKey<R>,
	TRequestKey extends string | undefined = string | undefined,
	TRendererId extends string = string
>(
	config: MetricsWidgetConfig<R, K, TRequestKey, TRendererId>
): MetricsWidgetConfig<R, K, TRequestKey, TRendererId>
export function defineWidget<
	R extends AnyRegistry,
	const K extends InferAvailableMetricKey<R>,
	TRequestKey extends string | undefined = string | undefined,
	TRendererId extends string = string
>(
	keyOrConfig: K | MetricsWidgetConfig<R, K, TRequestKey, TRendererId>,
	config?: Omit<MetricsWidgetConfig<R, K, TRequestKey, TRendererId>, 'key'>
): MetricsWidgetConfig<R, K, TRequestKey, TRendererId> {
	if (typeof keyOrConfig === 'string') {
		return {
			key: keyOrConfig,
			...(config ?? {})
		} as MetricsWidgetConfig<R, K, TRequestKey, TRendererId>
	}

	return keyOrConfig
}

export function defineHeadline(
	title: string,
	description?: string
): MetricsHeadlineConfig {
	return {
		_type: 'headline',
		title,
		description
	}
}

export function defineSpacer(layout?: WidgetLayout): MetricsSpacerConfig {
	return {
		_type: 'spacer',
		layout
	}
}

export function defineCustomSlot<TSlotId extends string>(
	slotId: TSlotId,
	config?: { layout?: WidgetLayout; props?: Record<string, unknown> }
): MetricsCustomSlotConfig<TSlotId> {
	return {
		_type: 'slot',
		slotId,
		layout: config?.layout,
		props: config?.props
	}
}

export const defaultDashboardControls: DashboardControls = {
	showTimeRange: true,
	showGranularity: false,
	showCompare: true,
	defaultCompareToPrevious: false
}
