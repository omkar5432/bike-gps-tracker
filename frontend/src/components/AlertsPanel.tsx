import React, { useState } from 'react'
import type { Alert } from '../types/alert'
import { acknowledgeAlert } from '../services/api'
import { formatISTDateTime } from '../utils/timeFormatter'
import { AlertTriangleIcon, RefreshIcon, CheckIcon } from './Icons'

interface AlertsPanelProps {
  deviceId: string | undefined
  alerts: Alert[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onAlertAcknowledged: (alertId: number) => void
}

export default function AlertsPanel({
  deviceId,
  alerts,
  loading,
  error,
  onRefresh,
  onAlertAcknowledged,
}: AlertsPanelProps) {
  const [filterUnacked, setFilterUnacked] = useState(false)
  const [actingId, setActingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const displayedAlerts = filterUnacked ? alerts.filter((a) => !a.acknowledged) : alerts
  const unackedCount = alerts.filter((a) => !a.acknowledged).length

  const handleAcknowledge = async (alertId: number) => {
    if (!deviceId) return
    setActingId(alertId)
    setActionError(null)

    try {
      await acknowledgeAlert(deviceId, alertId)
      onAlertAcknowledged(alertId)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to acknowledge alert.')
    } finally {
      setActingId(null)
    }
  }

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'GEOFENCE_ENTER':
        return { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0', label: '🟢 GEOFENCE ENTER' }
      case 'GEOFENCE_EXIT':
        return { bg: '#fffbeb', color: '#b45309', border: '#fde68a', label: '🟠 GEOFENCE EXIT' }
      case 'OVERSPEED':
        return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: '⚡ OVERSPEED' }
      case 'DEVICE_OFFLINE':
        return { bg: '#f8fafc', color: '#475569', border: '#cbd5e1', label: '⚪ DEVICE OFFLINE' }
      case 'UNEXPECTED_MOVEMENT':
        return { bg: '#fdf4ff', color: '#a21caf', border: '#f5d0fe', label: '🚨 THEFT / MOVEMENT' }
      default:
        return { bg: '#f8fafc', color: '#475569', border: '#e2e8f0', label: type }
    }
  }

  return (
    <div style={{ padding: '1rem', height: '100%', overflow: 'auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Security Alerts ({alerts.length})
          </h3>
          {unackedCount > 0 && (
            <span
              style={{
                backgroundColor: '#ef4444',
                color: '#ffffff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.15rem 0.45rem',
                borderRadius: 'var(--radius-full)',
              }}
            >
              {unackedCount} unread
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => setFilterUnacked(!filterUnacked)}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: filterUnacked ? '1.5px solid #3b82f6' : '1px solid var(--border-strong)',
              backgroundColor: filterUnacked ? '#eff6ff' : '#ffffff',
              color: filterUnacked ? '#1d4ed8' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {filterUnacked ? 'Showing Unresolved Only' : 'Show All Alerts'}
          </button>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="btn-secondary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
          >
            <RefreshIcon size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {(error || actionError) && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            border: '1px solid #fecaca',
            padding: '0.5rem 0.75rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '0.75rem',
            fontSize: '0.8rem',
          }}
        >
          {error || actionError}
        </div>
      )}

      {loading && alerts.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="skeleton" style={{ height: '60px' }} />
          <div className="skeleton" style={{ height: '60px' }} />
        </div>
      ) : displayedAlerts.length === 0 ? (
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px dashed var(--border-strong)',
            padding: '1.5rem',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)',
            textAlign: 'center',
            fontSize: '0.85rem',
          }}
        >
          {filterUnacked ? 'No unacknowledged alerts. Everything is quiet!' : 'No security alerts recorded.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {displayedAlerts.map((alert) => {
            const typeStyle = getTypeStyle(alert.type)
            const isActing = actingId === alert.id

            return (
              <div
                key={alert.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem',
                  border: `1px solid ${alert.acknowledged ? 'var(--border-subtle)' : typeStyle.border}`,
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: alert.acknowledged ? '#fcfcfc' : '#ffffff',
                  opacity: alert.acknowledged ? 0.75 : 1,
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <span
                      style={{
                        backgroundColor: typeStyle.bg,
                        color: typeStyle.color,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.4rem',
                        borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${typeStyle.border}`,
                      }}
                    >
                      {typeStyle.label}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {formatISTDateTime(alert.created_at)}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                    {alert.message}
                  </div>

                  {alert.latitude !== null && alert.latitude !== undefined && alert.longitude !== null && alert.longitude !== undefined && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      📍 {alert.latitude.toFixed(5)}, {alert.longitude.toFixed(5)}
                    </div>
                  )}
                </div>

                <div style={{ marginLeft: '0.75rem', flexShrink: 0 }}>
                  {alert.acknowledged ? (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: '#059669',
                        backgroundColor: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        padding: '0.2rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        display: 'inline-block',
                      }}
                    >
                      ✓ Resolved
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      disabled={isActing}
                      className="btn-secondary"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                    >
                      {isActing ? '...' : 'Acknowledge'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
