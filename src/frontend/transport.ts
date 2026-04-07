import type { AvailableMetricsResult } from '../orpc.ts'
import type { AnyRegistry, MetricsRequestFor } from '../registry.ts'
import type {
	MetricRequestFor,
	MetricResultChunkFor,
	MetricsExecutionResult
} from '../registry.ts'

export interface MetricsBatchTransport<R extends AnyRegistry = AnyRegistry> {
	run<TRequest extends MetricsRequestFor<R>>(
		request: TRequest
	): Promise<MetricsExecutionResult<R, TRequest['metrics']>>
}

export interface MetricsStreamTransport<R extends AnyRegistry = AnyRegistry> {
	stream<TRequest extends MetricsRequestFor<R>>(
		request: TRequest
	): AsyncIterable<MetricResultChunkFor<R, TRequest['metrics']>>
}

export interface MetricsCatalogTransport<R extends AnyRegistry = AnyRegistry> {
	getAvailableMetrics(): Promise<AvailableMetricsResult<R>>
}

export interface MetricsTransport<R extends AnyRegistry = AnyRegistry>
	extends MetricsBatchTransport<R>,
		MetricsStreamTransport<R>,
		MetricsCatalogTransport<R> {}

export interface MetricsStreamHandlers<
	R extends AnyRegistry,
	TMetricRequests extends readonly MetricRequestFor<R>[]
> {
	onChunk?: (chunk: MetricResultChunkFor<R, TMetricRequests>) => void
	onError?: (error: unknown) => void
	onComplete?: () => void
}
