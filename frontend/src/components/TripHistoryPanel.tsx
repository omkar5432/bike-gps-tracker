import { formatISTDateTime } from '../utils/timeFormatter'
import type { Trip, TripSummary } from '../types/location'

interface TripHistoryPanelProps {
  trips: Trip[]
  summary?: TripSummary | null
  selectedTripId?: number | null
  loading: boolean
  error: string | null
  onRefresh: () => void
  onSelectTrip?: (trip: Trip) => void
}

export default function TripHistoryPanel({
  trips,
  summary,
  selectedTripId,
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
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
          Past Trips ({trips.length})
        </h2>
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

      {error && (
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
          {error}
        </div>
      )}

      {/* Trip Analytics Summary Cards */}
      {summary && summary.total_trips > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#eef2ff',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #c7d2fe',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#4338ca', fontWeight: 600 }}>TOTAL TRIPS</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e1b4b' }}>
              {summary.total_trips}
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#ecfdf5',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #a7f3d0',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#047857', fontWeight: 600 }}>TOTAL DISTANCE</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#064e3b' }}>
              {summary.total_distance_km.toFixed(1)} <span style={{ fontSize: '0.75rem' }}>km</span>
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#fffbeb',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #fde68a',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#b45309', fontWeight: 600 }}>AVG DISTANCE</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#78350f' }}>
              {summary.average_trip_distance_km.toFixed(1)} <span style={{ fontSize: '0.75rem' }}>km</span>
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#fdf2f8',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #fbcfe8',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#be185d', fontWeight: 600 }}>MAX SPEED</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#831843' }}>
              {summary.max_recorded_speed_kmh.toFixed(1)} <span style={{ fontSize: '0.75rem' }}>km/h</span>
            </div>
          </div>
        </div>
      )}

      {loading && trips.length === 0 ? (
        <div style={{ color: '#666', fontSize: '0.875rem' }}>Loading trips...</div>
      ) : trips.length === 0 ? (
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
          No trips recorded yet. Trips are automatically created when the bike exceeds 5 km/h.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {trips.map((trip) => {
            const isActive = !trip.end_time || trip.status === 'ACTIVE'
            const isSelected = selectedTripId === trip.id

            return (
              <div
                key={trip.id}
                style={{
                  backgroundColor: isSelected ? '#f5f3ff' : '#ffffff',
                  border: isSelected ? '2px solid #8b5cf6' : '1px solid #e5e7eb',
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  fontSize: '0.85rem',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.4rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        backgroundColor: isActive ? '#dcfce7' : '#f3f4f6',
                        color: isActive ? '#15803d' : '#4b5563',
                      }}
                    >
                      {isActive ? '🟢 Active Ride' : '✓ Completed'}
                    </span>
                    <strong style={{ color: '#1f2937' }}>
                      {formatISTDateTime(trip.start_time)}
                    </strong>
                  </div>

                  {onSelectTrip && (
                    <button
                      onClick={() => onSelectTrip(trip)}
                      style={{
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '4px',
                        border: isSelected ? '1px solid #7c3aed' : '1px solid #d1d5db',
                        backgroundColor: isSelected ? '#7c3aed' : '#ffffff',
                        color: isSelected ? '#ffffff' : '#4b5563',
                        cursor: 'pointer',
                      }}
                    >
                      {isSelected ? 'Viewing Route' : '🗺️ View Route'}
                    </button>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '0.5rem',
                    color: '#4b5563',
                    fontSize: '0.8rem',
                    backgroundColor: isSelected ? '#ede9fe' : '#f9fafb',
                    padding: '0.5rem',
                    borderRadius: '4px',
                  }}
                >
                  <div>
                    <span style={{ color: '#6b7280', display: 'block', fontSize: '0.7rem' }}>Distance</span>
                    <strong>{trip.distance != null ? `${Number(trip.distance).toFixed(2)} km` : '0.00 km'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280', display: 'block', fontSize: '0.7rem' }}>Duration</span>
                    <strong>{trip.duration ?? (isActive ? 'In Progress' : '00:00:00')}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280', display: 'block', fontSize: '0.7rem' }}>Avg Speed</span>
                    <strong>{trip.average_speed != null ? `${Number(trip.average_speed).toFixed(1)} km/h` : '0.0 km/h'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280', display: 'block', fontSize: '0.7rem' }}>Max Speed</span>
                    <strong>{trip.max_speed != null ? `${Number(trip.max_speed).toFixed(1)} km/h` : '0.0 km/h'}</strong>
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

