import type { CSSProperties } from 'react'
import { formatISTDateTime } from '../utils/timeFormatter'
import type { Device } from '../types/device'
import type { Location, ConnectionStatus } from '../types/location'

interface TelemetryPanelProps {
  device: Device | null
  location: Location | null
  connectionStatus: ConnectionStatus
  loading?: boolean
}

function formatValue(value: number | null | undefined, suffix = '', digits = 1): string {
  if (value === null || value === undefined) return 'N/A'
  return `${value.toFixed(digits)}${suffix}`
}

function deviceStatusColor(status: string): string {
  switch (status) {
    case 'ONLINE':
      return '#28a745'
    case 'OFFLINE':
      return '#6c757d'
    case 'INACTIVE':
      return '#dc3545'
    default:
      return '#6c757d'
  }
}

function connectionColor(status: ConnectionStatus): string {
  switch (status) {
    case 'CONNECTED':
      return '#28a745'
    case 'CONNECTING':
      return '#ffc107'
    case 'DISCONNECTED':
      return '#6c757d'
    case 'ERROR':
      return '#dc3545'
    default:
      return '#6c757d'
  }
}

const cardStyle: CSSProperties = {
  backgroundColor: '#f9f9f9',
  padding: '0.75rem 1rem',
  borderRadius: '4px',
}

export default function TelemetryPanel({
  device,
  location,
  connectionStatus,
  loading = false,
}: TelemetryPanelProps) {
  if (loading) {
    return (
      <div style={{ padding: '1rem' }}>
        <div style={{ color: '#666' }}>Loading device data...</div>
      </div>
    )
  }

  if (!device) {
    return (
      <div style={{ padding: '1rem' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Telemetry</h2>
        <div
          style={{
            backgroundColor: '#f9f9f9',
            padding: '1.5rem',
            borderRadius: '4px',
            textAlign: 'center',
            color: '#666',
          }}
        >
          Select a device to view telemetry
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem', height: '100%', overflow: 'auto' }}>
      <h2 style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>Device & Telemetry</h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div style={cardStyle}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.35rem' }}>Device</div>
          <div style={{ fontWeight: 600 }}>{device.name || 'N/A'}</div>
          <div style={{ fontSize: '0.85rem', color: '#555', marginTop: '0.25rem' }}>
            ID: {device.device_id}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.35rem' }}>
            Device Status
          </div>
          <div style={{ fontWeight: 700, color: deviceStatusColor(device.status) }}>
            {device.status || 'N/A'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '0.35rem' }}>
            Last seen:{' '}
            {device.last_seen ? formatISTDateTime(device.last_seen) : 'N/A'}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.35rem' }}>
            Connection
          </div>
          <div style={{ fontWeight: 700, color: connectionColor(connectionStatus) }}>
            {connectionStatus}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.35rem' }}>Speed</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {location ? formatValue(location.speed, ' km/h') : 'N/A'}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.35rem' }}>Battery</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {location ? formatValue(location.battery, '%', 0) : 'N/A'}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.35rem' }}>
            GPS Accuracy
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {location ? formatValue(location.gps_accuracy, ' m') : 'N/A'}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.35rem' }}>
            Satellites
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {location && location.satellites !== null && location.satellites !== undefined
              ? location.satellites
              : 'N/A'}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.35rem' }}>Altitude</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {location ? formatValue(location.altitude, ' m', 0) : 'N/A'}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.35rem' }}>
            Coordinates
          </div>
          <div style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>
            {location
              ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
              : 'N/A'}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.35rem' }}>
            Last Update
          </div>
          <div style={{ fontSize: '0.85rem' }}>
            {location?.timestamp ? formatISTDateTime(location.timestamp) : 'N/A'}
          </div>
        </div>
      </div>

      {!location && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            backgroundColor: '#fff8e1',
            borderRadius: '4px',
            color: '#666',
            fontSize: '0.875rem',
          }}
        >
          Waiting for live GPS data... Historical route may still appear below if available.
        </div>
      )}
    </div>
  )
}
