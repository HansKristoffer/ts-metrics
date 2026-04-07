export type FilterFieldType =
	| 'text'
	| 'number'
	| 'numberRange'
	| 'boolean'
	| 'date'
	| 'option'
	| 'multiOption'

export type FilterFieldOption = {
	label: string
	value: string
}

export type FilterOperator =
	| 'contains'
	| 'does not contain'
	| 'equals'
	| 'not equals'
	| 'greater than'
	| 'greater than or equal'
	| 'less than'
	| 'less than or equal'
	| 'between'
	| 'in range'
	| 'is true'
	| 'is false'
	| 'is'
	| 'is not'
	| 'is before'
	| 'is after'
	| 'is on or before'
	| 'is on or after'
	| 'is any of'
	| 'is none of'
	| 'includes'
	| 'excludes'
	| 'includes any of'
	| 'includes all of'
	| 'excludes any of'

export interface MetricFilterFieldMetadata {
	displayName?: string
	description?: string
	type?: FilterFieldType
	options?: FilterFieldOption[]
	defaultOperator?: FilterOperator
}

export interface FilterFieldDefinition extends MetricFilterFieldMetadata {
	id: string
	displayName: string
	type: FilterFieldType
}

export function defineMetricFilterFieldMetadata<
	T extends Record<string, MetricFilterFieldMetadata>
>(metadata: T): T {
	return metadata
}
