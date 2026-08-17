import { useEffect, useState } from 'react'
import type { Device } from '../types/device'
import type { Location, ConnectionStatus } from '../types/location'
import { formatISTTime } from '../utils/timeFormatter'
import { isValidCoordinate, getFreshnessStatus } from '../utils/gpsValidator'
import { reverseGeocode, type PlaceDetails } from '../utils/reverseGeocode'
import { BikeIcon, RefreshIcon, CrosshairIcon, BatteryIcon } from './Icons'

interface HeroStatusProps {
  device: Device | null
  location: Location | null
  connectionStatus: ConnectionStatus
  onRefresh: () => void
  onAddDevice: () => void
  onCenterMap?: () => void
}

export const HeroStatus: React.FC<HeroStatusProps> = ({
  device,
  location,
  connectionStatus,
  onRefresh,
  onAddDevice,
  onCenterMap,
}) => {
  const [placeInfo, setPlaceInfo] = useState<PlaceDetails | null>(null)
  const [isSpinning, setIsSpinning] = useState(false)
  const [, setTick] = useState(0)

  // Live timer tick every 5 seconds to update relative time & status badges
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  const validLoc = location && isValidCoordinate(location.latitude, location.longitude) ? location : null
  const freshness = getFreshnessStatus(validLoc?.timestamp || device?.last_seen)
  const isTrackingActive = freshness.state === 'LIVE'
  const batteryPct = location?.battery ?? null

  useEffect(() => {
    if (!validLoc) {
      setPlaceInfo(null)
      return
    }

    let isMounted = true
    reverseGeocode(validLoc.latitude, validLoc.longitude).then((info) => {
      if (isMounted) {
        setPlaceInfo(info)
      }
    })

    return () => {
      isMounted = false
    }
  }, [validLoc?.latitude, validLoc?.longitude])

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.15rem 1.4rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '1rem',
      }}
    >
      {/* Left: Device Info, Status & Location */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '260px' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: freshness.state === 'LIVE' ? '#eff6ff' : '#f8fafc',
            border: freshness.state === 'LIVE' ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: freshness.state === 'LIVE' ? '#2563eb' : '#64748b',
            flexShrink: 0,
          }}
        >
          <BikeIcon size={26} />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              {device ? (device.name || device.device_id) : 'Bike GPS Tracker'}
            </h1>

            {device && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                {/* 1. Connection Status Badge */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    backgroundColor: freshness.bg,
                    color: freshness.color,
                    border: `1px solid ${freshness.border}`,
                    padding: '0.2rem 0.65rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  <span
                    className={freshness.dotClass}
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: freshness.color,
                      display: 'inline-block',
                    }}
                  />
                  {freshness.state === 'LIVE' ? 'Online' : freshness.label}
                </div>

                {/* 2. GPS Tracking State Badge */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    backgroundColor: isTrackingActive ? '#f0fdf4' : '#f8fafc',
                    color: isTrackingActive ? '#15803d' : '#64748b',
                    border: isTrackingActive ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                    padding: '0.2rem 0.65rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  <span>{isTrackingActive ? '📡 Tracking Active' : '⚪ Tracking Stopped'}</span>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginTop: '0.3rem', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
            {device && <span>ID: <code style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{device.device_id}</code></span>}
            {placeInfo && (
              <span style={{ color: '#0f172a', fontWeight: 600 }}>
                📍 {placeInfo.shortAddress}
              </span>
            )}
            <span>
              {validLoc?.timestamp
                ? `Last communication: ${formatISTTime(validLoc.timestamp)} (${freshness.relativeTime})`
                : (device?.last_seen ? `Last communication: ${formatISTTime(device.last_seen)} (${freshness.relativeTime})` : 'Never connected')}
            </span>
            {validLoc?.satellites !== null && validLoc?.satellites !== undefined && (
              <span>🛰️ {validLoc.satellites} satellites</span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Quick Actions & Live Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        {batteryPct !== null && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: '#f8fafc',
              border: '1px solid var(--border-subtle)',
              padding: '0.45rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: batteryPct > 20 ? '#059669' : '#dc2626',
            }}
            title="Device Battery"
          >
            <BatteryIcon size={16} color={batteryPct > 20 ? '#059669' : '#dc2626'} />
            <span>{Math.round(batteryPct)}%</span>
          </div>
        )}

        {onCenterMap && validLoc && (
          <button
            onClick={onCenterMap}
            className="btn-secondary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
            title="Center Live Marker on Map"
          >
            <CrosshairIcon size={16} />
            <span>Locate Bike</span>
          </button>
        )}

        <button
          onClick={() => {
            setIsSpinning(true)
            onRefresh()
            setTimeout(() => setIsSpinning(false), 700)
          }}
          className="btn-secondary"
          style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer' }}
          title="Refresh Telemetry Data"
        >
          <span style={{ display: 'inline-flex', transform: isSpinning ? 'rotate(360deg)' : 'none', transition: 'transform 0.6s ease' }}>
            <RefreshIcon size={16} color="#334155" />
          </span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Refresh</span>
        </button>

        <button
          onClick={onAddDevice}
          className="btn-primary"
          style={{ padding: '0.45rem 0.95rem', fontSize: '0.8rem' }}
        >
          <span>+ Add Device</span>
        </button>
      </div>
    </div>
  )
}
