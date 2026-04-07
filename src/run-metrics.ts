declare const console: {
	error: (...args: unknown[]) => void
}
import type { AnyMetricDefinition } from './define-metric.ts'
import { getOutputSchema } from './define-metric.ts'
import type { CacheAdapter } from './cache.ts'
import { noopCacheAdapter, parseCache } from './cache.ts'
import { getCacheKey } from './cache-utils.ts'
import { getPreviousPeriod, inferGranularity } from './time.ts'
import type {
	MetricResult,
	TimeSeriesOutput,
	TimeGranularity,
	BaseFilters
} from './schemas/index.ts'
import type {
	AnyRegistry,
	InferAvailableMetricKey,
	InferRegistryMetrics,
	MetricRequestFor,
	MetricResultChunkFor,
	MetricsExecutionResult,
	MetricsRequestFor
} from './registry.ts'

// ============================================================================
// Helpers
// ============================================================================

function shiftTimeSeriesTimestamps(
	output: Awaited<ReturnType<AnyMetricDefinition['resolve']>>,
	offsetMs: number
): Awaited<ReturnType<AnyMetricDefinition['resolve']>> {
	if (
		!output ||
		typeof output !== 'object' ||
		!('kind' in output) ||
		(output as { kind?: string }).kind !== 'timeseries'
	) {
		return output
	}

	const timeseriesOutput = output as TimeSeriesOutput
	return {
		...timeseriesOutput,
		series: timeseriesOutput.series.map((s) => ({
			...s,
			points: s.points.map((p) => ({
				...p,
				ts: new Date(p.ts.getTime() + offsetMs)
			}))
		}))
	} as Awaited<ReturnType<AnyMetricDefinition['resolve']>>
}

// ============================================================================
// Types
// ============================================================================

export type MetricsRequest<R extends AnyRegistry = AnyRegistry> =
	MetricsRequestFor<R>

export type MetricsResult<
	R extends AnyRegistry = AnyRegistry,
	TMetricRequests extends
		readonly MetricRequestFor<R>[] = readonly MetricRequestFor<R>[]
> = MetricsExecutionResult<R, TMetricRequests>

export type MetricResultChunk<
	R extends AnyRegistry = AnyRegistry,
	TMetricRequests extends
		readonly MetricRequestFor<R>[] = readonly MetricRequestFor<R>[]
> = MetricResultChunkFor<R, TMetricRequests>

export interface RunMetricsOptions<
	TContext = unknown,
	R extends AnyRegistry = AnyRegistry,
	TRequest extends MetricsRequest<R> = MetricsRequest<R>
> {
	registry: R
	request: TRequest
	createContext: () => TContext | Promise<TContext>
	cache?: CacheAdapter
	hasAccess?: (metric: InferRegistryMetrics<R>[number]) => boolean
}

interface MetricRunContext<TContext = unknown> {
	metric: AnyMetricDefinition
	filters: BaseFilters
	granularity: TimeGranularity | undefined
	compareToPrevious: boolean
	resolverCtx: TContext & { granularity?: TimeGranularity }
}

interface ValidatedMetric {
	metric: AnyMetricDefinition
	filters: BaseFilters
	requestKey: string
}

interface PreparedMetrics<TContext = unknown> {
	validMetrics: ValidatedMetric[]
	errors: Record<string, string>
	cacheMap: Map<string, Awaited<ReturnType<AnyMetricDefinition['resolve']>>>
	granularity: TimeGranularity | undefined
	resolverCtx: TContext & { granularity?: TimeGranularity }
	compareToPrevious: boolean
	disableCache: boolean
	cache: CacheAdapter
}

// ============================================================================
// Single Metric Execution
// ============================================================================

async function runSingleMetric<TContext>(
	ctx: MetricRunContext<TContext>
): Promise<MetricResult<Awaited<ReturnType<AnyMetricDefinition['resolve']>>>> {
	const { metric, filters, granularity, compareToPrevious, resolverCtx } = ctx

	const current = await metric.resolve({
		filters: metric.filterSchema.parse(filters),
		ctx: { ...resolverCtx, granularity }
	})

	let previous: Awaited<ReturnType<AnyMetricDefinition['resolve']>> | undefined
	if (
		compareToPrevious &&
		metric.supportsTimeRange &&
		filters.from &&
		filters.to
	) {
		const prevRange = getPreviousPeriod({ from: filters.from, to: filters.to })
		if (prevRange) {
			const prevFilters = {
				...filters,
				from: prevRange.from,
				to: prevRange.to
			}
			const prevResult = await metric.resolve({
				filters: metric.filterSchema.parse(prevFilters),
				ctx: { ...resolverCtx, granularity }
			})

			const periodOffset = filters.from.getTime() - prevRange.from!.getTime()
			previous = shiftTimeSeriesTimestamps(prevResult, periodOffset)
		}
	}

	return { current, previous, supportsTimeRange: metric.supportsTimeRange }
}

