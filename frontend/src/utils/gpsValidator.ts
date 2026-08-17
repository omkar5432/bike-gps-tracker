import type { Location } from '../types/location'

/**
 * Validates whether latitude and longitude are valid, non-zero, realistic coordinates.
 * - Rejects (0, 0) / Null Island
 * - Rejects null / undefined / NaN
 * - Enforces valid geographic bounds: -90 <= lat <= 90 and -180 <= lon <= 180
 */
export function isValidCoordinate(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): boolean {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return false
  }

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return false
  }

  // Reject (0, 0) - Null Island / uninitialized default GPS
  if (Math.abs(latitude) < 0.0001 && Math.abs(longitude) < 0.0001) {
    return false
  }

  // Latitude must be within [-90, 90]
  if (latitude < -90 || latitude > 90) {
    return false
  }

  // Longitude must be within [-180, 180]
  if (longitude < -180 || longitude > 180) {
    return false
  }

  return true
}

/**
 * Filters an array of Location telemetry points to only valid GPS records.
 * Sorts/preserves valid sequence and filters out (0,0) or corrupt coordinates.
 */
export function filterValidLocations(locations: Location[]): Location[] {
  if (!locations || !Array.isArray(locations)) return []
  return locations.filter((loc) => isValidCoordinate(loc.latitude, loc.longitude))
}

export type FreshnessState = 'LIVE' | 'RECENT' | 'DELAYED' | 'OFFLINE'

export interface FreshnessInfo {
  state: FreshnessState
  label: string
  relativeTime: string
  color: string
  bg: string
  border: string
  dotClass: string
}

/**
 * Calculates freshness state based on the actual timestamp of the latest GPS fix.
 */
export function getFreshnessStatus(timestampStr: string | null | undefined): FreshnessInfo {
  if (!timestampStr) {
    return {
      state: 'OFFLINE',
      label: 'Offline',
      relativeTime: 'No signal recorded',
      color: '#64748b',
      bg: '#f8fafc',
      border: '#e2e8f0',
      dotClass: '',
    }
  }

  const time = new Date(timestampStr).getTime()
  if (Number.isNaN(time)) {
    return {
      state: 'OFFLINE',
      label: 'Offline',
      relativeTime: 'Unknown',
      color: '#64748b',
      bg: '#f8fafc',
      border: '#e2e8f0',
      dotClass: '',
    }
  }

  const now = Date.now()
  const diffSeconds = Math.max(0, Math.floor((now - time) / 1000))

  let relativeTime = ''
  if (diffSeconds < 5) {
    relativeTime = 'Just now'
  } else if (diffSeconds < 60) {
    relativeTime = `${diffSeconds}s ago`
  } else if (diffSeconds < 3600) {
    const mins = Math.floor(diffSeconds / 60)
    relativeTime = `${mins}m ago`
  } else if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600)
    relativeTime = `${hours}h ago`
  } else {
    const days = Math.floor(diffSeconds / 86400)
    relativeTime = `${days}d ago`
  }

  // Thresholds:
  // < 35 seconds -> Live / Online
  // 35s to 2 minutes -> Recently Seen
  // 2m to 10 minutes -> Delayed
  // > 10 minutes -> Offline
  if (diffSeconds <= 35) {
    return {
      state: 'LIVE',
      label: 'Live Tracking',
      relativeTime: `Updated ${relativeTime}`,
      color: '#059669',
      bg: '#ecfdf5',
      border: '#a7f3d0',
      dotClass: 'animate-pulse-green',
    }
  } else if (diffSeconds <= 120) {
    return {
      state: 'RECENT',
      label: 'Recently Seen',
      relativeTime: `Seen ${relativeTime}`,
      color: '#0891b2',
      bg: '#ecfeff',
      border: '#a5f3fc',
      dotClass: '',
    }
  } else if (diffSeconds <= 600) {
    return {
      state: 'DELAYED',
      label: 'Delayed Signal',
      relativeTime: `Last update ${relativeTime}`,
      color: '#d97706',
      bg: '#fffbeb',
      border: '#fde68a',
      dotClass: '',
    }
  } else {
    return {
      state: 'OFFLINE',
      label: 'Offline',
      relativeTime: `Last seen ${relativeTime}`,
      color: '#dc2626',
      bg: '#fef2f2',
      border: '#fecaca',
      dotClass: '',
    }
  }
}
