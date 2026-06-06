import { useEffect, useState } from 'react'
import type { Zone, Account, CfZone } from '../types'
import { getZones, createZone, deleteZone, getAccounts, verifyAccount } from '../api'
import ConfirmDialog from '../components/ConfirmDialog'

const card  = { background: '#111115', border: '1px solid #252530', borderRadius: 16, padding: 24, fontFamily: 'monospace' }
const input = { background: '#0d0d0f', border: '1px solid #252530', borderRadius: 8, color: '#e5e7eb', fontFamily: 'monospace', fontSize: 13, padding: '8px 12px', width: '100%' as const }
const btn   = (color = '#fbbf24') => ({ padding: '8px 16px', borderRadius: 8, border: `1px solid ${color}`, background: `${color}18`, color, cursor: 'pointer' as const, fontFamily: 'monospace', fontSize: 12 })

export default function Zones() {
  const [zones, setZones]         = useState<Zone[]>([])
  const [accounts, setAccounts]   = useState<Account[]>([])
  const [cfZones, setCfZones]     = useState<CfZone[]>([])
  const [showForm, setShowForm]   = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [err, setErr]             = useState<string | null>(null)
  const [form, setForm]           = useState({ account_id: '', zone_identifier: '', name: '' })
  const [loadingCf, setLoadingCf] = useState(false)

  const load = () => Promise.all([getZones(), getAccounts()]).then(([z, a]) => { setZones(z); setAccounts(a) }).catch(e => setErr((e as Error).message))
  useEffect(() => { load() }, [])

  const handleAccountChange = async (accountId: string) => {
    setForm(f => ({ ...f, account_id: accountId, zone_identifier: '', name: '' })); setCfZones([])
    if (!accountId) return
    setLoadingCf(true)
    try { setCfZones(await verifyAccount(Number(accountId))) } catch {}
    finally { setLoadingCf(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null)
    try {
      await createZone({ account_id: Number(form.account_id), zone_identifier: form.zone_identifier, name: form.name })
      setForm({ account_id: '', zone_identifier: '', name: '' }); setShowForm(false); setCfZones([]); load()
    } catch (e) { setErr((e as Error).message) }
  }

  const handleDelete = async () => {
    if (confirmId == null) return
    try { await deleteZone(confirmId); load() } catch (e) { setErr((e as Error).message) }
    setConfirmId(null)
  }

  const accountName = (id: number) => accounts.find(a => a.id === id)?.name ?? `account #${id}`

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: 22, fontWeight: 600, margin: 0 }}>// 0x02 zones</h1>
        <button onClick={() => setShowForm(s => !s)} style={btn()}>{showForm ? 'cancel' : '+ add zone'}</button>
      </div>
      {err && <p style={{ color: '#f87171', fontFamily: 'monospace', fontSize: 13, margin: '0 0 16px' }}>{err}</p>}
      {showForm && (
        <form onSubmit={handleSubmit} style={{ ...card, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ color: '#fbbf24', fontSize: 13 }}>new zone</div>
          <select style={input} value={form.account_id} onChange={e => handleAccountChange(e.target.value)} required>
            <option value="">select account…</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {loadingCf && <div style={{ color: '#6b7280', fontSize: 12 }}>loading cloudflare zones…</div>}
          {cfZones.length > 0 && (
            <div>
              <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 6 }}>pick from cloudflare</div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                {cfZones.map(z => (
                  <button key={z.id} type="button" onClick={() => setForm(f => ({ ...f, zone_identifier: z.id, name: z.name }))}
                    style={{ ...btn(form.zone_identifier === z.id ? '#fbbf24' : '#6b7280'), fontSize: 12 }}>{z.name}</button>
                ))}
              </div>
            </div>
          )}
          <input style={input} placeholder="zone identifier (CF zone ID)" value={form.zone_identifier} onChange={e => setForm(f => ({ ...f, zone_identifier: e.target.value }))} required />
          <input style={input} placeholder="label (e.g. example.com)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <button type="submit" style={btn()}>save</button>
        </form>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {zones.length === 0 && <p style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: 13 }}>no zones — add one above</p>}
        {zones.map(z => (
          <div key={z.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#e5e7eb', fontWeight: 600, marginBottom: 4 }}>{z.name}</div>
              <div style={{ color: '#6b7280', fontSize: 11 }}>{z.zone_identifier}</div>
              <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>via {accountName(z.account_id)}</div>
            </div>
            <button onClick={() => setConfirmId(z.id)} style={btn('#f87171')}>delete</button>
          </div>
        ))}
      </div>
      {confirmId != null && <ConfirmDialog message="Delete this zone? All records under it will also be deleted." onConfirm={handleDelete} onCancel={() => setConfirmId(null)} />}
    </div>
  )
}