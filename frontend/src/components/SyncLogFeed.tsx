import type { SyncLog } from '../types'
import StatusBadge from './StatusBadge'
function relTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60000) return `${Math.round(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`
  return `${Math.round(diff / 3600000)}h ago`
}
interface SyncLogFeedProps { logs: SyncLog[] }
export default function SyncLogFeed({ logs }: SyncLogFeedProps) {
  if (logs.length === 0) return <p style={{ color: '#6b7280', fontSize: 13, fontFamily: 'monospace' }}>no activity yet</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {logs.map(log => (
        <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8, background: '#111115', border: '1px solid #252530', fontFamily: 'monospace', fontSize: 12 }}>
          <span style={{ color: '#6b7280', minWidth: 60 }}>{relTime(log.timestamp)}</span>
          <span style={{ color: '#e5e7eb', flex: 1 }}>{log.record_name ?? `record #${log.record_id}`}</span>
          <StatusBadge status={log.status} />
          {log.new_ip && <span style={{ color: '#9ca3af' }}>{log.new_ip}</span>}
          {log.message && log.status === 'error' && <span style={{ color: '#f87171', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.message}</span>}
        </div>
      ))}
    </div>
  )
}