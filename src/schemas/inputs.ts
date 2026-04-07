import { z } from 'zod'
import { TimeRangeSchema, RequiredTimeRangeSchema } from './time.ts'

export const BaseFiltersSchema = z
	.object({
		organizationIds: z.array(z.string()).optional()
	})
	.merge(TimeRangeSchema)

export type BaseFilters = z.infer<typeof BaseFiltersSchema>

export const TimeSeriesFiltersSchema = z
	.object({
		organizationIds: z.array(z.string()).optional()
	})
	.merge(RequiredTimeRangeSchema)

export type TimeSeriesFilters = z.infer<typeof TimeSeriesFiltersSchema>

export function extendBaseFilters<T extends z.ZodRawShape>(
	shape: T
): z.ZodObject<
	typeof BaseFiltersSchema.shape & { [K in keyof T]: z.ZodOptional<T[K]> }
> {
	const optionalShape = Object.fromEntries(
		Object.entries(shape).map(([key, schema]) => [
			key,
			(schema as z.ZodTypeAny).optional()
		])
	) as unknown as { [K in keyof T]: z.ZodOptional<T[K]> }

	return BaseFiltersSchema.extend(optionalShape) as z.ZodObject<
		typeof BaseFiltersSchema.shape & { [K in keyof T]: z.ZodOptional<T[K]> }
	>
}

export function extendTimeSeriesFilters<T extends z.ZodRawShape>(
	shape: T
): z.ZodObject<
	typeof TimeSeriesFiltersSchema.shape & {
		[K in keyof T]: z.ZodOptional<T[K]>
	}
> {
	const optionalShape = Object.fromEntries(
		Object.entries(shape).map(([key, schema]) => [
			key,
			(schema as z.ZodTypeAny).optional()
		])
	) as unknown as { [K in keyof T]: z.ZodOptional<T[K]> }

	return TimeSeriesFiltersSchema.extend(optionalShape) as z.ZodObject<
		typeof TimeSeriesFiltersSchema.shape & {
			[K in keyof T]: z.ZodOptional<T[K]>
		}
	>
}
