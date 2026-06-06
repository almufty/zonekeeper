import { useState, FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { changePassword } from '../api'

const card: React.CSSProperties = { background: '#111115', border: '1px solid #252530', borderRadius: 16, padding: 24 }

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0d0d0f',
  border: '1px solid #252530',
  borderRadius: 8,
  padding: '10px 12px',
  color: '#e5e7eb',
  fontFamily: 'monospace',
  fontSize: 13,
  outline: 'none',
  transition: 'border-color 0.15s',
}

export default function Settings() {
  const { user, logout } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (next !== confirm) return setMsg({ type: 'err', text: 'New passwords do not match' })
    if (next.length < 8) return setMsg({ type: 'err', text: 'Password must be at least 8 characters' })
    setLoading(true)
    setMsg(null)
    try {
      await changePassword(current, next)
      setMsg({ type: 'ok', text: 'Password updated successfully' })
      setCurrent(''); setNext(''); setConfirm('')
    } catch (err) {
      setMsg({ type: 'err', text: (err as Error).message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: 22, fontWeight: 600, margin: '0 0 24px' }}>// 0x04 settings</h1>

      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: 11, marginBottom: 4 }}>logged in as</div>
        <div style={{ color: '#e5e7eb', fontFamily: 'monospace', fontSize: 15, fontWeight: 600 }}>{user?.username}</div>
      </div>

      <div style={card}>
        <h2 style={{ color: '#e5e7eb', fontFamily: 'monospace', fontSize: 13, fontWeight: 600, margin: '0 0 20px' }}>change password</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'current password', val: current, set: setCurrent },
            { label: 'new password',     val: next,    set: setNext    },
            { label: 'confirm new',      val: confirm, set: setConfirm },
          ].map(({ label, val, set }) => (
            <div key={label}>
              <label style={{ display: 'block', color: '#6b7280', fontFamily: 'monospace', fontSize: 11, marginBottom: 6 }}>{label}</label>
              <input
                type="password"
                value={val}
                onChange={e => set(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#fbbf24')}
                onBlur={e => (e.target.style.borderColor = '#252530')}
              />
            </div>
          ))}

          {msg && (
            <div style={{ background: msg.type === 'ok' ? 'rgba(74,222,128,0.07)' : 'rgba(248,113,113,0.07)', border: `1px solid ${msg.type === 'ok' ? 'rgba(74,222,128,0.18)' : 'rgba(248,113,113,0.18)'}`, borderRadius: 8, padding: '8px 12px', color: msg.type === 'ok' ? '#4ade80' : '#f87171', fontFamily: 'monospace', fontSize: 12 }}>
              {msg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ marginTop: 4, padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(251,191,36,0.5)', background: 'rgba(251,191,36,0.1)', color: '#fbbf24', cursor: loading ? 'default' : 'pointer', fontFamily: 'monospace', fontSize: 13, alignSelf: 'flex-start' }}
          >
            {loading ? 'updating…' : 'update password'}
          </button>
        </form>
      </div>

      <div style={{ marginTop: 24 }}>
        <button
          onClick={logout}
          style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #252530', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontFamily: 'monospace', fontSize: 13, transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
        >
          sign out
        </button>
      </div>
    </div>
  )
}
