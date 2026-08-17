import React, { useState, useEffect } from 'react'
import { fetchDevices, deleteDevice } from '../services/api'
import { formatISTDateTime } from '../utils/timeFormatter'
import type { Device } from '../types/device'
import { BikeIcon, TrashIcon, RefreshIcon } from './Icons'

interface DeviceListProps {
  selectedDevice: Device | null
  onDeviceSelect: (device: Device) => void
  onDevicesLoaded?: (devices: Device[]) => void
  onDeviceDeleted?: (deviceId: string) => void
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'ONLINE':
      return { label: 'Online', bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' }
    case 'INACTIVE':
      return { label: 'Inactive', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' }
    default:
      return { label: 'Offline', bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' }
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
        <div className="skeleton" style={{ height: '70px', marginBottom: '0.5rem' }} />
        <div className="skeleton" style={{ height: '70px' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '1rem' }}>
        <div
          style={{
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            padding: '0.65rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '0.5rem',
            fontSize: '0.8rem',
          }}
        >
          {error}
        </div>
        <button
          onClick={loadDevices}
          className="btn-secondary"
          style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem' }}
        >
          <RefreshIcon size={14} />
          <span>Retry Loading</span>
        </button>
      </div>
    )
  }

  if (devices.length === 0) {
    return (
      <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>🚲</div>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>No bikes registered</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
          Click "+ Add Device" above to connect your first GPS tracker.
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '0.75rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          REGISTERED BIKES ({devices.length})
        </span>
        <button
          onClick={loadDevices}
          title="Refresh Device List"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
        >
          <RefreshIcon size={14} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {devices.map((device) => {
          const isSelected = selectedDevice?.id === device.id
          const badge = getStatusBadge(device.status)

          return (
            <div
              key={device.id}
              onClick={() => onDeviceSelect(device)}
              style={{
                padding: '0.85rem',
                backgroundColor: isSelected ? '#ffffff' : '#ffffff',
                border: isSelected ? '1.5px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                boxShadow: isSelected ? 'var(--shadow-md)' : 'none',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = 'var(--border-strong)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)'
                }
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: isSelected ? '#eff6ff' : '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isSelected ? '#2563eb' : '#64748b',
                      flexShrink: 0,
                    }}
                  >
                    <BikeIcon size={16} />
                  </div>
                  <strong
                    style={{
                      fontSize: '0.9rem',
                      color: isSelected ? '#1e40af' : 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {device.name || device.device_id}
                  </strong>
                </div>

                <button
                  onClick={(e) => handleDelete(e, device)}
                  disabled={deletingId === device.device_id}
                  title="Delete device"
                  className="btn-danger"
                  style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem' }}
                >
                  <TrashIcon size={12} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  {device.device_id}
                </span>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    backgroundColor: badge.bg,
                    color: badge.color,
                    border: `1px solid ${badge.border}`,
                    padding: '0.1rem 0.45rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      backgroundColor: badge.color,
                      display: 'inline-block',
                    }}
                  />
                  {badge.label}
                </span>
              </div>

              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                Last seen: {device.last_seen ? formatISTDateTime(device.last_seen) : 'Never'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
