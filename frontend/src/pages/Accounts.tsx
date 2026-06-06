import { useEffect, useState } from 'react'
import type { Account, CfZone } from '../types'
import { getAccounts, createAccount, updateAccount, deleteAccount, verifyAccount, getAccountKey } from '../api'
import MaskedKey from '../components/MaskedKey'
import ConfirmDialog from '../components/ConfirmDialog'

const card  = { background: '#111115', border: '1px solid #252530', borderRadius: 16, padding: 24, fontFamily: 'monospace' }
const input = { background: '#0d0d0f', border: '1px solid #252530', borderRadius: 8, color: '#e5e7eb', fontFamily: 'monospace', fontSize: 13, padding: '8px 12px', width: '100%' as const }
const btn   = (color = '#fbbf24') => ({ padding: '8px 16px', borderRadius: 8, border: `1px solid ${color}`, background: `${color}18`, color, cursor: 'pointer' as const, fontFamily: 'monospace', fontSize: 12 })

type FormState = { name: string; auth_email: string; auth_method: 'global' | 'token'; auth_key: string }
const EMPTY: FormState = { name: '', auth_email: '', auth_method: 'global', auth_key: '' }

export default function Accounts() {
  const [accounts, setAccounts]   = useState<Account[]>([])
  const [form, setForm]           = useState<FormState>(EMPTY)
  const [editing, setEditing]     = useState<number | null>(null)
  const [showForm, setShowForm]   = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [zones, setZones]         = useState<CfZone[] | null>(null)
  const [zonesFor, setZonesFor]   = useState<number | null>(null)
  const [verifying, setVerifying] = useState<number | null>(null)
  const [err, setErr]             = useState<string | null>(null)

  const load = () => getAccounts().then(setAccounts).catch(e => setErr((e as Error).message))
  useEffect(() => { load() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null)
    try {
      if (editing != null) {
        // HIGH-4: only send auth_key if the user typed a new one; empty = keep existing
        const fields: Partial<FormState> = { name: form.name, auth_email: form.auth_email, auth_method: form.auth_method }
        if (form.auth_key !== '') fields.auth_key = form.auth_key
        await updateAccount(editing, fields)
      } else {
        await createAccount(form)
      }
      setForm(EMPTY); setShowForm(false); setEditing(null); load()
    } catch (e) { setErr((e as Error).message) }
  }

  const handleEdit = (a: Account) => {
    // auth_key is not included in list responses — leave blank; backend keeps existing if not changed
    setForm({ name: a.name, auth_email: a.auth_email, auth_method: a.auth_method, auth_key: '' })
    setEditing(a.id); setShowForm(true)
  }

  const handleDelete = async () => {
    if (confirmId == null) return
    try { await deleteAccount(confirmId); load() } catch (e) { setErr((e as Error).message) }
    setConfirmId(null)
  }

  const handleVerify = async (id: number) => {
    setVerifying(id); setZones(null); setZonesFor(id); setErr(null)
    try { setZones(await verifyAccount(id)) } catch (e) { setErr((e as Error).message) }
    finally { setVerifying(null) }
  }

  // HIGH-4: fetch the key on demand via the dedicated endpoint
  const handleRevealKey = async (id: number): Promise<string> => {
    const { auth_key } = await getAccountKey(id)
    return auth_key
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: 22, fontWeight: 600, margin: 0 }}>// 0x01 accounts</h1>
        <button onClick={() => { setShowForm(s => !s); setEditing(null); setForm(EMPTY) }} style={btn()}>{showForm ? 'cancel' : '+ add account'}</button>
      </div>
      {err && <p style={{ color: '#f87171', fontFamily: 'monospace', fontSize: 13, margin: '0 0 16px' }}>{err}</p>}
      {showForm && (
        <form onSubmit={handleSubmit} style={{ ...card, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ color: '#fbbf24', fontSize: 13 }}>{editing ? 'edit account' : 'new account'}</div>
          <input style={input} placeholder="label" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <input style={input} placeholder="email" type="email" value={form.auth_email} onChange={e => setForm(f => ({ ...f, auth_email: e.target.value }))} required />
          <select style={input} value={form.auth_method} onChange={e => setForm(f => ({ ...f, auth_method: e.target.value as 'global' | 'token' }))}>
            <option value="global">Global API Key</option>
            <option value="token">API Token</option>
          </select>
          <input
            style={input}
            placeholder={editing ? 'New API key (leave blank to keep existing)' : (form.auth_method === 'global' ? 'Global API Key' : 'Bearer Token')}
            value={form.auth_key}
            onChange={e => setForm(f => ({ ...f, auth_key: e.target.value }))}
            required={editing == null}
          />
          <button type="submit" style={btn()}>save</button>
        </form>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {accounts.length === 0 && <p style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: 13 }}>no accounts — add one above</p>}
        {accounts.map(a => (
          <div key={a.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: '#e5e7eb', fontWeight: 600, marginBottom: 6 }}>{a.name}</div>
                <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>{a.auth_email}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#6b7280', fontSize: 11, padding: '2px 6px', border: '1px solid #252530', borderRadius: 4 }}>{a.auth_method}</span>
                  <MaskedKey accountId={a.id} onReveal={handleRevealKey} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleVerify(a.id)} disabled={verifying === a.id} style={btn('#4ade80')}>{verifying === a.id ? 'checking…' : 'verify'}</button>
                <button onClick={() => handleEdit(a)} style={btn()}>edit</button>
                <button onClick={() => setConfirmId(a.id)} style={btn('#f87171')}>delete</button>
              </div>
            </div>
            {zonesFor === a.id && zones && (
              <div style={{ marginTop: 16, borderTop: '1px solid #252530', paddingTop: 12 }}>
                <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 8 }}>cloudflare zones ({zones.length})</div>
                {zones.map(z => (
                  <div key={z.id} style={{ fontSize: 12, padding: '4px 0' }}>
                    <span style={{ color: '#e5e7eb' }}>{z.name}</span>
                    <span style={{ color: '#6b7280', marginLeft: 12 }}>{z.id}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {confirmId != null && <ConfirmDialog message="Delete this account? All zones and records under it will also be deleted." onConfirm={handleDelete} onCancel={() => setConfirmId(null)} />}
    </div>
  )
}
