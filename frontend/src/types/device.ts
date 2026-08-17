export interface Device {
  id: number
  device_id: string
  name: string | null
  imei: string | null
  status: 'ONLINE' | 'OFFLINE' | 'INACTIVE' | string
  last_seen: string | null
  created_at: string
  updated_at: string
}
