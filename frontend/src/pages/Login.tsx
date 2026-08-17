import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { BikeIcon, ShieldIcon } from '../components/Icons'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await signIn(email, password)

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        width: '100vw',
        backgroundColor: '#0f172a',
        background: 'radial-gradient(ellipse 80% 80% at 50% -20%, rgba(59, 130, 246, 0.25), rgba(15, 23, 42, 1))',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          padding: '2.5rem 2rem',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          width: '100%',
          maxWidth: '420px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '14px',
              backgroundColor: '#3b82f6',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)',
              marginBottom: '0.85rem',
            }}
          >
            <BikeIcon size={30} />
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>
            BikeTracker <span style={{ color: '#0284c7', fontSize: '0.9rem', fontWeight: 600 }}>IoT</span>
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            Sign in to access real-time personal GPS telemetry
          </p>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1.25rem',
              fontSize: '0.85rem',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="email" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Account Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.9rem',
                fontFamily: 'var(--font-sans)',
              }}
            />
          </div>

          <div>
            <label htmlFor="password" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.9rem',
                fontFamily: 'var(--font-sans)',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '0.95rem',
              marginTop: '0.5rem',
            }}
          >
            {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <ShieldIcon size={14} color="#94a3b8" />
          <span>Encrypted Personal IoT Tracking • End-to-End Auth</span>
        </div>
      </div>
    </div>
  )
}
