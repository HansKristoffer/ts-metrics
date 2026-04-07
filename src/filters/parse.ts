import type { z } from 'zod'
import type {
	FilterFieldDefinition,
	FilterFieldOption,
	FilterFieldType,
	MetricFilterFieldMetadata
} from './types.ts'

interface ZodInternalDef {
	typeName?: string
	type?: string | z.ZodTypeAny
	description?: string
	innerType?: z.ZodTypeAny
	values?: Record<string, string>
	entries?: Record<string, string>
	element?: z.ZodTypeAny
}

function getDef(zodType: z.ZodTypeAny): ZodInternalDef {
	// biome-ignore lint/suspicious/noExplicitAny: Zod internals require any
	return (zodType as any)._def ?? {}
}

function getTypeName(zodType: z.ZodTypeAny): string | undefined {
	const def = getDef(zodType)
	if (def.typeName) return def.typeName
	if (typeof def.type === 'string') {
		const v4ToV3Map: Record<string, string> = {
			string: 'ZodString',
			number: 'ZodNumber',
			boolean: 'ZodBoolean',
			date: 'ZodDate',
			enum: 'ZodEnum',
			array: 'ZodArray',
			object: 'ZodObject',
			optional: 'ZodOptional',
			nullable: 'ZodNullable',
			default: 'ZodDefault'
		}
		return v4ToV3Map[def.type] || def.type
	}
	return undefined
}

function getEnumValues(zodType: z.ZodTypeAny): string[] {
	const def = getDef(zodType)
	// biome-ignore lint/suspicious/noExplicitAny: Zod internals require any
	const options = (zodType as any).options
	if (Array.isArray(options)) {
		return options.map(String)
	}
	if (def.entries && typeof def.entries === 'object') {
		return Object.values(def.entries).map(String)
	}
	if (def.values && typeof def.values === 'object') {
		return Object.values(def.values).map(String)
	}
	return []
}

function getArrayElementType(zodType: z.ZodTypeAny): z.ZodTypeAny | undefined {
	const def = getDef(zodType)
	if (def.element) return def.element
	if (def.type && typeof def.type !== 'string') {
		return def.type as z.ZodTypeAny
	}
	return undefined
}

function getShape(zodType: z.ZodTypeAny): Record<string, z.ZodTypeAny> {
	// biome-ignore lint/suspicious/noExplicitAny: Zod internals require any
	return (zodType as any).shape || {}
}

function unwrapZodType(zodType: z.ZodTypeAny): z.ZodTypeAny {
	const def = getDef(zodType)
	const typeName = getTypeName(zodType)
	const wrapperTypes = ['ZodOptional', 'ZodNullable', 'ZodDefault']
	if (typeName && wrapperTypes.includes(typeName) && def.innerType) {
		return unwrapZodType(def.innerType)
	}
	return zodType
}

function isMinMaxRangeObject(zodType: z.ZodTypeAny): boolean {
	const shape = getShape(zodType)
	const keys = Object.keys(shape)
	const validKeys = ['min', 'max']
	const hasOnlyValidKeys = keys.every((key) => validKeys.includes(key))
	if (!hasOnlyValidKeys || keys.length === 0) return false
	for (const key of keys) {
		const fieldType = shape[key]
		if (!fieldType) return false
		const unwrapped = unwrapZodType(fieldType)
		const typeName = getTypeName(unwrapped)
		if (typeName !== 'ZodNumber') return false
	}
	return true
}

function determineTypeFromFilterObject(obj: z.ZodTypeAny): FilterFieldType {
	const shape = getShape(obj)
	for (const value of Object.values(shape)) {
		const opValue = unwrapZodType(value as z.ZodTypeAny)
		const typeName = getTypeName(opValue)
		switch (typeName) {
			case 'ZodNumber':
				return 'number'
			case 'ZodBoolean':
				return 'boolean'
			case 'ZodDate':
				return 'date'
			case 'ZodEnum':
			case 'ZodNativeEnum':
				return 'option'
			case 'ZodArray': {
				const elementType = getArrayElementType(opValue)
				const elementTypeName = elementType ? getTypeName(elementType) : null
				if (
					elementTypeName === 'ZodEnum' ||
					elementTypeName === 'ZodNativeEnum'
				) {
					return 'multiOption'
				}
				if (elementTypeName === 'ZodNumber') return 'number'
				break
			}
		}
	}
	return 'text'
}

