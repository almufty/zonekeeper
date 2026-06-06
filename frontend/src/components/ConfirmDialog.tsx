interface ConfirmDialogProps { message: string; onConfirm: () => void; onCancel: () => void }
export default function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#111115', border: '1px solid #252530', borderRadius: 16, padding: 32, maxWidth: 400, width: '90%', fontFamily: 'monospace' }}>
        <p style={{ color: '#e5e7eb', margin: '0 0 24px', fontSize: 14 }}>{message}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #252530', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontFamily: 'monospace', fontSize: 13 }}>cancel</button>
          <button onClick={onConfirm} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #f87171', background: 'rgba(248,113,113,0.1)', color: '#f87171', cursor: 'pointer', fontFamily: 'monospace', fontSize: 13 }}>delete</button>
        </div>
      </div>
    </div>
  )
}