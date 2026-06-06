import { useEffect, useState, useCallback } from 'react'
import type { StatusResponse } from '../types'
import { getStatus, syncAll, syncRecord } from '../api'
import SyncLogFeed from '../components/SyncLogFeed'

function parseDate(ts: string | null) {
  if (!ts) return new Date()
  if (!ts.includes('Z') && !ts.includes('+')) {
    return new Date(ts.replace(' ', 'T') + 'Z')
  }
  return new Date(ts)
}

function relTime(ts: string | null) {
  if (!ts) return 'never'
  const diff = Date.now() - parseDate(ts).getTime()
  if (diff < 60000) return `${Math.round(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`
  return parseDate(ts).toLocaleTimeString()
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

function CountdownTimer({ lastPollTime, pollInterval }: { lastPollTime: string | null; pollInterval: number }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!lastPollTime) return

    const calculate = () => {
      const last = parseDate(lastPollTime).getTime()
      const next = last + pollInterval * 1000
      const diff = Math.max(0, Math.round((next - Date.now()) / 1000))
      setSecondsLeft(diff)
    }

    calculate()
    const timer = setInterval(calculate, 1000)
    return () => clearInterval(timer)
  }, [lastPollTime, pollInterval])

  if (secondsLeft === null || !lastPollTime) return <div style={{ color: '#4b5563', fontSize: 9 }}>waiting...</div>
  if (secondsLeft === 0) return <div style={{ color: '#4ade80', fontSize: 9 }}>syncing...</div>

  const m = Math.floor(secondsLeft / 60)
  const s = secondsLeft % 60
  const timeStr = m > 0 ? `${m}m ${s}s` : `${s}s`

  return (
    <div style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: 9, marginTop: 4 }}>
      next: <span style={{ color: '#fbbf24' }}>{timeStr}</span>
    </div>
  )
}

