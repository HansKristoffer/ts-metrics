import { describe, test, expect } from 'bun:test'
import {
	resolveMetricType,
	calculateMetricModeValue,
	getMetricModeLabel,
	getBucketCountForMetricMode
} from './metric-type.ts'

describe('resolveMetricType', () => {
	test('returns provided metric type', () => {
		expect(resolveMetricType('AVG', 'TOTAL')).toBe('AVG')
	})

	test('returns default when undefined', () => {
		expect(resolveMetricType(undefined, 'TOTAL')).toBe('TOTAL')
	})
})

describe('calculateMetricModeValue', () => {
	test('TOTAL returns total', () => {
		const result = calculateMetricModeValue({
			total: 100,
			averageDivisor: 10,
			metric: 'TOTAL',
			defaultMetric: 'TOTAL'
		})
		expect(result).toBe(100)
	})

	test('AVG returns average', () => {
		const result = calculateMetricModeValue({
			total: 100,
			averageDivisor: 10,
			metric: 'AVG',
			defaultMetric: 'TOTAL'
		})
		expect(result).toBe(10)
	})

	test('PER_BUCKET returns per-bucket value', () => {
		const result = calculateMetricModeValue({
			total: 100,
			averageDivisor: 10,
			metric: 'PER_BUCKET',
			defaultMetric: 'TOTAL',
			bucketCount: 5
		})
		expect(result).toBe(20)
	})

	test('applies postProcess', () => {
		const result = calculateMetricModeValue({
			total: 100,
			averageDivisor: 10,
			metric: 'TOTAL',
			defaultMetric: 'TOTAL',
			postProcess: (v) => Math.round(v * 100) / 100
		})
		expect(result).toBe(100)
	})
})

describe('getMetricModeLabel', () => {
	test('returns correct label for metric type', () => {
		const labels = { TOTAL: 'Total', AVG: 'Average', PER_BUCKET: 'Per Bucket' }
		expect(
			getMetricModeLabel({ metric: 'AVG', defaultMetric: 'TOTAL', labels })
		).toBe('Average')
	})
})

describe('getBucketCountForMetricMode', () => {
	test('returns undefined for non-PER_BUCKET modes', () => {
		const result = getBucketCountForMetricMode({
			metric: 'TOTAL',
			defaultMetric: 'TOTAL',
			from: new Date('2024-01-01'),
			to: new Date('2024-01-15')
		})
		expect(result).toBeUndefined()
	})

	test('returns bucket count for PER_BUCKET mode', () => {
		const result = getBucketCountForMetricMode({
			metric: 'PER_BUCKET',
			defaultMetric: 'TOTAL',
			from: new Date('2024-01-01'),
			to: new Date('2024-01-15')
		})
		expect(result).toBeGreaterThan(0)
	})
})
