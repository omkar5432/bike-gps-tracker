import React, { useState } from 'react'
import type { Geofence, GeofenceCreate } from '../types/geofence'
import type { Location } from '../types/location'
import {
  createGeofence,
  deleteGeofence,
  enableGeofence,
  disableGeofence,
} from '../services/api'
import { ShieldIcon, PlusIcon, RefreshIcon, TrashIcon, CrosshairIcon } from './Icons'

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
    if (!window.confirm('Delete this geofence? Safe zone tracking will stop immediately.')) return

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Safe Zones / Geofences ({geofences.length})
          </h3>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-primary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
          >
            <PlusIcon size={14} />
            <span>{showAddForm ? 'Cancel' : 'New Zone'}</span>
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

      {/* Geofence Create Form Modal/Drawer */}
      {showAddForm && (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1.5px solid #bfdbfe',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            marginBottom: '1rem',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', fontWeight: 700, color: '#1e40af' }}>
            ➕ Create Circular Safe Zone
          </h4>

          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                Zone Label (e.g. Home Garage, Office, Parking)
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Zone name..."
                required
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                  Center Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={formLat}
                  onChange={(e) => setFormLat(e.target.value)}
                  placeholder="18.520430"
                  required
                  style={{
                    width: '100%',
                    padding: '0.4rem 0.6rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                  Center Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={formLon}
                  onChange={(e) => setFormLon(e.target.value)}
                  placeholder="73.856744"
                  required
                  style={{
                    width: '100%',
                    padding: '0.4rem 0.6rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              </div>
            </div>

            {currentLocation && (
              <button
                type="button"
                onClick={handleUseCurrentGPS}
                className="btn-secondary"
                style={{ alignSelf: 'flex-start', padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
              >
                <CrosshairIcon size={14} />
                <span>Use Bike's Current Location</span>
              </button>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                Radius: <strong style={{ color: 'var(--text-primary)' }}>{formRadius} meters</strong>
              </label>
              <input
                type="range"
                min="50"
                max="2000"
                step="50"
                value={formRadius}
                onChange={(e) => setFormRadius(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
              <input
                type="checkbox"
                id="geoEnabledCheck"
                checked={formEnabled}
                onChange={(e) => setFormEnabled(e.target.checked)}
              />
              <label htmlFor="geoEnabledCheck" style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Enable monitoring immediately
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                type="submit"
                disabled={formSubmitting}
                className="btn-primary"
                style={{ flex: 1, padding: '0.45rem', fontSize: '0.8rem' }}
              >
                {formSubmitting ? 'Saving...' : 'Save Geofence'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn-secondary"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && geofences.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="skeleton" style={{ height: '60px' }} />
          <div className="skeleton" style={{ height: '60px' }} />
        </div>
      ) : geofences.length === 0 ? (
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
          No active geofences. Click <strong>+ New Zone</strong> to create safe boundary alerts.
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
                  padding: '0.65rem 0.85rem',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: geo.enabled ? '#ffffff' : '#f8fafc',
                  opacity: geo.enabled ? 1 : 0.8,
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: geo.enabled ? 'var(--status-online)' : 'var(--status-offline)',
                        display: 'inline-block',
                      }}
                    />
                    <strong style={{ fontSize: '0.85rem', color: geo.enabled ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {geo.name}
                    </strong>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.1rem 0.4rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: geo.enabled ? '#ecfdf5' : '#f1f5f9',
                        color: geo.enabled ? '#059669' : '#64748b',
                        fontWeight: 700,
                      }}
                    >
                      {geo.radius}m
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                      marginTop: '0.2rem',
                    }}
                  >
                    📍 {geo.latitude.toFixed(5)}, {geo.longitude.toFixed(5)}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    onClick={() => handleToggleEnable(geo)}
                    disabled={isActing}
                    style={{
                      padding: '0.25rem 0.6rem',
                      fontSize: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-strong)',
                      backgroundColor: geo.enabled ? '#fffbeb' : '#ecfdf5',
                      color: geo.enabled ? '#b45309' : '#047857',
                      cursor: isActing ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {isActing ? '...' : geo.enabled ? 'Disable' : 'Enable'}
                  </button>

                  <button
                    onClick={() => handleDelete(geo.id)}
                    disabled={isActing}
                    className="btn-danger"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    title="Delete Geofence"
                  >
                    <TrashIcon size={12} />
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
