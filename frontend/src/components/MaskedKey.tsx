import { useState } from 'react'

interface MaskedKeyProps {
  accountId: number
  onReveal: (id: number) => Promise<string>
}

// HIGH-4 fix: key is never stored in component state until the user explicitly
// clicks "show", and is fetched from the server on demand rather than included
// in every list response.
export default function MaskedKey({ accountId, onReveal }: MaskedKeyProps) {
  const [revealed, setRevealed] = useState(false)
  const [key, setKey]           = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  const handleToggle = async () => {
    if (!revealed && key === null) {
      setLoading(true)
      try {
        const fetched = await onReveal(accountId)
        setKey(fetched)
      } finally {
        setLoading(false)
      }
    }
    setRevealed(r => !r)
  }

  const display = (() => {
    if (loading) return '••••••••'
    if (!key)    return '••••••••'
    if (revealed) return key
    return `${'•'.repeat(Math.max(0, key.length - 4))}${key.slice(-4)}`
  })()

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <code style={{ fontFamily: 'monospace', fontSize: 12, color: '#9ca3af', letterSpacing: '0.05em' }}>{display}</code>
      <button
        onClick={handleToggle}
        disabled={loading}
        style={{ background: 'none', border: '1px solid #252530', cursor: loading ? 'default' : 'pointer', color: '#fbbf24', fontSize: 11, fontFamily: 'monospace', padding: '2px 6px', borderRadius: 4 }}
      >
        {loading ? '…' : revealed ? 'hide' : 'show'}
      </button>
    </span>
  )
}
