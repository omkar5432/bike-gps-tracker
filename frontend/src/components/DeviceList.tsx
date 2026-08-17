import { useState, useEffect } from 'react'
import { fetchDevices, deleteDevice } from '../services/api'
import type { Device } from '../types/device'

interface DeviceListProps {
  selectedDevice: Device | null
  onDeviceSelect: (device: Device) => void
  onDevicesLoaded?: (devices: Device[]) => void
  onDeviceDeleted?: (deviceId: string) => void
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
  onDeviceDeleted,
}: DeviceListProps) {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  const handleDelete = async (e: React.MouseEvent, device: Device) => {
    e.stopPropagation()
    const confirmMessage = `Are you sure you want to delete device "${device.name || device.device_id}"?\n\nThis will permanently remove all associated location history, trips, geofences, and alerts.`
    if (!window.confirm(confirmMessage)) {
      return
    }

    try {
      setDeletingId(device.device_id)
      setError(null)
      await deleteDevice(device.device_id)
      const updated = devices.filter((d) => d.device_id !== device.device_id)
      setDevices(updated)
      onDeviceDeleted?.(device.device_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete device')
    } finally {
      setDeletingId(null)
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
        <div style={{ color: '#666', fontSize: '0.9rem' }}>No devices registered yet. Click "+ Add Device" above to register one.</div>
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
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              position: 'relative',
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#222' }}>
                {device.name || device.device_id}
              </div>
              <button
                onClick={(e) => handleDelete(e, device)}
                disabled={deletingId === device.device_id}
                title="Delete device"
                style={{
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  border: '1px solid #fca5a5',
                  borderRadius: '4px',
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: deletingId === device.device_id ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#fecaca'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#fee2e2'
                }}
              >
                {deletingId === device.device_id ? 'Deleting...' : '🗑️ Delete'}
              </button>
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
              ● {device.status}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
              Last seen:{' '}
              {device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Never'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

