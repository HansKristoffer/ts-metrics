import type { TimeGranularity } from '../schemas/index.ts'
import {
	definePivotOutput,
	type PivotOutput,
	type PivotTotals
} from '../schemas/index.ts'

export function createPivotMatrix(
	rowCount: number,
	columnCount: number
): number[][] {
	return Array.from({ length: rowCount }, () =>
		Array.from({ length: columnCount }, () => 0)
	)
}

export function addPivotCell(
	values: number[][],
	rowIndex: number,
	columnIndex: number,
	delta: number
): void {
	const row = values[rowIndex]
	if (!row) return
	if (columnIndex < 0 || columnIndex >= row.length) return
	row[columnIndex] = (row[columnIndex] ?? 0) + delta
}

export function computePivotTotals(values: number[][]): PivotTotals {
	const rowTotals = values.map((row) =>
		row.reduce((acc, value) => acc + value, 0)
	)
	const columnCount = values[0]?.length ?? 0
	const columnTotals = Array.from({ length: columnCount }, (_, columnIndex) =>
		values.reduce((acc, row) => acc + (row[columnIndex] ?? 0), 0)
	)
	const grandTotal = rowTotals.reduce((acc, value) => acc + value, 0)

	return {
		rowTotals,
		columnTotals,
		grandTotal
	}
}

export function formatPivotBucketLabel(
	bucket: Date,
	granularity: TimeGranularity
): string {
	const year = bucket.getUTCFullYear()
	const month = String(bucket.getUTCMonth() + 1).padStart(2, '0')
	const day = String(bucket.getUTCDate()).padStart(2, '0')
	const hour = String(bucket.getUTCHours()).padStart(2, '0')

	switch (granularity) {
		case 'hour':
			return `${year}-${month}-${day} ${hour}:00`
		case 'day':
			return `${year}-${month}-${day}`
		case 'week': {
			const { week, weekYear } = getIsoWeekAndYear(bucket)
			return `Week ${week} ${weekYear}`
		}
		case 'month':
			return `${year}-${month}`
		case 'quarter': {
			const quarter = Math.floor(bucket.getUTCMonth() / 3) + 1
			return `Q${quarter} ${year}`
		}
		case 'year':
			return `${year}`
	}
}

function getIsoWeekAndYear(date: Date): { week: number; weekYear: number } {
	const d = new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
	)
	const day = d.getUTCDay() || 7
	d.setUTCDate(d.getUTCDate() + 4 - day)
	const weekYear = d.getUTCFullYear()
	const yearStart = new Date(Date.UTC(weekYear, 0, 1))
	const week = Math.ceil(
		((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
	)

	return { week, weekYear }
}

export function buildPivotOutput(args: {
	rowDimension: PivotOutput['rowDimension']
	columnDimension: PivotOutput['columnDimension']
	rows: string[]
	columns: string[]
	values: number[][]
	cellTooltips?: string[][]
	totals?: PivotTotals
}): PivotOutput {
	return definePivotOutput({
		rowDimension: args.rowDimension,
		columnDimension: args.columnDimension,
		rows: args.rows,
		columns: args.columns,
		values: args.values,
		cellTooltips: args.cellTooltips,
		totals: args.totals ?? computePivotTotals(args.values)
	})
}
