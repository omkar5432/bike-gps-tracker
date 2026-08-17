import React from 'react'
import { formatISTDateTime } from '../utils/timeFormatter'
import type { Trip, TripSummary, Location } from '../types/location'
import { SpeedChart } from './SpeedChart'
import { RouteIcon, SpeedometerIcon, RefreshIcon } from './Icons'

interface TripHistoryPanelProps {
  trips: Trip[]
  summary?: TripSummary | null
  selectedTripId?: number | null
  selectedTripRoute?: Location[] | null
  loading: boolean
  error: string | null
  onRefresh: () => void
  onSelectTrip?: (trip: Trip) => void
}

export default function TripHistoryPanel({
  trips,
  summary,
  selectedTripId,
  selectedTripRoute,
  loading,
  error,
  onRefresh,
  onSelectTrip,
}: TripHistoryPanelProps) {
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
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Trip Log ({trips.length})
          </h3>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="btn-secondary"
          style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
        >
          <RefreshIcon size={14} />
          <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {error && (
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
          {error}
        </div>
      )}

      {/* Selected Trip Speed Analytics Chart */}
      {selectedTripId && selectedTripRoute && selectedTripRoute.length > 1 && (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #c7d2fe',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem',
            marginBottom: '1rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4338ca' }}>
              📊 Speed Profile (Trip #{selectedTripId})
            </span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {selectedTripRoute.length} GPS checkpoints
            </span>
          </div>
          <SpeedChart locations={selectedTripRoute} height={140} />
        </div>
      )}

      {loading && trips.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="skeleton" style={{ height: '70px' }} />
          <div className="skeleton" style={{ height: '70px' }} />
        </div>
      ) : trips.length === 0 ? (
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
          No recorded rides yet. Ride telemetry will automatically be logged here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {trips.map((trip) => {
            const isSelected = selectedTripId === trip.id
            const isActive = trip.status === 'ACTIVE'

            return (
              <div
                key={trip.id}
                style={{
                  backgroundColor: isSelected ? '#f5f3ff' : '#ffffff',
                  border: isSelected ? '1.5px solid #8b5cf6' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem 0.9rem',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isActive ? '#ecfdf5' : '#f1f5f9',
                        color: isActive ? '#059669' : '#475569',
                        border: `1px solid ${isActive ? '#a7f3d0' : '#e2e8f0'}`,
                      }}
                    >
                      {isActive ? '● Active Ride' : '✓ Completed'}
                    </span>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                      {formatISTDateTime(trip.start_time)}
                    </strong>
                  </div>

                  {onSelectTrip && (
                    <button
                      onClick={() => onSelectTrip(trip)}
                      style={{
                        padding: '0.25rem 0.65rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: 'var(--radius-sm)',
                        border: isSelected ? '1px solid #7c3aed' : '1px solid var(--border-strong)',
                        backgroundColor: isSelected ? '#7c3aed' : '#ffffff',
                        color: isSelected ? '#ffffff' : 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {isSelected ? '✓ Viewing Route' : '🗺️ View Route'}
                    </button>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
                    gap: '0.5rem',
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    backgroundColor: isSelected ? '#ede9fe' : '#f8fafc',
                    padding: '0.45rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.65rem', fontWeight: 600 }}>
                      DISTANCE
                    </span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {trip.distance != null ? `${Number(trip.distance).toFixed(2)} km` : '0.00 km'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.65rem', fontWeight: 600 }}>
                      DURATION
                    </span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {trip.duration ?? (isActive ? 'In Progress' : '00:00:00')}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.65rem', fontWeight: 600 }}>
                      AVG SPEED
                    </span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {trip.average_speed != null ? `${Number(trip.average_speed).toFixed(1)} km/h` : '0.0 km/h'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.65rem', fontWeight: 600 }}>
                      MAX SPEED
                    </span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {trip.max_speed != null ? `${Number(trip.max_speed).toFixed(1)} km/h` : '0.0 km/h'}
                    </strong>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