// ============================================================================
// Shared Preparation Logic
// ============================================================================

async function prepareMetrics<
	TContext,
	R extends AnyRegistry,
	TRequest extends MetricsRequest<R>
>(
	options: RunMetricsOptions<TContext, R, TRequest>
): Promise<PreparedMetrics<TContext>> {
	const {
		registry,
		createContext,
		cache = noopCacheAdapter,
		hasAccess
	} = options
	const request = registry.MetricsRequestSchema.parse(
		options.request
	) as unknown as MetricsRequest<R>
	const disableCache = request.disableCache ?? false

	const userCtx = await createContext()
	const granularity =
		request.granularity ??
		inferGranularity({ from: request.from, to: request.to })

	const resolverCtx = { ...userCtx, granularity } as TContext & {
		granularity?: TimeGranularity
	}

	const cacheRequests: Array<{
		key: string
		metric: AnyMetricDefinition
		filters: BaseFilters
	}> = []

	const validMetrics: ValidatedMetric[] = []
	const errors: Record<string, string> = {}

	for (const metricReq of request.metrics) {
		const metric = registry.getMetricByKey(metricReq.key)
		const requestKey = metricReq.requestKey ?? metricReq.key
		if (!metric) {
			errors[requestKey] = `Unknown metric: ${metricReq.key}`
			continue
		}

		if (hasAccess && !hasAccess(metric)) {
			errors[requestKey] = 'Access denied'
			continue
		}

		let parsedMetricFilters: BaseFilters
		try {
			const parsedMetricRequest = registry.parseMetricRequestInput(metricReq, {
				from: request.from,
				to: request.to
			})

			parsedMetricFilters = parsedMetricRequest.filters as BaseFilters
			validMetrics.push({
				metric: parsedMetricRequest.metric,
				filters: parsedMetricFilters,
				requestKey: parsedMetricRequest.requestKey
			})
		} catch (err) {
			errors[requestKey] =
				err instanceof Error ? err.message : 'Invalid metric filters'
			continue
		}
		const filters = parsedMetricFilters

		const ttl = metric.cacheTtl ?? 600
		if (!disableCache && ttl > 0) {
			cacheRequests.push({
				key: getCacheKey(metric.key, filters, 'current', granularity),
				metric,
				filters
			})

			if (request.compareToPrevious && metric.supportsTimeRange) {
				const prevRange = getPreviousPeriod({
					from: filters.from,
					to: filters.to
				})
				if (prevRange) {
					cacheRequests.push({
						key: getCacheKey(
							metric.key,
							{ ...filters, ...prevRange },
							'previous',
							granularity
						),
						metric,
						filters: { ...filters, ...prevRange }
					})
				}
			}
		}
	}

	const cacheKeys = cacheRequests.map((r) => r.key)
	const cachedValues = cacheKeys.length > 0 ? await cache.mget(cacheKeys) : []

	const cacheMap = new Map<
		string,
		Awaited<ReturnType<AnyMetricDefinition['resolve']>>
	>()
	for (let i = 0; i < cacheRequests.length; i++) {
		const req = cacheRequests[i]
		const cached = cachedValues[i]
		if (req && cached) {
			const parsed = parseCache<
				Awaited<ReturnType<AnyMetricDefinition['resolve']>>
			>(cached, getOutputSchema(req.metric))
			if (parsed) {
				cacheMap.set(req.key, parsed)
			}
		}
	}

	return {
		validMetrics,
		errors,
		cacheMap,
		granularity,
		resolverCtx,
		compareToPrevious: request.compareToPrevious ?? false,
		disableCache,
		cache
	}
}

// ============================================================================
// Execute Single Metric (with caching)
// ============================================================================

