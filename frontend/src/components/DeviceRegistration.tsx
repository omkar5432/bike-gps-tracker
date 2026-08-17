import { useState } from 'react'
import { registerDevice } from '../services/api'

interface DeviceRegistrationProps {
  onRegistrationSuccess: () => void
}

export default function DeviceRegistration({ onRegistrationSuccess }: DeviceRegistrationProps) {
  const [deviceId, setDeviceId] = useState('')
  const [name, setName] = useState('')
  const [imei, setImei] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registrationResult, setRegistrationResult] = useState<{
    device_id: string
    name: string
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
        name: result.name || 'Unnamed Device',
      })
      
      // Clear form
      setDeviceId('')
      setName('')
      setImei('')
      
      // Notify parent to refresh device list
      onRegistrationSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register device')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setRegistrationResult(null)
  }

  if (registrationResult) {
    return (
      <div style={{ padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
        <h3 style={{ marginBottom: '1rem', color: '#28a745' }}>✓ Device Registered Successfully</h3>
        
        <div style={{ marginBottom: '1rem' }}>
          <strong>Device ID:</strong> {registrationResult.device_id}
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <strong>Device Name:</strong> {registrationResult.name}
        </div>
        
        <button
          onClick={handleClose}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Close
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
      <h3 style={{ marginBottom: '1rem' }}>Register New Device</h3>
      
      {error && (
        <div style={{ 
          marginBottom: '1rem', 
          padding: '0.75rem', 
          backgroundColor: '#f8d7da', 
          color: '#721c24',
          borderRadius: '4px',
          border: '1px solid #f5c6cb'
        }}>
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
            Device ID <span style={{ color: '#dc3545' }}>*</span>
          </label>
          <input
            type="text"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="e.g., BIKE001"
            required
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
            Device Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., My Bike"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
            IMEI (Optional)
          </label>
          <input
            type="text"
            value={imei}
            onChange={(e) => setImei(e.target.value)}
            placeholder="e.g., 123456789012345"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: loading ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem'
            }}
          >
            {loading ? 'Registering...' : 'Register Device'}
          </button>
          
          <button
            type="button"
            onClick={() => {
              setDeviceId('')
              setName('')
              setImei('')
              setError(null)
            }}
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem'
            }}
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  )
}