function determineFieldType(zodType: z.ZodTypeAny): FilterFieldType {
	const unwrapped = unwrapZodType(zodType)
	const typeName = getTypeName(unwrapped)

	if (typeName === 'ZodObject') {
		if (isMinMaxRangeObject(unwrapped)) return 'numberRange'
		return determineTypeFromFilterObject(unwrapped)
	}

	switch (typeName) {
		case 'ZodString':
			return 'text'
		case 'ZodNumber':
			return 'number'
		case 'ZodBoolean':
			return 'boolean'
		case 'ZodDate':
			return 'date'
		case 'ZodEnum':
		case 'ZodNativeEnum':
			return 'option'
		case 'ZodArray': {
			const elementType = getArrayElementType(unwrapped)
			const elementTypeName = elementType ? getTypeName(elementType) : null
			if (
				elementTypeName === 'ZodEnum' ||
				elementTypeName === 'ZodNativeEnum'
			) {
				return 'multiOption'
			}
			return 'text'
		}
		default:
			return 'text'
	}
}

function getDescription(zodType: z.ZodTypeAny): string | undefined {
	const def = getDef(zodType)
	if (def?.description) return def.description
	const unwrapped = unwrapZodType(zodType)
	const unwrappedDef = getDef(unwrapped)
	if (unwrappedDef?.description) return unwrappedDef.description
	if (getTypeName(unwrapped) === 'ZodObject') {
		const shape = getShape(unwrapped)
		for (const value of Object.values(shape)) {
			const opDef = getDef(value as z.ZodTypeAny)
			if (opDef?.description) return opDef.description
		}
	}
	return undefined
}

function formatEnumValue(value: string): FilterFieldOption {
	const label = value
		.toLowerCase()
		.replace(/_/g, ' ')
		.replace(/\b\w/g, (str) => str.toUpperCase())
	return { label, value }
}

function formatFieldDisplayName(fieldId: string): string {
	return fieldId
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/[_-]+/g, ' ')
		.replace(/\b\w/g, (str) => str.toUpperCase())
}

function extractEnumValues(zodType: z.ZodTypeAny): FilterFieldOption[] {
	const unwrapped = unwrapZodType(zodType)
	const typeName = getTypeName(unwrapped)

	if (typeName === 'ZodEnum' || typeName === 'ZodNativeEnum') {
		const values = getEnumValues(unwrapped)
		return values.map(formatEnumValue)
	}

	if (typeName === 'ZodArray') {
		const elementType = getArrayElementType(unwrapped)
		if (elementType) {
			const elementTypeName = getTypeName(elementType)
			if (
				elementTypeName === 'ZodEnum' ||
				elementTypeName === 'ZodNativeEnum'
			) {
				const values = getEnumValues(elementType)
				return values.map(formatEnumValue)
			}
		}
	}

	if (typeName === 'ZodObject') {
		const shape = getShape(unwrapped)
		for (const value of Object.values(shape)) {
			const opValue = unwrapZodType(value as z.ZodTypeAny)
			const opTypeName = getTypeName(opValue)
			if (opTypeName === 'ZodEnum' || opTypeName === 'ZodNativeEnum') {
				const values = getEnumValues(opValue)
				return values.map(formatEnumValue)
			}
			if (opTypeName === 'ZodArray') {
				const elementType = getArrayElementType(opValue)
				if (elementType) {
					const elementTypeName = getTypeName(elementType)
					if (
						elementTypeName === 'ZodEnum' ||
						elementTypeName === 'ZodNativeEnum'
					) {
						const values = getEnumValues(elementType)
						return values.map(formatEnumValue)
					}
				}
			}
		}
	}

	return []
}

export function parseMetricFilterSchema(
	schema: z.ZodTypeAny,
	options?: {
		excludeFields?: string[]
		includeFields?: string[]
		fieldMetadata?: Partial<Record<string, MetricFilterFieldMetadata>>
	}
): FilterFieldDefinition[] {
	const excludeFields = new Set(options?.excludeFields ?? [])
	const includeFields = options?.includeFields
	const fieldMetadata = options?.fieldMetadata ?? {}
	const fields: FilterFieldDefinition[] = []
	const unwrapped = unwrapZodType(schema)
	if (getTypeName(unwrapped) !== 'ZodObject') return []
	const shape = getShape(unwrapped)

	for (const [key, zodType] of Object.entries(shape)) {
		if (excludeFields.has(key)) continue
		if (includeFields && !includeFields.includes(key)) continue
		const metadata = fieldMetadata[key]
		const fieldType =
			metadata?.type ?? determineFieldType(zodType as z.ZodTypeAny)
		const description =
			metadata?.description ?? getDescription(zodType as z.ZodTypeAny)
		const enumOptions =
			metadata?.options ?? extractEnumValues(zodType as z.ZodTypeAny)
		fields.push({
			id: key,
			displayName: metadata?.displayName ?? formatFieldDisplayName(key),
			type: fieldType,
			description,
			options: enumOptions.length > 0 ? enumOptions : undefined,
			defaultOperator: metadata?.defaultOperator
		})
	}

	return fields
}
