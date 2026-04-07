export interface TimeRangeWhere {
	gte?: Date
	lte?: Date
}

export function buildTimeRangeWhere(filters: {
	from?: Date
	to?: Date
}): TimeRangeWhere | undefined {
	if (!filters.from && !filters.to) {
		return undefined
	}

	return {
		...(filters.from ? { gte: filters.from } : {}),
		...(filters.to ? { lte: filters.to } : {})
	}
}

export function buildTimeRangeWhereObject<T extends string>(
	columnName: T,
	filters: { from?: Date; to?: Date }
): { [K in T]?: TimeRangeWhere } {
	const timeRange = buildTimeRangeWhere(filters)
	if (!timeRange) {
		return {} as { [K in T]?: TimeRangeWhere }
	}

	return { [columnName]: timeRange } as { [K in T]?: TimeRangeWhere }
}

export function buildScopedTimeWhere<TIdColumn extends string>(
	idColumn: TIdColumn,
	timeColumn: string,
	filters: {
		scopeIds?: string[]
		scopeId?: string
		from?: Date
		to?: Date
	}
): Record<string, unknown> {
	const idWhere = filters.scopeIds?.length
		? { [idColumn]: { in: filters.scopeIds } }
		: filters.scopeId
			? { [idColumn]: filters.scopeId }
			: {}

	return {
		...idWhere,
		...buildTimeRangeWhereObject(timeColumn, filters)
	}
}
