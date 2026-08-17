import { useState } from 'react'
import type { Alert } from '../types/alert'
import { acknowledgeAlert } from '../services/api'
import { formatISTDateTime } from '../utils/timeFormatter'

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
        return { bg: '#e8f5e9', color: '#2e7d32', border: '#a5d6a7', label: '🟢 ENTER' }
      case 'GEOFENCE_EXIT':
        return { bg: '#fff3e0', color: '#e65100', border: '#ffcc80', label: '🟠 EXIT' }
      case 'OVERSPEED':
        return { bg: '#ffebee', color: '#c62828', border: '#ef9a9a', label: '⚡ OVERSPEED' }
      case 'DEVICE_OFFLINE':
        return { bg: '#eceff1', color: '#37474f', border: '#b0bec5', label: '⚪ OFFLINE' }
      case 'UNEXPECTED_MOVEMENT':
        return { bg: '#f3e5f5', color: '#6a1b9a', border: '#ce93d8', label: '⚠️ MOVEMENT' }
      default:
        return { bg: '#f5f5f5', color: '#424242', border: '#e0e0e0', label: type }
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
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Alerts</h2>
          {unackedCount > 0 && (
            <span
              style={{
                backgroundColor: '#dc3545',
                color: 'white',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                padding: '0.1rem 0.5rem',
                borderRadius: '10px',
              }}
            >
              {unackedCount} new
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={filterUnacked}
              onChange={(e) => setFilterUnacked(e.target.checked)}
              style={{ marginRight: '0.3rem' }}
            />
            Unacked Only
          </label>
          <button
            onClick={onRefresh}
            disabled={loading}
            style={{
              padding: '0.35rem 0.75rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: loading ? '#eee' : 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem',
            }}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {(error || actionError) && (
        <div
          style={{
            backgroundColor: '#f8d7da',
            color: '#721c24',
            padding: '0.5rem 0.75rem',
            borderRadius: '4px',
            marginBottom: '0.75rem',
            fontSize: '0.875rem',
          }}
        >
          {error || actionError}
        </div>
      )}

      {loading && alerts.length === 0 ? (
        <div style={{ color: '#666', fontSize: '0.875rem' }}>Loading alerts...</div>
      ) : displayedAlerts.length === 0 ? (
        <div
          style={{
            backgroundColor: '#f9f9f9',
            padding: '1.5rem',
            borderRadius: '4px',
            color: '#666',
            textAlign: 'center',
            fontSize: '0.875rem',
          }}
        >
          {filterUnacked ? 'No unacknowledged alerts.' : 'No alerts recorded for this device.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {displayedAlerts.map((alert) => {
            const isActing = actingId === alert.id
            const typeStyle = getTypeStyle(alert.type)
            return (
              <div
                key={alert.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.75rem',
                  border: `1px solid ${alert.acknowledged ? '#e9ecef' : typeStyle.border}`,
                  borderRadius: '6px',
                  backgroundColor: alert.acknowledged ? '#fcfcfc' : '#ffffff',
                  boxShadow: alert.acknowledged ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
                  opacity: alert.acknowledged ? 0.75 : 1,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                    <span
                      style={{
                        backgroundColor: typeStyle.bg,
                        color: typeStyle.color,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.4rem',
                        borderRadius: '3px',
                      }}
                    >
                      {typeStyle.label}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                      {formatISTDateTime(alert.created_at)}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#212529', marginBottom: '0.2rem' }}>
                    {alert.message}
                  </div>

                  {alert.latitude !== null && alert.latitude !== undefined && alert.longitude !== null && alert.longitude !== undefined && (
                    <div style={{ fontSize: '0.75rem', color: '#6c757d', fontFamily: 'monospace' }}>
                      📍 {alert.latitude.toFixed(6)}, {alert.longitude.toFixed(6)}
                    </div>
                  )}
                </div>

                <div style={{ marginLeft: '0.75rem', flexShrink: 0 }}>
                  {alert.acknowledged ? (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: '#6c757d',
                        backgroundColor: '#e9ecef',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '3px',
                        display: 'inline-block',
                      }}
                    >
                      ✓ Acked
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      disabled={isActing}
                      style={{
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.75rem',
                        borderRadius: '4px',
                        border: '1px solid #ced4da',
                        backgroundColor: '#ffffff',
                        color: '#495057',
                        cursor: isActing ? 'not-allowed' : 'pointer',
                      }}
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
