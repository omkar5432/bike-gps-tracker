import { isValidCoordinate } from './gpsValidator'

export interface PlaceDetails {
  displayName: string
  shortAddress: string
  city?: string
  state?: string
  country?: string
}

// In-memory cache for fast lookups during active session
const memoryCache = new Map<string, PlaceDetails>()
const CACHE_PREFIX = 'bike_gps_rev_geo_'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// Round coordinates to ~11 meters grid (4 decimal places) for caching
function getCacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`
}

/**
 * Fetches human-readable address from OpenStreetMap Nominatim reverse geocoding.
 * Includes caching and graceful fallback.
 */
export async function reverseGeocode(
  lat: number | null | undefined,
  lon: number | null | undefined
): Promise<PlaceDetails | null> {
  if (!isValidCoordinate(lat, lon) || lat === null || lon === null) {
    return null
  }

  const key = getCacheKey(lat, lon)

  // 1. Check in-memory cache
  if (memoryCache.has(key)) {
    return memoryCache.get(key)!
  }

  // 2. Check localStorage cache
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        memoryCache.set(key, parsed.data)
        return parsed.data
      }
    }
  } catch {
    // Ignore localStorage errors
  }

  // 3. Perform network lookup
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BikeTrackerIoT-Web/1.0',
      },
    })

    if (!res.ok) {
      throw new Error(`Geocoding failed with HTTP ${res.status}`)
    }

    const data = await res.json()
    if (!data || !data.address) {
      return null
    }

    const addr = data.address
    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.suburb ||
      addr.county ||
      addr.state_district ||
      ''
    const state = addr.state || ''
    const country = addr.country || ''

    const parts: string[] = []
    if (city) parts.push(city)
    if (state && state !== city) parts.push(state)
    if (country) parts.push(country)

    const shortAddress = parts.join(', ') || data.display_name?.split(',').slice(0, 3).join(', ') || 'Unknown Location'
    const displayName = data.display_name || shortAddress

    const result: PlaceDetails = {
      displayName,
      shortAddress,
      city,
      state,
      country,
    }

    // Cache result
    memoryCache.set(key, result)
    try {
      localStorage.setItem(
        `${CACHE_PREFIX}${key}`,
        JSON.stringify({ timestamp: Date.now(), data: result })
      )
    } catch {
      // Storage quota or private mode
    }

    return result
  } catch (err) {
    console.warn('Reverse geocoding error:', err)
    return null
  }
}
