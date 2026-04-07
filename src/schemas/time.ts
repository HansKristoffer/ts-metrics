import { z } from 'zod'

export const TimeGranularitySchema = z.enum([
	'hour',
	'day',
	'week',
	'month',
	'quarter',
	'year'
])
export type TimeGranularity = z.infer<typeof TimeGranularitySchema>

export const TimeRangeSchema = z.object({
	from: z.date().optional(),
	to: z.date().optional()
})
export type TimeRange = z.infer<typeof TimeRangeSchema>

export const RequiredTimeRangeSchema = z.object({
	from: z.date(),
	to: z.date()
})
export type RequiredTimeRange = z.infer<typeof RequiredTimeRangeSchema>

export const CompareSchema = z.object({
	compareToPrevious: z.boolean().optional().default(false)
})
export type Compare = z.infer<typeof CompareSchema>
