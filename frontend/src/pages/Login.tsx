import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Logo from '../components/Logo'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(username, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#0d0d0f',
    border: '1px solid #252530',
    borderRadius: 8,
    padding: '11px 14px',
    color: '#e5e7eb',
    fontFamily: 'monospace',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.15s',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d0f', padding: 24, position: 'relative', overflow: 'hidden' }}>
      {/* dot-grid background */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, #1e1e26 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />
      {/* radial spotlight */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(251,191,36,0.03) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 360, position: 'relative' }}>
        <div style={{ background: '#111115', border: '1px solid #252530', borderRadius: 20, padding: '40px 36px', boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 36 }}>
            <Logo size={130} />
            <div style={{ marginTop: 18, color: '#fbbf24', fontFamily: 'monospace', fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>
              // zonekeeper
            </div>
            <div style={{ color: '#374151', fontFamily: 'monospace', fontSize: 11, marginTop: 4, letterSpacing: '0.04em' }}>
              dynamic dns manager
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', color: '#6b7280', fontFamily: 'monospace', fontSize: 11, marginBottom: 6, letterSpacing: '0.04em' }}>
                username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#fbbf24')}
                onBlur={e => (e.target.style.borderColor = '#252530')}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#6b7280', fontFamily: 'monospace', fontSize: 11, marginBottom: 6, letterSpacing: '0.04em' }}>
                password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#fbbf24')}
                onBlur={e => (e.target.style.borderColor = '#252530')}
              />
            </div>

            {error && (
              <div style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.18)', borderRadius: 8, padding: '9px 13px', color: '#f87171', fontFamily: 'monospace', fontSize: 12 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ marginTop: 4, padding: '12px', borderRadius: 10, border: '1px solid rgba(251,191,36,0.5)', background: loading ? 'rgba(251,191,36,0.04)' : 'rgba(251,191,36,0.1)', color: '#fbbf24', cursor: loading ? 'default' : 'pointer', fontFamily: 'monospace', fontSize: 13, fontWeight: 600, letterSpacing: '0.03em', transition: 'background 0.15s' }}
            >
              {loading ? 'authenticating…' : 'authenticate →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
