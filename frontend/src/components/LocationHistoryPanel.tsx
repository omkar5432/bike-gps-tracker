import { useState } from 'react'
import { formatISTDateTime } from '../utils/timeFormatter'
import { isValidCoordinate } from '../utils/gpsValidator'
import type { Location } from '../types/location'
import { RefreshIcon, CopyIcon, CheckIcon } from './Icons'

interface LocationHistoryPanelProps {
  locations: Location[]
  loading: boolean
  error: string | null
  onRefresh: () => void
}

function formatNullable(value: number | null | undefined, suffix = '', digits = 1): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/A'
  return `${Number(value).toFixed(digits)}${suffix}`
}

export default function LocationHistoryPanel({
  locations,
  loading,
  error,
  onRefresh,
}: LocationHistoryPanelProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const handleCopy = (loc: Location) => {
    navigator.clipboard.writeText(`${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`)
    setCopiedId(loc.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div style={{ padding: '1rem 1.25rem', height: '100%', overflowY: 'auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Location Breadcrumbs
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {locations.length} total telemetry logs recorded
          </span>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="btn-secondary"
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
        >
          <RefreshIcon size={14} />
          <span>{loading ? 'Loading...' : 'Refresh'}</span>
        </button>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            border: '1px solid #fecaca',
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem',
            fontSize: '0.825rem',
          }}
        >
          {error}
        </div>
      )}

      {loading && locations.length === 0 ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Loading breadcrumbs...
        </div>
      ) : locations.length === 0 ? (
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid var(--border-subtle)',
            padding: '2rem',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--text-muted)',
            textAlign: 'center',
            fontSize: '0.85rem',
          }}
        >
          No location history recorded yet.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.8rem',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Timestamp</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Coordinates (Lat, Lon)</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Speed</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Battery</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Satellites</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => {
                const isValid = isValidCoordinate(loc.latitude, loc.longitude)
                return (
                  <tr
                    key={loc.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      backgroundColor: isValid ? 'transparent' : '#fffbeb',
                    }}
                  >
                    <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                      {formatISTDateTime(loc.timestamp)}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'var(--font-mono)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>
                          {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                        </span>
                        {isValid && (
                          <button
                            onClick={() => handleCopy(loc)}
                            title="Copy Coordinates"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              padding: '0.1rem',
                              color: copiedId === loc.id ? '#059669' : '#94a3b8',
                            }}
                          >
                            {copiedId === loc.id ? <CheckIcon size={14} color="#059669" /> : <CopyIcon size={14} />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>{formatNullable(loc.speed, ' km/h')}</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>{formatNullable(loc.battery, '%', 0)}</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>{loc.satellites !== null && loc.satellites !== undefined ? loc.satellites : 'N/A'}</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      {isValid ? (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.15rem 0.5rem',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            backgroundColor: '#ecfdf5',
                            color: '#059669',
                            border: '1px solid #a7f3d0',
                          }}
                        >
                          Valid GPS
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.15rem 0.5rem',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            backgroundColor: '#fef3c7',
                            color: '#b45309',
                            border: '1px solid #fde68a',
                          }}
                        >
                          Filtered (0,0)
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
