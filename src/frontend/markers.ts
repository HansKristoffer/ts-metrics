import type { ChartMarker, MarkerCategory } from './types.ts'

export const SEVERITY_COLORS: Record<string, string> = {
	info: '#3b82f6',
	success: '#22c55e',
	warning: '#f59e0b',
	danger: '#ef4444'
}

const LOG_TYPE_CATEGORIES: Record<string, string> = {
	UNIT_OTHER: 'Notes',
	UNIT_USER_CREATED: 'Unit Created',
	UNIT_STATUS: 'Status Changes',
	UNIT_INIT_PRODUCTION: 'Production',
	UNIT_ASSIGNED_TO_ORGANIZATION: 'Assignment',
	UNIT_ASSIGNED_TO_WAREHOUSE: 'Warehouse',
	UNIT_REMOVED_FROM_WAREHOUSE: 'Warehouse',
	UNIT_ASSIGNED_TO_PRODUCTION: 'Production',
	UNIT_MAINTENANCE_CREATED: 'Maintenance',
	UNIT_MAINTENANCE_DONE: 'Maintenance',
	UNIT_DESTROYED: 'Destroyed',
	UNIT_CHANGE_IMSI: 'IMSI Change',
	UNIT_CHANGED_PLACEMENT_TYPE: 'Placement Type'
}

export interface LogItemForMarker {
	id: string
	createdAt: Date | string
	data?: {
		type: string
		title: string
		description?: string
		severity?: 'info' | 'success' | 'warning' | 'danger'
		icon?: string
	}
}

export function getMarkerTypes(markers: readonly ChartMarker[]): string[] {
	return Array.from(new Set(markers.map((marker) => marker.type)))
}

export function filterChartMarkers(
	markers: readonly ChartMarker[],
	enabledTypes: ReadonlySet<string>
): ChartMarker[] {
	return markers.filter((marker) => enabledTypes.has(marker.type))
}

export function getMarkerCategories(
	markers: readonly ChartMarker[],
	enabledTypes: ReadonlySet<string>
): MarkerCategory[] {
	const counts = new Map<string, { label: string; count: number }>()

	for (const marker of markers) {
		const existing = counts.get(marker.type)
		if (existing) {
			existing.count++
		} else {
			counts.set(marker.type, { label: marker.label, count: 1 })
		}
	}

	return Array.from(counts.entries()).map(([type, { label, count }]) => ({
		type,
		label,
		count,
		enabled: enabledTypes.has(type)
	}))
}

export function toggleMarkerType(
	enabledTypes: ReadonlySet<string>,
	type: string
): Set<string> {
	const next = new Set(enabledTypes)
	if (next.has(type)) {
		next.delete(type)
	} else {
		next.add(type)
	}
	return next
}

export function toggleAllMarkerTypes(
	markers: readonly ChartMarker[],
	enabled: boolean
): Set<string> {
	return enabled ? new Set(getMarkerTypes(markers)) : new Set()
}

export function mapLogItemsToMarkers(
	items: readonly LogItemForMarker[]
): ChartMarker[] {
	return items
		.filter((item) => item.data != null)
		.map((item) => ({
			id: item.id,
			timestamp: new Date(item.createdAt),
			type: item.data!.type,
			label: LOG_TYPE_CATEGORIES[item.data!.type] ?? item.data!.type,
			title: item.data!.title,
			description: item.data!.description,
			severity: item.data!.severity,
			icon: item.data!.icon
		}))
}
