import { z } from 'zod'

export const MetricTypeSchema = z.enum(['TOTAL', 'AVG', 'PER_BUCKET'])
export type MetricType = z.infer<typeof MetricTypeSchema>