async function executeMetric<TContext>(
	validatedMetric: ValidatedMetric,
	prepared: PreparedMetrics<TContext>
): Promise<{
	key: string
	requestKey?: string
	result?: MetricResult
	error?: string
}> {
	const { metric, filters, requestKey } = validatedMetric
	const {
		cacheMap,
		granularity,
		resolverCtx,
		compareToPrevious,
		disableCache,
		cache
	} = prepared
	const startedAt = Date.now()

	try {
		const cachedCurrent = cacheMap.get(
			getCacheKey(metric.key, filters, 'current', granularity)
		)
		const prevRange = getPreviousPeriod({ from: filters.from, to: filters.to })
		const cachedPrevious = prevRange
			? cacheMap.get(
					getCacheKey(
						metric.key,
						{ ...filters, ...prevRange },
						'previous',
						granularity
					)
				)
			: undefined

		if (cachedCurrent) {
			let previous = cachedPrevious
			let usedLivePreviousFetch = false
			if (
				!previous &&
				compareToPrevious &&
				metric.supportsTimeRange &&
				filters.from &&
				filters.to
			) {
				usedLivePreviousFetch = true
				const partialResult = await runSingleMetric({
					metric,
					filters,
					granularity,
					compareToPrevious: true,
					resolverCtx
				})
				previous = partialResult.previous
				if (previous && prevRange) {
					const ttl = metric.cacheTtl ?? 600
					if (!disableCache && ttl > 0) {
						cache
							.mset([
								{
									key: getCacheKey(
										metric.key,
										{ ...filters, ...prevRange },
										'previous',
										granularity
									),
									value: JSON.stringify(previous),
									ttl
								}
							])
							.catch((error) => console.error(error))
					}
				}
			}
			return {
				key: metric.key,
				requestKey,
				result: {
					current: cachedCurrent,
					previous,
					supportsTimeRange: metric.supportsTimeRange,
					execution: {
						cacheStatus: usedLivePreviousFetch ? 'partialHit' : 'hit',
						durationMs: Date.now() - startedAt,
						granularity
					}
				}
			}
		}

		const result = await runSingleMetric({
			metric,
			filters,
			granularity,
			compareToPrevious,
			resolverCtx
		})

		const ttl = metric.cacheTtl ?? 600
		if (!disableCache && ttl > 0) {
			const cacheEntries: Array<{ key: string; value: string; ttl: number }> = [
				{
					key: getCacheKey(metric.key, filters, 'current', granularity),
					value: JSON.stringify(result.current),
					ttl
				}
			]

			if (result.previous) {
				const prevRange = getPreviousPeriod({
					from: filters.from,
					to: filters.to
				})
				if (prevRange) {
					cacheEntries.push({
						key: getCacheKey(
							metric.key,
							{ ...filters, ...prevRange },
							'previous',
							granularity
						),
						value: JSON.stringify(result.previous),
						ttl
					})
				}
			}

			cache.mset(cacheEntries).catch((error) => console.error(error))
		}

		return {
			key: metric.key,
			requestKey,
			result: {
				...result,
				execution: {
					cacheStatus: disableCache ? 'bypassed' : 'miss',
					durationMs: Date.now() - startedAt,
					granularity
				}
			}
		}
	} catch (err) {
		return {
			key: metric.key,
			requestKey,
			error: err instanceof Error ? err.message : 'Unknown error'
		}
	}
}

// ============================================================================
// Main Engine
// ============================================================================

export async function runMetrics<
	TContext,
	R extends AnyRegistry,
	TRequest extends MetricsRequest<R>
>(
	options: RunMetricsOptions<TContext, R, TRequest>
): Promise<MetricsResult<R, TRequest['metrics']>> {
	const prepared = await prepareMetrics(options)
	const { validMetrics, errors } = prepared

	const results: Record<string, MetricResult> = {}

	const outcomes = await Promise.all(
		validMetrics.map((vm) => executeMetric(vm, prepared))
	)

	for (const outcome of outcomes) {
		if (outcome.error) {
			errors[outcome.requestKey ?? outcome.key] = outcome.error
		} else if (outcome.result) {
			results[outcome.requestKey ?? outcome.key] = outcome.result
		}
	}

	return {
		metrics: results,
		errors
	} as MetricsResult<R, TRequest['metrics']>
}

export async function* runMetricsStream<
	TContext,
	R extends AnyRegistry,
	TRequest extends MetricsRequest<R>
>(
	options: RunMetricsOptions<TContext, R, TRequest>
): AsyncGenerator<MetricResultChunk<R, TRequest['metrics']>, void, unknown> {
	const prepared = await prepareMetrics(options)
	const { validMetrics, errors } = prepared

	const totalMetrics = validMetrics.length + Object.keys(errors).length
	let yieldedCount = 0

	for (const key of Object.keys(errors)) {
		yieldedCount++
		yield {
			key,
			requestKey: key,
			error: errors[key],
			done: yieldedCount === totalMetrics
		} as MetricResultChunk<R, TRequest['metrics']>
	}

	if (validMetrics.length === 0) {
		return
	}

	type PromiseResult = {
		key: InferAvailableMetricKey<R> | string
		requestKey?: string
		result?: MetricResult
		error?: string
	}
	const pending = new Map<Promise<PromiseResult>, string>()

	for (const vm of validMetrics) {
		const promise = executeMetric(vm, prepared)
		pending.set(promise, vm.requestKey)
	}

	while (pending.size > 0) {
		const settled = await Promise.race(
			Array.from(pending.keys()).map((p) =>
				p.then((result) => ({ promise: p, result }))
			)
		)

		pending.delete(settled.promise)
		yieldedCount++

		yield {
			key: settled.result.key,
			requestKey: settled.result.requestKey,
			result: settled.result.result,
			error: settled.result.error,
			done: yieldedCount === totalMetrics
		} as MetricResultChunk<R, TRequest['metrics']>
	}
}
