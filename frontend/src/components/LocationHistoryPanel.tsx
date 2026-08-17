import type { Location } from '../types/location'

interface LocationHistoryPanelProps {
  locations: Location[]
  loading: boolean
  error: string | null
  onRefresh: () => void
}

function formatNullable(value: number | null | undefined, suffix = '', digits = 1): string {
  if (value === null || value === undefined) return 'N/A'
  return `${value.toFixed(digits)}${suffix}`
}

export default function LocationHistoryPanel({
  locations,
  loading,
  error,
  onRefresh,
}: LocationHistoryPanelProps) {
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
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Recent Locations</h2>
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

      {loading && locations.length === 0 ? (
        <div style={{ color: '#666', fontSize: '0.875rem' }}>Loading history...</div>
      ) : locations.length === 0 ? (
        <div
          style={{
            backgroundColor: '#f9f9f9',
            padding: '1rem',
            borderRadius: '4px',
            color: '#666',
            textAlign: 'center',
            fontSize: '0.875rem',
          }}
        >
          No location history yet.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.8rem',
            }}
          >
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd', color: '#666' }}>
                <th style={{ padding: '0.4rem' }}>Timestamp</th>
                <th style={{ padding: '0.4rem' }}>Latitude</th>
                <th style={{ padding: '0.4rem' }}>Longitude</th>
                <th style={{ padding: '0.4rem' }}>Speed</th>
                <th style={{ padding: '0.4rem' }}>Battery</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => (
                <tr key={loc.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.4rem', whiteSpace: 'nowrap' }}>
                    {new Date(loc.timestamp).toLocaleString()}
                  </td>
                  <td style={{ padding: '0.4rem', fontFamily: 'monospace' }}>
                    {loc.latitude.toFixed(6)}
                  </td>
                  <td style={{ padding: '0.4rem', fontFamily: 'monospace' }}>
                    {loc.longitude.toFixed(6)}
                  </td>
                  <td style={{ padding: '0.4rem' }}>{formatNullable(loc.speed, ' km/h')}</td>
                  <td style={{ padding: '0.4rem' }}>{formatNullable(loc.battery, '%', 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
