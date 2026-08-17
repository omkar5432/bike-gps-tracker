import React from 'react'
import { formatISTDateTime } from '../utils/timeFormatter'
import type { Device } from '../types/device'
import type { Location, ConnectionStatus } from '../types/location'
import { BikeIcon, RadioIcon, SpeedometerIcon, BatteryIcon, CrosshairIcon, SatelliteIcon, AltitudeIcon, ClockIcon } from './Icons'

interface TelemetryPanelProps {
  device: Device | null
  location: Location | null
  connectionStatus: ConnectionStatus
  loading?: boolean
}

function formatValue(value: number | null | undefined, suffix = '', digits = 1): string {
  if (value === null || value === undefined) return 'N/A'
  return `${Number(value).toFixed(digits)}${suffix}`
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

export default function TelemetryPanel({
  device,
  location,
  connectionStatus,
  loading = false,
}: TelemetryPanelProps) {
  if (loading) {
    return (
      <div style={{ padding: '1.25rem' }}>
        <div className="skeleton" style={{ height: '80px', marginBottom: '0.75rem' }} />
        <div className="skeleton" style={{ height: '80px' }} />
      </div>
    )
  }

  if (!device) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📡</div>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>No Device Selected</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Choose a bike from the sidebar to inspect telemetry.</p>
      </div>
    )
  }

  const badge = getStatusBadge(device.status)

  const items = [
    {
      label: 'Live Speed',
      value: location ? formatValue(location.speed, ' km/h') : '0.0 km/h',
      icon: <SpeedometerIcon size={18} color="#2563eb" />,
      highlight: true,
    },
    {
      label: 'Battery Level',
      value: location ? formatValue(location.battery, '%', 0) : 'N/A',
      icon: <BatteryIcon size={18} color={location?.battery && location.battery > 20 ? '#059669' : '#dc2626'} />,
    },
    {
      label: 'GPS Accuracy',
      value: location ? formatValue(location.gps_accuracy, ' m') : 'N/A',
      icon: <CrosshairIcon size={18} color="#d97706" />,
    },
    {
      label: 'Satellites Locked',
      value: location?.satellites !== null && location?.satellites !== undefined ? `${location.satellites}` : 'N/A',
      icon: <SatelliteIcon size={18} color="#4f46e5" />,
    },
    {
      label: 'Elevation / Altitude',
      value: location ? formatValue(location.altitude, ' m', 0) : 'N/A',
      icon: <AltitudeIcon size={18} color="#0891b2" />,
    },
    {
      label: 'GPS Coordinates',
      value: location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : 'N/A',
      icon: <CrosshairIcon size={18} color="#64748b" />,
      mono: true,
    },
    {
      label: 'Last Broadcast',
      value: location?.timestamp ? formatISTDateTime(location.timestamp) : 'N/A',
      icon: <ClockIcon size={18} color="#64748b" />,
    },
    {
      label: 'Hardware Registration',
      value: device.created_at ? formatISTDateTime(device.created_at, false) : 'N/A',
      icon: <BikeIcon size={18} color="#64748b" />,
    },
  ]

  return (
    <div style={{ padding: '1rem', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
        {items.map((item, idx) => (
          <div
            key={idx}
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 0.9rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {item.icon}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.15rem' }}>
                {item.label}
              </div>
              <div
                style={{
                  fontSize: item.highlight ? '1.05rem' : '0.875rem',
                  fontWeight: item.highlight ? 700 : 600,
                  color: 'var(--text-primary)',
                  fontFamily: item.mono ? 'var(--font-mono)' : 'inherit',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
