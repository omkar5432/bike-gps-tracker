import React from 'react'
import type { Device } from '../types/device'
import type { Location, ConnectionStatus } from '../types/location'
import { formatISTDateTime } from '../utils/timeFormatter'
import { BikeIcon, RadioIcon, RefreshIcon, PlusIcon, CrosshairIcon, BatteryIcon } from './Icons'

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
  const isOnline = device?.status === 'ONLINE'
  const isInactive = device?.status === 'INACTIVE'
  const batteryPct = location?.battery ?? null

  const getStatusBadge = () => {
    if (!device) return { label: 'No Device Selected', bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0', dotClass: '' }
    if (isInactive) return { label: 'Deactivated', bg: '#fef2f2', color: '#dc2626', border: '#fecaca', dotClass: 'animate-pulse-red' }
    if (isOnline) return { label: 'Live Tracking', bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', dotClass: 'animate-pulse-green' }
    return { label: 'Offline', bg: '#f8fafc', color: '#64748b', border: '#e2e8f0', dotClass: '' }
  }

  const badge = getStatusBadge()

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem 1.5rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '1rem',
      }}
    >
      {/* Left: Device & Live Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '240px' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: isOnline ? '#eff6ff' : '#f1f5f9',
            border: isOnline ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isOnline ? '#2563eb' : '#64748b',
            flexShrink: 0,
          }}
        >
          <BikeIcon size={26} />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {device ? (device.name || device.device_id) : 'Personal Bike Tracker'}
            </h1>
            
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: badge.bg,
                color: badge.color,
                border: `1px solid ${badge.border}`,
                padding: '0.2rem 0.6rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              <span
                className={badge.dotClass}
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: badge.color,
                  display: 'inline-block',
                }}
              />
              {badge.label}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {device && <span>ID: <code style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{device.device_id}</code></span>}
            <span>Last seen: {device?.last_seen ? formatISTDateTime(device.last_seen) : 'Never'}</span>
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
              padding: '0.4rem 0.75rem',
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

        {onCenterMap && location && (
          <button
            onClick={onCenterMap}
            className="btn-secondary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
            title="Center Live Marker on Map"
          >
            <CrosshairIcon size={16} />
            <span>Center Bike</span>
          </button>
        )}

        <button
          onClick={onRefresh}
          className="btn-secondary"
          style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
          title="Refresh All Telemetry"
        >
          <RefreshIcon size={16} />
          <span>Refresh</span>
        </button>

        <button
          onClick={onAddDevice}
          className="btn-primary"
          style={{ padding: '0.45rem 0.95rem', fontSize: '0.8rem' }}
        >
          <PlusIcon size={16} />
          <span>Add Device</span>
        </button>
      </div>
    </div>
  )
}
