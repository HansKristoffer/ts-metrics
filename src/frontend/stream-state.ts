import type {
	AnyRegistry,
	MetricRequestFor,
	MetricResultChunkFor,
	MetricsExecutionResult,
	RequestedMetricKeys
} from '../registry.ts'
import { getMetricResultKey } from '../registry.ts'

export interface MetricsStreamState<
	R extends AnyRegistry,
	TMetricRequests extends readonly MetricRequestFor<R>[]
> extends MetricsExecutionResult<R, TMetricRequests> {
	status: 'idle' | 'streaming' | 'complete'
	done: boolean
	receivedKeys: RequestedMetricKeys<R, TMetricRequests>[]
	pendingKeys: RequestedMetricKeys<R, TMetricRequests>[]
}

type StreamMetricResultChunk<
	R extends AnyRegistry,
	TMetricRequests extends readonly MetricRequestFor<R>[]
> = {
	key: string
	requestKey?: string
	result?: MetricsExecutionResult<
		R,
		TMetricRequests
	>['metrics'][RequestedMetricKeys<R, TMetricRequests>]
	error?: string
	done: boolean
}

export function getPendingMetricKeys<
	R extends AnyRegistry,
	TMetricRequests extends readonly MetricRequestFor<R>[]
>(request: {
	metrics: TMetricRequests
}): RequestedMetricKeys<R, TMetricRequests>[] {
	return request.metrics.map((metric) =>
		getMetricResultKey(metric)
	) as RequestedMetricKeys<R, TMetricRequests>[]
}

export function createMetricsStreamState<
	R extends AnyRegistry,
	TMetricRequests extends readonly MetricRequestFor<R>[]
>(request: {
	metrics: TMetricRequests
}): MetricsStreamState<R, TMetricRequests> {
	return {
		metrics: {},
		errors: {},
		status: 'idle',
		done: false,
		receivedKeys: [],
		pendingKeys: getPendingMetricKeys(request)
	}
}

export function applyMetricResultChunk<
	R extends AnyRegistry,
	TMetricRequests extends readonly MetricRequestFor<R>[]
>(
	state: MetricsStreamState<R, TMetricRequests>,
	chunk: MetricResultChunkFor<R, TMetricRequests>
): MetricsStreamState<R, TMetricRequests> {
	const streamChunk = chunk as StreamMetricResultChunk<R, TMetricRequests>
	const resultKey = getMetricResultKey(streamChunk) as RequestedMetricKeys<
		R,
		TMetricRequests
	>

	const receivedKeys = state.receivedKeys.includes(resultKey)
		? state.receivedKeys
		: [...state.receivedKeys, resultKey]

	const errors = streamChunk.error
		? ({
				...state.errors,
				[resultKey]: streamChunk.error
			} as MetricsStreamState<R, TMetricRequests>['errors'])
		: state.errors

	const metrics = streamChunk.result
		? ({
				...state.metrics,
				[resultKey]: streamChunk.result
			} as MetricsStreamState<R, TMetricRequests>['metrics'])
		: state.metrics

	const nextState: MetricsStreamState<R, TMetricRequests> = {
		...state,
		status: streamChunk.done ? 'complete' : 'streaming',
		done: streamChunk.done,
		receivedKeys,
		pendingKeys: state.pendingKeys.filter((key) => key !== resultKey),
		errors,
		metrics
	}

	return nextState
}
