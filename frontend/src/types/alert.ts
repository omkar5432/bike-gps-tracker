export interface Alert {
  id: number
  device_id: string
  type: 'GEOFENCE_ENTER' | 'GEOFENCE_EXIT' | 'OVERSPEED' | 'DEVICE_OFFLINE' | 'UNEXPECTED_MOVEMENT' | string
  message: string
  latitude?: number | null
  longitude?: number | null
  created_at: string
  acknowledged: boolean
  acknowledged_at?: string | null
}
