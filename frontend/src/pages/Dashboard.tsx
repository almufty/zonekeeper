import { useEffect, useState, useCallback } from 'react'
import type { StatusResponse } from '../types'
import { getStatus, syncAll } from '../api'
import SyncLogFeed from '../components/SyncLogFeed'

function relTime(ts: string | null) {
  if (!ts) return 'never'
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60000) return `${Math.round(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`
  return new Date(ts).toLocaleTimeString()
}

function MonitorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function ZkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <line x1="2" y1="12" x2="9" y2="12" />
      <line x1="15" y1="12" x2="22" y2="12" />
      <line x1="12" y1="2" x2="12" y2="9" />
      <line x1="12" y1="15" x2="12" y2="22" />
    </svg>
  )
}

function FlowDiagram({ ip, lastPoll, recordCount }: { ip: string | null; lastPoll: string | null; recordCount: number }) {
  const online = !!ip
  return (
    <div style={{ marginBottom: 28, padding: '22px 28px', background: '#111115', border: '1px solid #252530', borderRadius: 16, position: 'relative', overflow: 'hidden' }}>
      {/* dot-grid */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, #1e1e26 1px, transparent 1px)', backgroundSize: '22px 22px', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 0 }}>

        {/* Node: Your IP */}
        <div style={{ flex: '0 0 auto', minWidth: 120 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${online ? '#4ade80' : '#374151'}`, background: online ? 'rgba(74,222,128,0.08)' : 'rgba(55,65,81,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: online ? '#4ade80' : '#4b5563', flexShrink: 0, position: 'relative' }}>
              <MonitorIcon />
              {online && (
                <span style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 0 2px #0d0d0f' }}>
                  <style>{`@keyframes zkpulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.6)} }`}</style>
                  <span style={{ display: 'block', width: 8, height: 8, borderRadius: '50%', background: '#4ade80', animation: 'zkpulse 2s ease-in-out infinite' }} />
                </span>
              )}
            </div>
            <div>
              <div style={{ color: '#4b5563', fontFamily: 'monospace', fontSize: 10, marginBottom: 2 }}>your ip</div>
              <div style={{ color: online ? '#e5e7eb' : '#4b5563', fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>{ip ?? '—'}</div>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 12px', minWidth: 40 }}>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #252530 0%, rgba(251,191,36,0.3) 50%, #252530 100%)' }} />
          <span style={{ color: 'rgba(251,191,36,0.4)', fontFamily: 'monospace', fontSize: 12, margin: '0 4px', flexShrink: 0 }}>▸</span>
        </div>

        {/* Node: ZoneKeeper */}
        <div style={{ flex: '0 0 auto', minWidth: 120 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24', flexShrink: 0 }}>
              <ZkIcon />
            </div>
            <div>
              <div style={{ color: '#4b5563', fontFamily: 'monospace', fontSize: 10, marginBottom: 2 }}>zonekeeper</div>
              <div style={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: 11 }}>{lastPoll ? relTime(lastPoll) : 'waiting…'}</div>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 12px', minWidth: 40 }}>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #252530 0%, rgba(251,191,36,0.3) 50%, #252530 100%)' }} />
          <span style={{ color: 'rgba(251,191,36,0.4)', fontFamily: 'monospace', fontSize: 12, margin: '0 4px', flexShrink: 0 }}>▸</span>
        </div>

        {/* Node: Cloudflare DNS */}
        <div style={{ flex: '0 0 auto', minWidth: 120 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid #374151', background: 'rgba(55,65,81,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', flexShrink: 0 }}>
              <GlobeIcon />
            </div>
            <div>
              <div style={{ color: '#4b5563', fontFamily: 'monospace', fontSize: 10, marginBottom: 2 }}>cloudflare dns</div>
              <div style={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: 11 }}>{recordCount} record{recordCount !== 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

const card: React.CSSProperties = { background: '#111115', border: '1px solid #252530', borderRadius: 14, padding: '20px 22px', fontFamily: 'monospace' }

export default function Dashboard() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setStatus(await getStatus()) } catch (e) { setError((e as Error).message) }
  }, [])

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id) }, [load])

  const handleSyncAll = async () => {
    setSyncing(true); setSyncMsg(null)
    try {
      const res = await syncAll()
      const updated = res.results.filter(r => r.status === 'updated').length
      const errors  = res.results.filter(r => r.status === 'error').length
      setSyncMsg(`sync complete — ${updated} updated, ${errors} errors`)
      await load()
    } catch (e) { setSyncMsg(`error: ${(e as Error).message}`) }
    finally { setSyncing(false) }
  }

  const counts = status ? {
    total:   status.records.length,
    updated: status.records.filter(r => r.last_status === 'updated').length,
    errors:  status.records.filter(r => r.last_status === 'error').length,
    synced:  status.records.filter(r => r.last_ip).length,
  } : null

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: 22, fontWeight: 600, margin: '0 0 20px' }}>// 0x00 dashboard</h1>
      {error && <p style={{ color: '#f87171', fontFamily: 'monospace', fontSize: 13 }}>{error}</p>}

      <FlowDiagram
        ip={status?.publicIp ?? null}
        lastPoll={status?.lastPollTime ?? null}
        recordCount={counts?.total ?? 0}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        <div style={card}>
          <div style={{ color: '#4b5563', fontSize: 10, marginBottom: 10, letterSpacing: '0.04em' }}>total records</div>
          <div style={{ color: '#e5e7eb', fontSize: 26, fontWeight: 700 }}>{counts?.total ?? '—'}</div>
          <div style={{ color: '#4b5563', fontSize: 11, marginTop: 4 }}>{counts?.synced ?? 0} synced</div>
        </div>
        <div style={card}>
          <div style={{ color: '#4b5563', fontSize: 10, marginBottom: 10, letterSpacing: '0.04em' }}>last updated</div>
          <div style={{ color: '#4ade80', fontSize: 26, fontWeight: 700 }}>{counts?.updated ?? '—'}</div>
          <div style={{ color: '#4b5563', fontSize: 11, marginTop: 4 }}>records changed</div>
        </div>
        <div style={card}>
          <div style={{ color: '#4b5563', fontSize: 10, marginBottom: 10, letterSpacing: '0.04em' }}>errors</div>
          <div style={{ color: counts?.errors ? '#f87171' : '#e5e7eb', fontSize: 26, fontWeight: 700 }}>{counts?.errors ?? '—'}</div>
          <div style={{ color: '#4b5563', fontSize: 11, marginTop: 4 }}>failed syncs</div>
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <button
          onClick={handleSyncAll}
          disabled={syncing}
          style={{ padding: '10px 22px', borderRadius: 10, border: '1px solid rgba(251,191,36,0.5)', background: syncing ? 'rgba(251,191,36,0.04)' : 'rgba(251,191,36,0.1)', color: '#fbbf24', cursor: syncing ? 'default' : 'pointer', fontFamily: 'monospace', fontSize: 13 }}
        >
          {syncing ? 'syncing…' : 'sync all now'}
        </button>
        {syncMsg && <span style={{ marginLeft: 16, color: '#9ca3af', fontSize: 13, fontFamily: 'monospace' }}>{syncMsg}</span>}
      </div>

      <div>
        <h2 style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: 13, fontWeight: 500, margin: '0 0 14px' }}>// 0x01 recent activity</h2>
        <SyncLogFeed logs={status?.recentLogs ?? []} />
      </div>
    </div>
  )
}
