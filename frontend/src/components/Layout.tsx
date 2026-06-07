import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Logo from './Logo'
import { useVersionCheck } from '../hooks/useVersionCheck'

const NAV = [
  { to: '/',         label: '// 0x00 dashboard' },
  { to: '/accounts', label: '// 0x01 accounts'  },
  { to: '/zones',    label: '// 0x02 zones'     },
  { to: '/records',  label: '// 0x03 records'   },
  { to: '/settings', label: '// 0x04 settings'  },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const version = useVersionCheck()
  const [showChangelog, setShowChangelog] = useState(false)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0d0d0f' }}>
      <aside style={{ width: 220, minWidth: 220, background: '#111115', borderRight: '1px solid #252530', display: 'flex', flexDirection: 'column', padding: '24px 0' }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #252530', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo size={48} />
          <span style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: 15, fontWeight: 600 }}>// zonekeeper</span>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', padding: '8px 12px', gap: 4, flex: 1 }}>
          {NAV.map(({ to, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              style={({ isActive }) => ({
                display: 'block', padding: '8px 12px', borderRadius: 8,
                borderLeft: isActive ? '2px solid #fbbf24' : '2px solid transparent',
                background: isActive ? 'rgba(251,191,36,0.07)' : 'transparent',
                color: isActive ? '#fbbf24' : '#9ca3af',
                textDecoration: 'none', fontFamily: 'monospace', fontSize: 13, transition: 'all 0.15s',
              })}
            >{label}</NavLink>
          ))}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid #252530' }}>
          <div style={{ color: '#4b5563', fontFamily: 'monospace', fontSize: 11, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.username}
          </div>
          <button
            onClick={logout}
            style={{ width: '100%', padding: '7px 12px', borderRadius: 8, border: '1px solid #252530', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontFamily: 'monospace', fontSize: 12, textAlign: 'left', transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
          >
            sign out →
          </button>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11 }}>
              <span style={{ color: '#4b5563' }}>// built by </span>
              <a
                href="https://almufty.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#34d399', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
              >zain</a>
            </span>
            {version.hasUpdate ? (
              <button
                onClick={() => setShowChangelog(true)}
                className="zk-version-pulse"
                style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'monospace', fontSize: 11, textAlign: 'left', cursor: 'pointer' }}
              >
                v{version.current} ↑
              </button>
            ) : (
              <span style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 11 }}>
                v{version.current}
              </span>
            )}
          </div>
        </div>
      </aside>
      {showChangelog && (
        <div
          onClick={() => setShowChangelog(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#111115', border: '1px solid #252530', borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #252530', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>
                  {version.releaseName ?? `v${version.latest}`}
                </span>
                <span style={{ color: '#4b5563', fontFamily: 'monospace', fontSize: 11 }}>
                  (you have v{version.current})
                </span>
              </div>
              <button
                onClick={() => setShowChangelog(false)}
                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontFamily: 'monospace', fontSize: 16, lineHeight: 1, padding: 4 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#e5e7eb')}
                onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
              >✕</button>
            </div>
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              {version.changelog ? (
                <pre style={{ margin: 0, color: '#9ca3af', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {version.changelog}
                </pre>
              ) : (
                <span style={{ color: '#4b5563', fontFamily: 'monospace', fontSize: 12 }}>No changelog provided.</span>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #252530' }}>
              <a
                href={version.releaseUrl ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: 12, textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
              >
                view on github →
              </a>
            </div>
          </div>
        </div>
      )}

      <main style={{ flex: 1, overflowY: 'auto', padding: 32, background: '#0d0d0f', position: 'relative' }}>
        {/* Subtle grid background */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, #1e1e26 1px, transparent 1px)', backgroundSize: '32px 32px', opacity: 0.4, pointerEvents: 'none' }} />
        {/* Glowing spotlight in top right */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(251,191,36,0.03) 0%, transparent 70%)', pointerEvents: 'none' }} />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
