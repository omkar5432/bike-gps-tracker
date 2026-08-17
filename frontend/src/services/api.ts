import { supabase } from '../lib/supabase'
import type { Device } from '../types/device'
import type { Location, Trip } from '../types/location'
import type { Geofence, GeofenceCreate, GeofenceUpdate } from '../types/geofence'
import type { Alert } from '../types/alert'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const DEFAULT_FETCH_TIMEOUT_MS = 15000

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  if (!token) {
    throw new Error('No authentication token available. Please log in again.')
  }

  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function apiFetch(path: string, options: RequestInit = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const headers = await getAuthHeaders()
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
      signal: controller.signal,
    })
    return response
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.')
    }
    throw new Error('Backend unavailable. Check that the API server is running.')
  } finally {
    clearTimeout(timeoutId)
  }
}

async function handleJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (response.status === 401) {
    throw new Error('Session expired or invalid. Please log in again.')
  }
  if (response.status === 403) {
    throw new Error('Access denied: you do not own this device.')
  }
  if (response.status === 404) {
    throw new Error('Resource not found.')
  }
  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`${fallbackMessage}: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`)
  }
  return response.json()
}

// Device Endpoints
export async function fetchDevices(): Promise<Device[]> {
  const response = await apiFetch('/api/v1/devices')
  return handleJsonResponse<Device[]>(response, 'Failed to fetch devices')
}

export async function fetchDevice(deviceId: string): Promise<Device> {
  const response = await apiFetch(`/api/v1/devices/${encodeURIComponent(deviceId)}`)
  return handleJsonResponse<Device>(response, 'Failed to fetch device')
}

export async function registerDevice(deviceData: {
  device_id: string
  name?: string
  imei?: string
}): Promise<Device & { device_secret?: string }> {
  const response = await apiFetch('/api/v1/devices', {
    method: 'POST',
    body: JSON.stringify(deviceData),
  })
  return handleJsonResponse(response, 'Failed to register device')
}

export async function deleteDevice(deviceId: string): Promise<{ status: string; message: string }> {
  const response = await apiFetch(`/api/v1/devices/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
  })
  return handleJsonResponse(response, 'Failed to delete device')
}

// Location & Trip Endpoints
export async function fetchLocationHistory(
  deviceId: string,
  limit = 100
): Promise<Location[]> {
  const response = await apiFetch(
    `/api/v1/locations/${encodeURIComponent(deviceId)}/history?limit=${limit}`
  )
  return handleJsonResponse<Location[]>(response, 'Failed to fetch location history')
}

export async function fetchTrips(deviceId: string, limit = 20): Promise<Trip[]> {
  const response = await apiFetch(
    `/api/v1/trips/${encodeURIComponent(deviceId)}?limit=${limit}`
  )
  return handleJsonResponse<Trip[]>(response, 'Failed to fetch trips')
}

export async function fetchTrip(deviceId: string, tripId: number): Promise<Trip> {
  const response = await apiFetch(
    `/api/v1/trips/${encodeURIComponent(deviceId)}/${tripId}`
  )
  return handleJsonResponse<Trip>(response, 'Failed to fetch trip details')
}

export async function fetchTripRoute(deviceId: string, tripId: number): Promise<Location[]> {
  const response = await apiFetch(
    `/api/v1/trips/${encodeURIComponent(deviceId)}/${tripId}/route`
  )
  return handleJsonResponse<Location[]>(response, 'Failed to fetch trip route')
}

export async function fetchTripSummary(deviceId: string): Promise<import('../types/location').TripSummary> {
  const response = await apiFetch(
    `/api/v1/trips/${encodeURIComponent(deviceId)}/summary`
  )
  return handleJsonResponse<import('../types/location').TripSummary>(response, 'Failed to fetch trip summary')
}


// Geofence Endpoints
export async function fetchGeofences(deviceId: string): Promise<Geofence[]> {
  const response = await apiFetch(`/api/v1/geofences/${encodeURIComponent(deviceId)}`)
  return handleJsonResponse<Geofence[]>(response, 'Failed to fetch geofences')
}

export async function createGeofence(deviceId: string, data: GeofenceCreate): Promise<Geofence> {
  const response = await apiFetch(`/api/v1/geofences/${encodeURIComponent(deviceId)}`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return handleJsonResponse<Geofence>(response, 'Failed to create geofence')
}

export async function updateGeofence(
  deviceId: string,
  geofenceId: number,
  data: GeofenceUpdate
): Promise<Geofence> {
  const response = await apiFetch(
    `/api/v1/geofences/${encodeURIComponent(deviceId)}/${geofenceId}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    }
  )
  return handleJsonResponse<Geofence>(response, 'Failed to update geofence')
}

export async function deleteGeofence(deviceId: string, geofenceId: number): Promise<void> {
  const response = await apiFetch(
    `/api/v1/geofences/${encodeURIComponent(deviceId)}/${geofenceId}`,
    {
      method: 'DELETE',
    }
  )
  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Failed to delete geofence: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`)
  }
}

export async function enableGeofence(deviceId: string, geofenceId: number): Promise<Geofence> {
  const response = await apiFetch(
    `/api/v1/geofences/${encodeURIComponent(deviceId)}/${geofenceId}/enable`,
    {
      method: 'PATCH',
    }
  )
  return handleJsonResponse<Geofence>(response, 'Failed to enable geofence')
}

export async function disableGeofence(deviceId: string, geofenceId: number): Promise<Geofence> {
  const response = await apiFetch(
    `/api/v1/geofences/${encodeURIComponent(deviceId)}/${geofenceId}/disable`,
    {
      method: 'PATCH',
    }
  )
  return handleJsonResponse<Geofence>(response, 'Failed to disable geofence')
}

// Alert Endpoints
export async function fetchAlerts(
  deviceId: string,
  limit = 50,
  unacknowledgedOnly = false
): Promise<Alert[]> {
  const url = `/api/v1/alerts/${encodeURIComponent(deviceId)}?limit=${limit}&unacknowledged_only=${unacknowledgedOnly}`
  const response = await apiFetch(url)
  return handleJsonResponse<Alert[]>(response, 'Failed to fetch alerts')
}

export async function acknowledgeAlert(deviceId: string, alertId: number): Promise<Alert> {
  const response = await apiFetch(
    `/api/v1/alerts/${encodeURIComponent(deviceId)}/${alertId}/acknowledge`,
    {
      method: 'PATCH',
    }
  )
  return handleJsonResponse<Alert>(response, 'Failed to acknowledge alert')
}
