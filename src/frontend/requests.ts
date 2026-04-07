import type {
	AnyRegistry,
	InferAvailableMetricKey,
	MetricRequestFor,
	MetricResultChunkFor,
	MetricsExecutionResult,
	MetricsRequestFor,
	RequestedMetricKeys
} from '../registry.ts'
export { getMetricResultKey as getRequestedMetricKey } from '../registry.ts'

export type FrontendMetricRequest<
	R extends AnyRegistry,
	K extends InferAvailableMetricKey<R> = InferAvailableMetricKey<R>,
	TRequestKey extends string | undefined = string | undefined
> = MetricRequestFor<R, K, TRequestKey>

export type FrontendMetricsRequest<R extends AnyRegistry> = MetricsRequestFor<R>

export type FrontendMetricsResult<
	R extends AnyRegistry,
	TMetricRequests extends readonly FrontendMetricRequest<R>[]
> = MetricsExecutionResult<R, TMetricRequests>

export type FrontendMetricResultChunk<
	R extends AnyRegistry,
	TMetricRequests extends readonly FrontendMetricRequest<R>[]
> = MetricResultChunkFor<R, TMetricRequests>

export function defineMetricRequest<
	R extends AnyRegistry,
	K extends InferAvailableMetricKey<R>,
	TRequestKey extends string | undefined = string | undefined
>(
	request: FrontendMetricRequest<R, K, TRequestKey>
): FrontendMetricRequest<R, K, TRequestKey> {
	return request
}

export function defineMetricsRequest<
	R extends AnyRegistry,
	const TMetricRequests extends
		readonly FrontendMetricRequest<R>[] = readonly FrontendMetricRequest<R>[]
>(
	request: Omit<FrontendMetricsRequest<R>, 'metrics'> & {
		metrics: TMetricRequests
	}
): Omit<FrontendMetricsRequest<R>, 'metrics'> & { metrics: TMetricRequests } {
	return request
}

export function getMetricResult<
	R extends AnyRegistry,
	TMetricRequests extends readonly FrontendMetricRequest<R>[],
	K extends RequestedMetricKeys<R, TMetricRequests>
>(result: FrontendMetricsResult<R, TMetricRequests>, key: K) {
	return result.metrics[key]
}
