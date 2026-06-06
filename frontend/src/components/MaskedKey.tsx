import { useState } from 'react'
interface MaskedKeyProps { value: string }
export default function MaskedKey({ value }: MaskedKeyProps) {
  const [revealed, setRevealed] = useState(false)
  const display = revealed ? value : `${'•'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <code style={{ fontFamily: 'monospace', fontSize: 12, color: '#9ca3af', letterSpacing: '0.05em' }}>{display}</code>
      <button onClick={() => setRevealed(r => !r)} style={{ background: 'none', border: '1px solid #252530', cursor: 'pointer', color: '#fbbf24', fontSize: 11, fontFamily: 'monospace', padding: '2px 6px', borderRadius: 4 }}>
        {revealed ? 'hide' : 'show'}
      </button>
    </span>
  )
}