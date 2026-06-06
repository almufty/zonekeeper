import { useEffect, useState } from 'react'
import type { DnsRecord, Zone, Account, CfDnsRecord } from '../types'
import { getRecords, createRecord, updateRecord, deleteRecord, syncRecord, getZones, getAccounts, getAccountZoneRecords } from '../api'
import StatusBadge from '../components/StatusBadge'
import ConfirmDialog from '../components/ConfirmDialog'

const card  = { background: '#111115', border: '1px solid #252530', borderRadius: 16, padding: 24, fontFamily: 'monospace' }
const input = { background: '#0d0d0f', border: '1px solid #252530', borderRadius: 8, color: '#e5e7eb', fontFamily: 'monospace', fontSize: 13, padding: '8px 12px', width: '100%' as const }
const btn   = (color = '#fbbf24') => ({ padding: '6px 14px', borderRadius: 8, border: `1px solid ${color}`, background: `${color}18`, color, cursor: 'pointer' as const, fontFamily: 'monospace', fontSize: 12 })
const EMPTY = { zone_id: '', record_name: '', ttl: '3600', proxied: false, enabled: true, cloudflare_record_id: '' }

export default function Records() {
  const [records, setRecords]     = useState<DnsRecord[]>([])
  const [zones, setZones]         = useState<Zone[]>([])
  const [accounts, setAccounts]   = useState<Account[]>([])
  const [filterZone, setFilter]   = useState<string>('')
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState(EMPTY)
  const [cfRecords, setCfRecords] = useState<CfDnsRecord[]>([])
  const [syncing, setSyncing]     = useState<number | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [err, setErr]             = useState<string | null>(null)

  const load = () => {
    const zid = filterZone ? Number(filterZone) : undefined
    Promise.all([getRecords(zid), getZones(), getAccounts()])
      .then(([r, z, a]) => { setRecords(r); setZones(z); setAccounts(a) })
      .catch(e => setErr((e as Error).message))
  }
  useEffect(() => { load() }, [filterZone])

  const handleZoneFormChange = async (zoneId: string) => {
    setForm(f => ({ ...f, zone_id: zoneId, record_name: '', cloudflare_record_id: '' })); setCfRecords([])
    const zone = zones.find(z => z.id === Number(zoneId)); if (!zone) return
    const account = accounts.find(a => a.id === zone.account_id); if (!account) return
    try { setCfRecords(await getAccountZoneRecords(account.id, zone.zone_identifier)) } catch {}
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null)
    try {
      await createRecord({ zone_id: Number(form.zone_id), record_name: form.record_name, ttl: Number(form.ttl), proxied: form.proxied, enabled: form.enabled, cloudflare_record_id: form.cloudflare_record_id || undefined })
      setForm(EMPTY); setShowForm(false); setCfRecords([]); load()
    } catch (e) { setErr((e as Error).message) }
  }

  const handleToggle = async (r: DnsRecord, field: 'proxied' | 'enabled') => {
    try { await updateRecord(r.id, { [field]: !r[field] }); load() } catch (e) { setErr((e as Error).message) }
  }

  const handleSync = async (id: number) => {
    setSyncing(id)
    try { await syncRecord(id); load() } catch (e) { setErr((e as Error).message) }
    finally { setSyncing(null) }
  }

  const handleDelete = async () => {
    if (confirmId == null) return
    try { await deleteRecord(confirmId); load() } catch (e) { setErr((e as Error).message) }
    setConfirmId(null)
  }

  const zoneName  = (id: number) => zones.find(z => z.id === id)?.name ?? `zone #${id}`
  const displayed = filterZone ? records.filter(r => r.zone_id === Number(filterZone)) : records

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: 22, fontWeight: 600, margin: 0 }}>// 0x03 records</h1>
        <div style={{ display: 'flex', gap: 12 }}>
          <select style={{ ...input, width: 'auto' }} value={filterZone} onChange={e => setFilter(e.target.value)}>
            <option value="">all zones</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          <button onClick={() => setShowForm(s => !s)} style={btn()}>{showForm ? 'cancel' : '+ add record'}</button>
        </div>
      </div>
      {err && <p style={{ color: '#f87171', fontFamily: 'monospace', fontSize: 13, margin: '0 0 16px' }}>{err}</p>}
      {showForm && (
        <form onSubmit={handleSubmit} style={{ ...card, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ color: '#fbbf24', fontSize: 13 }}>new record</div>
          <select style={input} value={form.zone_id} onChange={e => handleZoneFormChange(e.target.value)} required>
            <option value="">select zone…</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          {cfRecords.length > 0 && (
            <div>
              <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 6 }}>pick from cloudflare</div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                {cfRecords.map(r => (
                  <button key={r.id} type="button" onClick={() => setForm(f => ({ ...f, record_name: r.name, cloudflare_record_id: r.id }))}
                    style={{ ...btn(form.record_name === r.name ? '#fbbf24' : '#6b7280'), fontSize: 12 }}>{r.name}</button>
                ))}
              </div>
            </div>
          )}
          <input style={input} placeholder="record name (e.g. ddns.example.com)" value={form.record_name} onChange={e => setForm(f => ({ ...f, record_name: e.target.value }))} required />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input style={{ ...input, flex: 1 }} placeholder="TTL (seconds)" type="number" value={form.ttl} onChange={e => setForm(f => ({ ...f, ttl: e.target.value }))} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9ca3af', fontSize: 13, whiteSpace: 'nowrap' as const }}>
              <input type="checkbox" checked={form.proxied} onChange={e => setForm(f => ({ ...f, proxied: e.target.checked }))} /> proxied
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9ca3af', fontSize: 13, whiteSpace: 'nowrap' as const }}>
              <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} /> enabled
            </label>
          </div>
          <button type="submit" style={btn()}>save</button>
        </form>
      )}
      {displayed.length === 0 && <p style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: 13 }}>no records — add one above</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {displayed.map(r => (
          <div key={r.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' as const, gap: 12 }}>
              <div>
                <div style={{ color: '#e5e7eb', fontWeight: 600, marginBottom: 4 }}>{r.record_name}</div>
                <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 8 }}>{zoneName(r.zone_id)}</div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const }}>
                  <StatusBadge status={r.last_status} />
                  {r.last_ip && <span style={{ color: '#9ca3af', fontSize: 12 }}>{r.last_ip}</span>}
                  <span style={{ color: '#6b7280', fontSize: 11 }}>ttl {r.ttl}</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6b7280', fontSize: 11, cursor: 'pointer' }}>
                    <input type="checkbox" checked={r.proxied} onChange={() => handleToggle(r, 'proxied')} /> proxied
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6b7280', fontSize: 11, cursor: 'pointer' }}>
                    <input type="checkbox" checked={r.enabled} onChange={() => handleToggle(r, 'enabled')} /> enabled
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleSync(r.id)} disabled={syncing === r.id} style={btn('#4ade80')}>{syncing === r.id ? 'syncing…' : 'sync now'}</button>
                <button onClick={() => setConfirmId(r.id)} style={btn('#f87171')}>delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {confirmId != null && <ConfirmDialog message="Delete this record? Sync history will also be deleted." onConfirm={handleDelete} onCancel={() => setConfirmId(null)} />}
    </div>
  )
}