import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV = [
  { to: '/',         label: '// 0x00 dashboard' },
  { to: '/accounts', label: '// 0x01 accounts'  },
  { to: '/zones',    label: '// 0x02 zones'     },
  { to: '/records',  label: '// 0x03 records'   },
  { to: '/settings', label: '// 0x04 settings'  },
]

export default function Layout() {
  const { user, logout } = useAuth()

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0d0d0f' }}>
      <aside style={{ width: 220, minWidth: 220, background: '#111115', borderRight: '1px solid #252530', display: 'flex', flexDirection: 'column', padding: '24px 0' }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #252530', marginBottom: 8 }}>
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
        </div>
      </aside>
      <main style={{ flex: 1, overflowY: 'auto', padding: 32, background: '#0d0d0f' }}>
        <Outlet />
      </main>
    </div>
  )
}
