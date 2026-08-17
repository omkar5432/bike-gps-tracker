import { useState } from 'react'
import type { Geofence, GeofenceCreate } from '../types/geofence'
import type { Location } from '../types/location'
import {
  createGeofence,
  deleteGeofence,
  enableGeofence,
  disableGeofence,
} from '../services/api'

interface GeofencePanelProps {
  deviceId: string | undefined
  currentLocation: Location | null
  geofences: Geofence[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onGeofenceCreated: (newGeo: Geofence) => void
  onGeofenceUpdated: (updatedGeo: Geofence) => void
  onGeofenceDeleted: (geofenceId: number) => void
}

export default function GeofencePanel({
  deviceId,
  currentLocation,
  geofences,
  loading,
  error,
  onRefresh,
  onGeofenceCreated,
  onGeofenceUpdated,
  onGeofenceDeleted,
}: GeofencePanelProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formLat, setFormLat] = useState<string>('')
  const [formLon, setFormLon] = useState<string>('')
  const [formRadius, setFormRadius] = useState<string>('300')
  const [formEnabled, setFormEnabled] = useState(true)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)

  const handleUseCurrentGPS = () => {
    if (currentLocation) {
      setFormLat(currentLocation.latitude.toFixed(6))
      setFormLon(currentLocation.longitude.toFixed(6))
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deviceId) return

    const lat = parseFloat(formLat)
    const lon = parseFloat(formLon)
    const rad = parseFloat(formRadius)

    if (!formName.trim()) {
      setActionError('Geofence name is required.')
      return
    }
    if (isNaN(lat) || lat < -90 || lat > 90) {
      setActionError('Latitude must be between -90 and 90.')
      return
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      setActionError('Longitude must be between -180 and 180.')
      return
    }
    if (isNaN(rad) || rad <= 0) {
      setActionError('Radius must be greater than 0 meters.')
      return
    }

    setFormSubmitting(true)
    setActionError(null)

    try {
      const payload: GeofenceCreate = {
        name: formName.trim(),
        latitude: lat,
        longitude: lon,
        radius: rad,
        enabled: formEnabled,
      }
      const created = await createGeofence(deviceId, payload)
      onGeofenceCreated(created)
      setShowAddForm(false)
      setFormName('')
      setFormLat('')
      setFormLon('')
      setFormRadius('300')
      setFormEnabled(true)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create geofence.')
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleToggleEnable = async (geo: Geofence) => {
    if (!deviceId) return
    setActionLoadingId(geo.id)
    setActionError(null)

    try {
      let updated: Geofence
      if (geo.enabled) {
        updated = await disableGeofence(deviceId, geo.id)
      } else {
        updated = await enableGeofence(deviceId, geo.id)
      }
      onGeofenceUpdated(updated)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update geofence status.')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleDelete = async (geofenceId: number) => {
    if (!deviceId) return
    if (!window.confirm('Are you sure you want to delete this geofence?')) return

    setActionLoadingId(geofenceId)
    setActionError(null)

    try {
      await deleteGeofence(deviceId, geofenceId)
      onGeofenceDeleted(geofenceId)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete geofence.')
    } finally {
      setActionLoadingId(null)
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
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
          Geofences ({geofences.length})
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm)
              if (!showAddForm && currentLocation && !formLat && !formLon) {
                setFormLat(currentLocation.latitude.toFixed(6))
                setFormLon(currentLocation.longitude.toFixed(6))
              }
            }}
            style={{
              padding: '0.35rem 0.75rem',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: showAddForm ? '#6c757d' : '#28a745',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            {showAddForm ? 'Cancel' : '+ New Geofence'}
          </button>
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

      {showAddForm && (
        <form
          onSubmit={handleCreate}
          style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            padding: '1rem',
            marginBottom: '1rem',
          }}
        >
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>Create New Geofence</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Home, Office, Garage"
                required
                style={{
                  width: '100%',
                  padding: '0.4rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                Latitude
              </label>
              <input
                type="number"
                step="any"
                value={formLat}
                onChange={(e) => setFormLat(e.target.value)}
                placeholder="e.g. 18.520430"
                required
                style={{
                  width: '100%',
                  padding: '0.4rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                Longitude
              </label>
              <input
                type="number"
                step="any"
                value={formLon}
                onChange={(e) => setFormLon(e.target.value)}
                placeholder="e.g. 73.856744"
                required
                style={{
                  width: '100%',
                  padding: '0.4rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                Radius (meters)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                value={formRadius}
                onChange={(e) => setFormRadius(e.target.value)}
                placeholder="e.g. 300"
                required
                style={{
                  width: '100%',
                  padding: '0.4rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: '1.2rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formEnabled}
                  onChange={(e) => setFormEnabled(e.target.checked)}
                  style={{ marginRight: '0.4rem' }}
                />
                Active immediately
              </label>
            </div>
          </div>

          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
            {currentLocation && (
              <button
                type="button"
                onClick={handleUseCurrentGPS}
                style={{
                  padding: '0.35rem 0.75rem',
                  backgroundColor: '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                📍 Use Current GPS
              </button>
            )}
            <button
              type="submit"
              disabled={formSubmitting}
              style={{
                padding: '0.35rem 0.75rem',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: formSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '0.8rem',
                marginLeft: 'auto',
              }}
            >
              {formSubmitting ? 'Saving...' : 'Save Geofence'}
            </button>
          </div>
        </form>
      )}

      {loading && geofences.length === 0 ? (
        <div style={{ color: '#666', fontSize: '0.875rem' }}>Loading geofences...</div>
      ) : geofences.length === 0 ? (
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
          No geofences created yet. Click <strong>+ New Geofence</strong> to create a circular safe zone.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {geofences.map((geo) => {
            const isActing = actionLoadingId === geo.id
            return (
              <div
                key={geo.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.6rem 0.75rem',
                  border: '1px solid #e9ecef',
                  borderRadius: '6px',
                  backgroundColor: geo.enabled ? '#ffffff' : '#f8f9fa',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: geo.enabled ? '#28a745' : '#6c757d',
                        display: 'inline-block',
                      }}
                    />
                    <strong style={{ fontSize: '0.9rem', color: geo.enabled ? '#212529' : '#6c757d' }}>
                      {geo.name}
                    </strong>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '3px',
                        backgroundColor: geo.enabled ? '#e8f5e9' : '#eceff1',
                        color: geo.enabled ? '#2e7d32' : '#546e7a',
                        fontWeight: 600,
                      }}
                    >
                      {geo.radius}m
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#6c757d',
                      fontFamily: 'monospace',
                      marginTop: '0.2rem',
                    }}
                  >
                    Center: {geo.latitude.toFixed(6)}, {geo.longitude.toFixed(6)}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    onClick={() => handleToggleEnable(geo)}
                    disabled={isActing}
                    style={{
                      padding: '0.25rem 0.6rem',
                      fontSize: '0.75rem',
                      borderRadius: '4px',
                      border: '1px solid #ccc',
                      backgroundColor: geo.enabled ? '#fff3cd' : '#d4edda',
                      color: geo.enabled ? '#856404' : '#155724',
                      cursor: isActing ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isActing ? '...' : geo.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDelete(geo.id)}
                    disabled={isActing}
                    style={{
                      padding: '0.25rem 0.6rem',
                      fontSize: '0.75rem',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      cursor: isActing ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
