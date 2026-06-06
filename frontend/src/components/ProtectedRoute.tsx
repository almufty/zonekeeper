import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0d0d0f', color: '#6b7280', fontFamily: 'monospace', fontSize: 13 }}>
        initializing…
      </div>
    )
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />
}
