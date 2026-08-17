export interface Location {
  id: number
  device_id: string
  latitude: number
  longitude: number
  speed: number | null
  altitude: number | null
  battery: number | null
  gps_accuracy: number | null
  satellites: number | null
  timestamp: string
  created_at?: string
}

export interface Trip {
  id: number
  device_id: string
  start_time: string
  end_time: string | null
  distance: number
  duration: string | null
  max_speed: number
  average_speed: number
  created_at: string
  status?: 'ACTIVE' | 'COMPLETED'
}

export interface TripSummary {
  device_id: string
  total_trips: number
  total_distance_km: number
  average_trip_distance_km: number
  longest_trip_distance_km: number
  max_recorded_speed_kmh: number
  last_trip_start_time: string | null
}

export interface WebSocketEvent {
  event: 'connected' | 'location_update' | 'alert' | 'trip_started' | 'trip_completed' | 'error'
  data: any
}

export type ConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'

