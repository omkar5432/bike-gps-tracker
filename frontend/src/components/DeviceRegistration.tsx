import React, { useState } from 'react'
import { registerDevice } from '../services/api'
import { BikeIcon, CopyIcon, CheckIcon, PlusIcon, CloseIcon } from './Icons'

interface DeviceRegistrationProps {
  onRegistrationSuccess: () => void
  onCancel?: () => void
}

export default function DeviceRegistration({ onRegistrationSuccess, onCancel }: DeviceRegistrationProps) {
  const [deviceId, setDeviceId] = useState('')
  const [name, setName] = useState('')
  const [imei, setImei] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [registrationResult, setRegistrationResult] = useState<{
    device_id: string
    name: string
    device_secret?: string
  } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!deviceId.trim()) {
      setError('Device ID is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await registerDevice({
        device_id: deviceId.trim(),
        name: name.trim() || undefined,
        imei: imei.trim() || undefined,
      })

      setRegistrationResult({
        device_id: result.device_id,
        name: result.name || 'Unnamed Bike',
        device_secret: result.device_secret,
      })

      setDeviceId('')
      setName('')
      setImei('')

      onRegistrationSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register device')
    } finally {
      setLoading(false)
    }
  }

  const handleCopySecret = () => {
    if (registrationResult?.device_secret) {
      navigator.clipboard.writeText(registrationResult.device_secret)
      setCopiedSecret(true)
      setTimeout(() => setCopiedSecret(false), 3000)
    }
  }

  if (registrationResult) {
    return (
      <div
        style={{
          padding: '1.25rem',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          border: '1.5px solid #a7f3d0',
          boxShadow: 'var(--shadow-md)',
          margin: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🎉</span>
          <h3 style={{ margin: 0, color: '#047857', fontSize: '1rem', fontWeight: 700 }}>
            Device Registered Successfully!
          </h3>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          <div><strong>Bike Name:</strong> {registrationResult.name}</div>
          <div><strong>Device ID:</strong> <code style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{registrationResult.device_id}</code></div>
        </div>

        {registrationResult.device_secret && (
          <div
            style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', marginBottom: '0.35rem' }}>
              ⚠️ HARDWARE DEVICE SECRET (COPY NOW — ONLY SHOWN ONCE):
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#ffffff',
                border: '1px solid #fcd34d',
                borderRadius: 'var(--radius-sm)',
                padding: '0.4rem 0.65rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: '#92400e',
                wordBreak: 'break-all',
              }}
            >
              <span>{registrationResult.device_secret}</span>
              <button
                onClick={handleCopySecret}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.2rem',
                  marginLeft: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  color: copiedSecret ? '#059669' : '#b45309',
                }}
                title="Copy Secret"
              >
                {copiedSecret ? <CheckIcon size={16} color="#059669" /> : <CopyIcon size={16} />}
              </button>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#92400e', marginTop: '0.35rem' }}>
              Configure this secret in your Android Tracker app or GPS hardware to send telemetry.
            </div>
          </div>
        )}

        <button
          onClick={() => {
            setRegistrationResult(null)
            onCancel?.()
          }}
          className="btn-primary"
          style={{ width: '100%', padding: '0.55rem' }}
        >
          Done & Return to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        padding: '1.25rem',
        backgroundColor: '#ffffff',
        borderRadius: 'var(--radius-lg)',
        border: '1.5px solid var(--brand-primary)',
        boxShadow: 'var(--shadow-md)',
        margin: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          ➕ Register GPS Tracker
        </h3>
        {onCancel && (
          <button
            onClick={onCancel}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <CloseIcon size={18} />
          </button>
        )}
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

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            Device ID <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="e.g. BIKE001 or BIKE-GPS-99"
            required
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-mono)',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            Bike / Device Nickname
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pulsar N160 or Road Bike"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            IMEI Number (Optional)
          </label>
          <input
            type="text"
            value={imei}
            onChange={(e) => setImei(e.target.value)}
            placeholder="15-digit IMEI number"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-mono)',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ flex: 1, padding: '0.55rem' }}
          >
            {loading ? 'Registering...' : 'Register Bike'}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary"
              style={{ padding: '0.55rem 0.85rem' }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
