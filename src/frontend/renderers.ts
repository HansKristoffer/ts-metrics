import type {
	AnyRegistry,
	InferAvailableMetricKey,
	InferRegistryMetrics,
	MetricKindFor
} from '../registry.ts'

export interface MetricsRendererRegistry<
	R extends AnyRegistry = AnyRegistry,
	TRendererId extends string = string
> {
	byKind?: Partial<
		Record<
			Extract<InferRegistryMetrics<R>[number]['kind'], string>,
			TRendererId
		>
	>
	byMetricKey?: Partial<Record<InferAvailableMetricKey<R>, TRendererId>>
}

export interface MetricRendererHandle<
	K extends string = string,
	TKind extends string = string,
	TRendererId extends string = string
> {
	rendererId: TRendererId | `kind:${TKind}`
	source: 'metric' | 'kind' | 'fallback'
	metricKey: K
	kind: TKind
}

export function defineRendererRegistry<
	R extends AnyRegistry,
	TRendererId extends string,
	TRegistry extends MetricsRendererRegistry<R, TRendererId>
>(registry: TRegistry): TRegistry {
	return registry
}

export function hasCustomRenderer<
	R extends AnyRegistry,
	K extends InferAvailableMetricKey<R>,
	TRendererId extends string
>(metricKey: K, registry?: MetricsRendererRegistry<R, TRendererId>): boolean {
	return Boolean(registry?.byMetricKey?.[metricKey])
}

export function resolveRendererHandle<
	R extends AnyRegistry,
	K extends InferAvailableMetricKey<R>,
	TRendererId extends string = string
>(
	metricKey: K,
	kind: MetricKindFor<R, K>,
	registry?: MetricsRendererRegistry<R, TRendererId>
): MetricRendererHandle<K, MetricKindFor<R, K>, TRendererId> {
	const byMetricKey = registry?.byMetricKey?.[metricKey]
	if (byMetricKey) {
		return {
			rendererId: byMetricKey,
			source: 'metric',
			metricKey,
			kind
		}
	}

	const byKind =
		registry?.byKind?.[kind as Extract<MetricKindFor<R, K>, string>]
	if (byKind) {
		return {
			rendererId: byKind,
			source: 'kind',
			metricKey,
			kind
		}
	}

	return {
		rendererId: `kind:${kind}`,
		source: 'fallback',
		metricKey,
		kind
	}
}
