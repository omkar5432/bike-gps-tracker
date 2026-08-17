export interface Geofence {
  id: number
  device_id: string
  name: string
  latitude: number
  longitude: number
  radius: number
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface GeofenceCreate {
  name: string
  latitude: number
  longitude: number
  radius: number
  enabled?: boolean
}

export interface GeofenceUpdate {
  name?: string
  latitude?: number
  longitude?: number
  radius?: number
  enabled?: boolean
}
