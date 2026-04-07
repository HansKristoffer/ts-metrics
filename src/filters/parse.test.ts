import { describe, test, expect } from 'bun:test'
import { z } from 'zod'
import { parseMetricFilterSchema } from './parse.ts'

describe('parseMetricFilterSchema', () => {
	test('generates field definitions from Zod schema', () => {
		const schema = z.object({
			status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
			limit: z.number().optional()
		})

		const fields = parseMetricFilterSchema(schema)

		expect(fields).toHaveLength(2)
		expect(fields[0]).toMatchObject({
			id: 'status',
			displayName: 'Status',
			type: 'option',
			options: [
				{ label: 'Active', value: 'ACTIVE' },
				{ label: 'Inactive', value: 'INACTIVE' }
			]
		})
		expect(fields[1]).toMatchObject({
			id: 'limit',
			displayName: 'Limit',
			type: 'number'
		})
	})

	test('fieldMetadata overrides introspected values', () => {
		const schema = z.object({
			metric: z.enum(['TOTAL', 'AVG']).optional()
		})

		const fields = parseMetricFilterSchema(schema, {
			fieldMetadata: {
				metric: {
					displayName: 'Aggregation',
					description: 'How to aggregate',
					defaultOperator: 'is'
				}
			}
		})

		expect(fields).toHaveLength(1)
		expect(fields[0]).toMatchObject({
			id: 'metric',
			displayName: 'Aggregation',
			description: 'How to aggregate',
			defaultOperator: 'is'
		})
	})
})
