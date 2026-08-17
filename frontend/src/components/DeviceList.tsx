import { useState, useEffect } from 'react'
import { fetchDevices } from '../services/api'
import type { Device } from '../types/device'

interface DeviceListProps {
  selectedDevice: Device | null
  onDeviceSelect: (device: Device) => void
  onDevicesLoaded?: (devices: Device[]) => void
}

function statusColor(status: string): string {
  switch (status) {
    case 'ONLINE':
      return '#28a745'
    case 'OFFLINE':
      return '#6c757d'
    case 'INACTIVE':
      return '#dc3545'
    default:
      return '#666'
  }
}

export default function DeviceList({
  selectedDevice,
  onDeviceSelect,
  onDevicesLoaded,
}: DeviceListProps) {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDevices()
  }, [])

  const loadDevices = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchDevices()
      setDevices(data)
      onDevicesLoaded?.(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '1rem' }}>
        <div>Loading devices...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '1rem' }}>
        <div style={{ color: '#c33', marginBottom: '0.5rem' }}>{error}</div>
        <button
          onClick={loadDevices}
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 0.75rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: 'white',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (devices.length === 0) {
    return (
      <div style={{ padding: '1rem' }}>
        <div>No devices registered yet.</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Devices</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {devices.map((device) => (
          <div
            key={device.id}
            onClick={() => onDeviceSelect(device)}
            style={{
              padding: '1rem',
              backgroundColor: selectedDevice?.id === device.id ? '#e3f2fd' : 'white',
              border:
                selectedDevice?.id === device.id ? '1px solid #90caf9' : '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              if (selectedDevice?.id !== device.id) {
                e.currentTarget.style.backgroundColor = '#f5f5f5'
              }
            }}
            onMouseLeave={(e) => {
              if (selectedDevice?.id !== device.id) {
                e.currentTarget.style.backgroundColor = 'white'
              }
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
              {device.name || device.device_id}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>ID: {device.device_id}</div>
            <div
              style={{
                fontSize: '0.875rem',
                color: statusColor(device.status),
                marginTop: '0.25rem',
                fontWeight: 600,
              }}
            >
              {device.status}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
              Last seen:{' '}
              {device.last_seen ? new Date(device.last_seen).toLocaleString() : 'N/A'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