function FlowDiagram({ ipV4, ipV6, lastPoll, recordCount, pollInterval }: { ipV4: string | null; ipV6: string | null; lastPoll: string | null; recordCount: number; pollInterval: number }) {
  const online = !!(ipV4 || ipV6)
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
              {ipV4 && <div style={{ color: '#e5e7eb', fontFamily: 'monospace', fontSize: 11, fontWeight: 600 }}>v4: {ipV4}</div>}
              {ipV6 && <div style={{ color: '#e5e7eb', fontFamily: 'monospace', fontSize: 11, fontWeight: 600, marginTop: 2 }}>v6: {ipV6}</div>}
              {!ipV4 && !ipV6 && <div style={{ color: '#4b5563', fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>—</div>}
            </div>
          </div>
        </div>

        {/* Arrow 1 with packet animation */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 16px', minWidth: 60 }}>
          <svg viewBox="0 0 100 8" preserveAspectRatio="none" style={{ width: '100%', height: 8, overflow: 'visible' }}>
            <line x1="0" y1="4" x2="100" y2="4" stroke="#252530" strokeWidth="1.5" strokeDasharray="4 4" />
            {online && (
              <line
                x1="0"
                y1="4"
                x2="100"
                y2="4"
                stroke="#fbbf24"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="25 75"
                opacity="0.25"
              >
                <animate attributeName="stroke-dashoffset" values="100;0" dur="6s" repeatCount="indefinite" />
              </line>
            )}
          </svg>
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
              {lastPoll && <CountdownTimer lastPollTime={lastPoll} pollInterval={pollInterval} />}
            </div>
          </div>
        </div>

        {/* Arrow 2 with staggered packet animation */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 16px', minWidth: 60 }}>
          <svg viewBox="0 0 100 8" preserveAspectRatio="none" style={{ width: '100%', height: 8, overflow: 'visible' }}>
            <line x1="0" y1="4" x2="100" y2="4" stroke="#252530" strokeWidth="1.5" strokeDasharray="4 4" />
            {online && (
              <line
                x1="0"
                y1="4"
                x2="100"
                y2="4"
                stroke="#fbbf24"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="25 75"
                opacity="0.25"
              >
                <animate attributeName="stroke-dashoffset" values="100;0" dur="6s" begin="2.5s" repeatCount="indefinite" />
              </line>
            )}
          </svg>
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

interface MetricCardProps {
  title: string
  value: string | number
  subText: string
  color: string
  accentColor: string
  sparkline: React.ReactNode
}

function MetricCard({ title, value, subText, color, accentColor, sparkline }: MetricCardProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#111115',
        border: '1px solid',
        borderColor: hovered ? accentColor : '#252530',
        borderLeft: `4px solid ${accentColor}`,
        borderRadius: 14,
        padding: '22px 24px',
        fontFamily: 'monospace',
        position: 'relative',
        transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 12px 30px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ color: '#4b5563', fontSize: 10, marginBottom: 10, letterSpacing: '0.05em' }}>{title}</div>
      <div style={{ color: color, fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>{subText}</div>
      {sparkline}
    </div>
  )
}

function RecordSyncButton({ id, onSyncComplete }: { id: number; onSyncComplete: () => void }) {
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const handleSync = async () => {
    setSyncing(true)
    setSyncStatus('idle')
    try {
      await syncRecord(id)
      setSyncStatus('success')
      onSyncComplete()
      setTimeout(() => setSyncStatus('idle'), 2000)
    } catch (e) {
      setSyncStatus('error')
      setTimeout(() => setSyncStatus('idle'), 4000)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      style={{
        background: 'transparent',
        border: 'none',
        color: syncStatus === 'success' ? '#4ade80' : syncStatus === 'error' ? '#f87171' : '#6b7280',
        cursor: syncing ? 'default' : 'pointer',
        padding: '4px 8px',
        fontFamily: 'monospace',
        fontSize: 11,
        borderRadius: 4,
        transition: 'color 0.15s',
        outline: 'none',
      }}
      onMouseEnter={e => {
        if (!syncing && syncStatus === 'idle') e.currentTarget.style.color = '#fbbf24'
      }}
      onMouseLeave={e => {
        if (!syncing && syncStatus === 'idle') e.currentTarget.style.color = '#6b7280'
      }}
    >
      {syncing ? 'syncing…' : syncStatus === 'success' ? '✓ done' : syncStatus === 'error' ? '✗ error' : '▸ sync'}
    </button>
  )
}

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
    <div style={{ maxWidth: 960 }}>
      <h1 style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: 22, fontWeight: 600, margin: '0 0 20px' }}>// 0x00 dashboard</h1>
      {error && <p style={{ color: '#f87171', fontFamily: 'monospace', fontSize: 13 }}>{error}</p>}

      <FlowDiagram
        ipV4={status?.publicIpV4 ?? null}
        ipV6={status?.publicIpV6 ?? null}
        lastPoll={status?.lastPollTime ?? null}
        recordCount={counts?.total ?? 0}
        pollInterval={status?.pollInterval ?? 300}
      />

      {/* Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        <MetricCard
          title="total records"
          value={counts?.total ?? '—'}
          subText={`${counts?.synced ?? 0} synced`}
          color="#e5e7eb"
          accentColor="#fbbf24"
          sparkline={
            <svg width="60" height="24" viewBox="0 0 60 24" fill="none" style={{ position: 'absolute', bottom: 18, right: 18, opacity: 0.3 }}>
              <path d="M 5,12 L 20,8 L 35,16 L 55,10" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="5" cy="12" r="2" fill="#fbbf24" />
              <circle cx="20" cy="8" r="2" fill="#fbbf24" />
              <circle cx="35" cy="16" r="2" fill="#fbbf24" />
              <circle cx="55" cy="10" r="2" fill="#fbbf24" />
            </svg>
          }
        />
        <MetricCard
          title="last updated"
          value={counts?.updated ?? '—'}
          subText="records changed"
          color="#4ade80"
          accentColor="#4ade80"
          sparkline={
            <svg width="60" height="24" viewBox="0 0 60 24" fill="none" style={{ position: 'absolute', bottom: 18, right: 18, opacity: 0.35 }}>
              <path d="M 5,14 H 18 L 24,4 L 30,20 L 36,14 H 55" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <MetricCard
          title="errors"
          value={counts?.errors ?? '—'}
          subText="failed syncs"
          color={counts?.errors ? '#f87171' : '#e5e7eb'}
          accentColor={counts?.errors ? '#f87171' : '#4b5563'}
          sparkline={
            <svg width="60" height="24" viewBox="0 0 60 24" fill="none" style={{ position: 'absolute', bottom: 18, right: 18, opacity: 0.25 }}>
              <path d="M 10,18 C 15,10 25,6 35,18 S 45,6 50,14" stroke={counts?.errors ? '#f87171' : '#4b5563'} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />
            </svg>
          }
        />
      </div>

      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={handleSyncAll}
          disabled={syncing}
          style={{ padding: '10px 22px', borderRadius: 10, border: '1px solid rgba(251,191,36,0.5)', background: syncing ? 'rgba(251,191,36,0.04)' : 'rgba(251,191,36,0.1)', color: '#fbbf24', cursor: syncing ? 'default' : 'pointer', fontFamily: 'monospace', fontSize: 13, transition: 'all 0.15s' }}
          onMouseEnter={e => { if (!syncing) e.currentTarget.style.background = 'rgba(251,191,36,0.18)' }}
          onMouseLeave={e => { if (!syncing) e.currentTarget.style.background = 'rgba(251,191,36,0.1)' }}
        >
          {syncing ? 'syncing all…' : 'sync all now'}
        </button>
        {syncMsg && <span style={{ color: '#9ca3af', fontSize: 13, fontFamily: 'monospace' }}>{syncMsg}</span>}
      </div>

      {/* Two Column Layout (Monitored Records & Recent Activity) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24 }}>
        <div>
          <h2 style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: 13, fontWeight: 500, margin: '0 0 14px' }}>// 0x01 monitored dns records</h2>
          
          {!status?.records || status.records.length === 0 ? (
            <div style={{ background: '#111115', border: '1px solid #252530', borderRadius: 14, padding: '36px 24px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace', fontSize: 13 }}>
              no records registered yet.
              <div style={{ marginTop: 12 }}>
                <a href="/accounts" style={{ color: '#fbbf24', textDecoration: 'none', borderBottom: '1px dashed #fbbf24', paddingBottom: 2 }}>+ connect an account</a>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {status.records.map(rec => (
                <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: '#111115', border: '1px solid #252530', borderRadius: 10, fontFamily: 'monospace', fontSize: 12 }}>
                  {/* Status Indicator */}
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: rec.last_status === 'updated' ? '#4ade80' : rec.last_status === 'error' ? '#f87171' : '#4b5563', boxShadow: rec.last_status === 'updated' ? '0 0 6px #4ade80' : 'none' }} />
                  
                  {/* Name */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#e5e7eb', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.record_name}</div>
                    <div style={{ color: '#4b5563', fontSize: 10, marginTop: 2 }}>checked {rec.last_checked_at ? relTime(rec.last_checked_at) : 'never'}</div>
                  </div>

                  {/* Synced IP */}
                  <div style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.12)', padding: '4px 10px', borderRadius: 6, fontSize: 11 }}>
                    {rec.last_ip ?? 'no resolution'}
                  </div>

                  {/* Actions */}
                  <RecordSyncButton id={rec.id} onSyncComplete={load} />
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div>
          <h2 style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: 13, fontWeight: 500, margin: '0 0 14px' }}>// 0x02 recent activity</h2>
          <SyncLogFeed logs={status?.recentLogs ?? []} />
        </div>
      </div>
    </div>
  )
}
