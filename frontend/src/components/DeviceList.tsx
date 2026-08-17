import React, { useState, useEffect, useRef } from 'react'
import { fetchDevices, deleteDevice } from '../services/api'
import { formatISTDateTime } from '../utils/timeFormatter'
import { getFreshnessStatus } from '../utils/gpsValidator'
import type { Device } from '../types/device'
import { BikeIcon, TrashIcon, RefreshIcon } from './Icons'

interface DeviceListProps {
  selectedDevice: Device | null
  onDeviceSelect: (device: Device) => void
  onDevicesLoaded?: (devices: Device[]) => void
  onDeviceDeleted?: (deviceId: string) => void
}

function getDeviceBadge(device: Device) {
  if (device.status === 'INACTIVE') {
    return {
      label: 'Inactive',
      bg: '#fef2f2',
      color: '#dc2626',
      border: '#fecaca',
      dotClass: '',
      relativeTime: 'Deactivated',
    }
  }

  const freshness = getFreshnessStatus(device.last_seen)
  return {
    label: freshness.state === 'LIVE' ? 'Online' : freshness.label,
    bg: freshness.bg,
    color: freshness.color,
    border: freshness.border,
    dotClass: freshness.dotClass,
    relativeTime: freshness.relativeTime,
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
  const [isSpinning, setIsSpinning] = useState(false)
  const [, setTick] = useState(0)
  const isInitialLoadRef = useRef(true)

  // 1. Initial Load & Background Polling
  const loadDevices = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true)
        setError(null)
      }
      const data = await fetchDevices()
      setDevices(data)
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false
        onDevicesLoaded?.(data)
      }
      setError(null)
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to load devices')
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    loadDevices(false)

    // Silent background poll every 15 seconds to update last_seen from other devices
    const pollInterval = window.setInterval(() => {
      loadDevices(true)
    }, 15000)

    return () => clearInterval(pollInterval)
  }, [])

  // 2. Real-Time Status Ticker (every 5 seconds)
  // Automatically re-evaluates freshness badges (Live -> Recently Seen -> Delayed -> Offline)
  useEffect(() => {
    const ticker = window.setInterval(() => {
      setTick((t) => t + 1)
    }, 5000)

    return () => clearInterval(ticker)
  }, [])

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

  if (loading && devices.length === 0) {
    return (
      <div style={{ padding: '1rem' }}>
        <div className="skeleton" style={{ height: '70px', marginBottom: '0.5rem' }} />
        <div className="skeleton" style={{ height: '70px' }} />
      </div>
    )
  }

  if (error && devices.length === 0) {
    return (
      <div style={{ padding: '1rem' }}>
        <div
          style={{
            backgroundColor: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '0.6rem',
            fontSize: '0.8rem',
            lineHeight: 1.4,
          }}
        >
          <strong style={{ display: 'block', marginBottom: '2px' }}>Unable to load bikes</strong>
          <span style={{ color: '#b91c1c' }}>Check your network or server and try again.</span>
        </div>
        <button
          onClick={() => loadDevices(false)}
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
          onClick={() => {
            setIsSpinning(true)
            loadDevices(false)
            setTimeout(() => setIsSpinning(false), 700)
          }}
          title="Refresh Device List"
          style={{
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            cursor: 'pointer',
            color: '#334155',
            padding: '3px 6px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
        >
          <span style={{ display: 'inline-flex', transform: isSpinning ? 'rotate(360deg)' : 'none', transition: 'transform 0.6s ease' }}>
            <RefreshIcon size={13} color="#334155" />
          </span>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {devices.map((device) => {
          const isSelected = selectedDevice?.id === device.id
          const badge = getDeviceBadge(device)

          return (
            <div
              key={device.id}
              onClick={() => onDeviceSelect(device)}
              style={{
                padding: '0.85rem',
                backgroundColor: '#ffffff',
                border: isSelected ? '1.5px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                boxShadow: isSelected ? 'var(--shadow-md)' : 'none',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.borderColor = 'var(--brand-primary)'
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-subtle)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? '#eff6ff' : '#f8fafc',
                      color: isSelected ? 'var(--brand-primary)' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <BikeIcon size={18} />
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {device.name || device.device_id}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {device.device_id}
                    </div>
                  </div>
                </div>

                {/* Right: Real-time Status Badge & Delete */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      backgroundColor: badge.bg,
                      color: badge.color,
                      border: `1px solid ${badge.border}`,
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span
                      className={badge.dotClass}
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: badge.color,
                        display: 'inline-block',
                      }}
                    />
                    {badge.label}
                  </div>

                  <button
                    onClick={(e) => handleDelete(e, device)}
                    disabled={deletingId === device.device_id}
                    title="Delete Device"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: deletingId === device.device_id ? 'not-allowed' : 'pointer',
                      color: 'var(--text-muted)',
                      padding: '0.2rem',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: deletingId === device.device_id ? 0.5 : 1,
                      transition: 'color var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </div>

              {/* Real-Time Last Seen Relative Time */}
              <div style={{ marginTop: '0.45rem', fontSize: '0.725rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{badge.relativeTime}</span>
                {device.last_seen && (
                  <span style={{ color: 'var(--text-muted)' }}>
                    {formatISTDateTime(device.last_seen, false)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
