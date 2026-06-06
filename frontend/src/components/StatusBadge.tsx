type Status = 'updated' | 'unchanged' | 'error' | null
const COLOR: Record<string, string> = { updated: '#4ade80', unchanged: '#6b7280', error: '#f87171' }
interface StatusBadgeProps { status: Status }
export default function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) return <span style={{ color: '#6b7280', fontSize: 12 }}>—</span>
  const c = COLOR[status] ?? '#6b7280'
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontFamily: 'monospace', color: c, border: `1px solid ${c}`, background: `${c}18` }}>
      {status}
    </span>
  )
}