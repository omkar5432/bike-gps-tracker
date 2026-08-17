import { useState } from 'react'
import { formatISTTime, formatISTDate } from '../utils/timeFormatter'
import { isValidCoordinate, getFreshnessStatus } from '../utils/gpsValidator'
import type { Device } from '../types/device'
import type { Location, ConnectionStatus } from '../types/location'
import {
  BikeIcon,
  SpeedometerIcon,
  BatteryIcon,
  CrosshairIcon,
  SatelliteIcon,
  AltitudeIcon,
  ClockIcon,
  CopyIcon,
  CheckIcon,
  RadioIcon,
} from './Icons'

interface TelemetryPanelProps {
  device: Device | null
  location: Location | null
  connectionStatus: ConnectionStatus
  loading?: boolean
}

function formatValue(value: number | null | undefined, suffix = '', digits = 1): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/A'
  return `${Number(value).toFixed(digits)}${suffix}`
}

export default function TelemetryPanel({
  device,
  location,
  connectionStatus,
  loading = false,
}: TelemetryPanelProps) {
  const [copiedCoords, setCopiedCoords] = useState(false)

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

  const validLoc = location && isValidCoordinate(location.latitude, location.longitude) ? location : null
  const freshness = getFreshnessStatus(validLoc?.timestamp || device.last_seen)

  const handleCopyCoords = () => {
    if (!validLoc) return
    navigator.clipboard.writeText(`${validLoc.latitude.toFixed(6)}, ${validLoc.longitude.toFixed(6)}`)
    setCopiedCoords(true)
    setTimeout(() => setCopiedCoords(false), 2500)
  }

  const cards = [
    {
      label: 'Live Speed',
      value: validLoc ? formatValue(validLoc.speed, ' km/h') : '0.0 km/h',
      subtext: validLoc && validLoc.speed && validLoc.speed > 1 ? 'Moving' : 'Stationary',
      icon: <SpeedometerIcon size={20} color="#2563eb" />,
      highlight: true,
      tooltip: 'Real-time ground speed calculated by GPS',
    },
    {
      label: 'Battery Level',
      value: location && location.battery !== null ? formatValue(location.battery, '%', 0) : 'N/A',
      subtext: location?.battery ? (location.battery > 20 ? 'Optimal' : 'Low Battery') : 'No reading',
      icon: <BatteryIcon size={20} color={location?.battery && location.battery > 20 ? '#059669' : '#dc2626'} />,
      tooltip: 'Hardware tracker battery charge percentage',
    },
    {
      label: 'GPS Accuracy',
      value: validLoc ? formatValue(validLoc.gps_accuracy, ' m', 1) : 'N/A',
      subtext: validLoc?.gps_accuracy ? (validLoc.gps_accuracy <= 10 ? 'High Precision' : 'Coarse Lock') : 'Acquiring Fix',
      icon: <CrosshairIcon size={20} color="#d97706" />,
      tooltip: 'Horizontal position uncertainty in meters',
    },
    {
      label: 'Satellites Locked',
      value: validLoc?.satellites !== null && validLoc?.satellites !== undefined ? `${validLoc.satellites} Locked` : '0 Locked',
      subtext: (validLoc?.satellites ?? 0) >= 4 ? '3D Navigation Lock' : 'Acquiring Signal',
      icon: <SatelliteIcon size={20} color="#4f46e5" />,
      tooltip: 'Number of active GNSS satellites in fix',
    },
    {
      label: 'Elevation / Altitude',
      value: validLoc ? formatValue(validLoc.altitude, ' m', 0) : '0 m',
      subtext: 'Above sea level',
      icon: <AltitudeIcon size={20} color="#0891b2" />,
      tooltip: 'Altitude above sea level in meters',
    },
    {
      label: 'GPS Coordinates',
      isCoords: true,
      value: validLoc ? `${validLoc.latitude.toFixed(6)},\n${validLoc.longitude.toFixed(6)}` : 'Waiting for GPS Fix',
      subtext: validLoc ? 'WGS84 Lat, Lon' : 'No valid fix yet',
      icon: <CrosshairIcon size={20} color="#64748b" />,
      tooltip: 'Exact latitude and longitude coordinates',
    },
    {
      label: 'Last Broadcast',
      isTimestamp: true,
      time: validLoc?.timestamp ? formatISTTime(validLoc.timestamp) : (device.last_seen ? formatISTTime(device.last_seen) : 'N/A'),
      date: validLoc?.timestamp ? formatISTDate(validLoc.timestamp) : (device.last_seen ? formatISTDate(device.last_seen) : 'Never'),
      subtext: freshness.relativeTime,
      icon: <ClockIcon size={20} color="#64748b" />,
      tooltip: 'Timestamp of the most recent GPS telemetry packet',
    },
    {
      label: 'Hardware Registration',
      isTimestamp: true,
      time: device.created_at ? formatISTTime(device.created_at, false) : 'N/A',
      date: device.created_at ? formatISTDate(device.created_at) : 'N/A',
      subtext: `ID: ${device.device_id}`,
      icon: <BikeIcon size={20} color="#64748b" />,
      tooltip: 'Date and time when this device was registered',
    },
  ]

  return (
    <div style={{ padding: '1rem 1.25rem', height: '100%', overflowY: 'auto' }}>
      <div className="telemetry-grid">
        {cards.map((card, idx) => (
          <div
            key={idx}
            title={card.tooltip}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '1rem 1.15rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            {/* Header: Icon + Label */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {card.label}
              </span>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {card.icon}
              </div>
            </div>

            {/* Body: Value */}
            <div>
              {card.isTimestamp ? (
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                    {card.time}
                  </div>
                  <div style={{ fontSize: '0.775rem', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {card.date}
                  </div>
                </div>
              ) : card.isCoords ? (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#f8fafc',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.35rem 0.6rem',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.825rem',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                    }}
                  >
                    <span>{validLoc ? `${validLoc.latitude.toFixed(6)}, ${validLoc.longitude.toFixed(6)}` : 'No valid fix'}</span>
                    {validLoc && (
                      <button
                        onClick={handleCopyCoords}
                        title="Copy Coordinates"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          color: copiedCoords ? '#059669' : '#64748b',
                          padding: '0.1rem',
                        }}
                      >
                        {copiedCoords ? <CheckIcon size={16} color="#059669" /> : <CopyIcon size={16} />}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    fontSize: card.highlight ? '1.25rem' : '1.1rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {card.value}
                </div>
              )}

              {/* Subtext */}
              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                {card.subtext}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
