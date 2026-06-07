import { useEffect, useState, FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { changePassword, getSettings, updateSettings, getBackupConfig, restoreBackupConfig, revealSettingsSecrets } from '../api'

const card: React.CSSProperties = { background: '#111115', border: '1px solid #252530', borderRadius: 16, padding: 24 }

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0d0d0f',
  border: '1px solid #252530',
  borderRadius: 8,
  padding: '10px 12px',
  color: '#e5e7eb',
  fontFamily: 'monospace',
  fontSize: 13,
  outline: 'none',
  transition: 'border-color 0.15s',
}

const btnStyle = (color = '#fbbf24') => ({
  marginTop: 4,
  padding: '10px 20px',
  borderRadius: 10,
  border: `1px solid ${color}80`,
  background: `${color}10`,
  color,
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 13,
  alignSelf: 'flex-start',
  transition: 'background 0.15s',
})

export default function Settings() {
  const { user, logout } = useAuth()
  
  // Password state
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [pwdLoading, setPwdLoading] = useState(false)

  // System settings state
  const [pollInterval, setPollInterval] = useState<string>('300')
  const [logRetention, setLogRetention] = useState<string>('30')
  const [discordUrl, setDiscordUrl] = useState('')
  const [tgToken, setTgToken] = useState('')
  const [tgChatId, setTgChatId] = useState('')
  const [notifySuccess, setNotifySuccess] = useState(false)
  const [notifyError, setNotifyError] = useState(true)
  const [secretsRevealed, setSecretsRevealed] = useState(false)
  const [sysMsg, setSysMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [sysLoading, setSysLoading] = useState(false)

  // Backup / Restore state
  const [backupLoading, setBackupLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [backupMsg, setBackupMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Load settings on mount
  useEffect(() => {
    getSettings()
      .then(data => {
        setPollInterval(String(data.poll_interval))
        setLogRetention(String(data.log_retention_days))
        setDiscordUrl(data.discord_webhook_url || '')
        setTgToken(data.telegram_bot_token || '')
        setTgChatId(data.telegram_chat_id || '')
        setNotifySuccess(data.notify_on_success)
        setNotifyError(data.notify_on_error)
      })
      .catch(err => {
        setSysMsg({ type: 'err', text: `Failed to load settings: ${err.message}` })
      })
  }, [])

  // L-3: secrets arrive masked; fetch the real values only when the admin opts in.
  const handleRevealSecrets = async () => {
    try {
      const secrets = await revealSettingsSecrets()
      setDiscordUrl(secrets.discord_webhook_url)
      setTgToken(secrets.telegram_bot_token)
      setSecretsRevealed(true)
    } catch (err) {
      setSysMsg({ type: 'err', text: `Failed to reveal secrets: ${(err as Error).message}` })
    }
  }

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (next !== confirm) return setPwdMsg({ type: 'err', text: 'New passwords do not match' })
    if (next.length < 8) return setPwdMsg({ type: 'err', text: 'Password must be at least 8 characters' })
    setPwdLoading(true)
    setPwdMsg(null)
    try {
      await changePassword(current, next)
      setPwdMsg({ type: 'ok', text: 'Password updated successfully' })
      setCurrent(''); setNext(''); setConfirm('')
    } catch (err) {
      setPwdMsg({ type: 'err', text: (err as Error).message })
    } finally {
      setPwdLoading(false)
    }
  }

  const handleSystemSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const interval = parseInt(pollInterval, 10)
    const retention = parseInt(logRetention, 10)

    if (isNaN(interval) || interval < 60) {
      return setSysMsg({ type: 'err', text: 'Poll interval must be at least 60 seconds.' })
    }
    if (isNaN(retention) || retention < 1) {
      return setSysMsg({ type: 'err', text: 'Log retention must be at least 1 day.' })
    }

    setSysLoading(true)
    setSysMsg(null)
    try {
      await updateSettings({
        poll_interval: interval,
        log_retention_days: retention,
        discord_webhook_url: discordUrl,
        telegram_bot_token: tgToken,
        telegram_chat_id: tgChatId,
        notify_on_success: notifySuccess,
        notify_on_error: notifyError
      })
      setSysMsg({ type: 'ok', text: 'System settings saved successfully' })
    } catch (err) {
      setSysMsg({ type: 'err', text: (err as Error).message })
    } finally {
      setSysLoading(false)
    }
  }

  const handleBackupDownload = async () => {
    setBackupLoading(true)
    setBackupMsg(null)
    try {
      const data = await getBackupConfig()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `zonekeeper-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setBackupMsg({ type: 'ok', text: 'Backup downloaded successfully' })
    } catch (err) {
      setBackupMsg({ type: 'err', text: `Backup failed: ${(err as Error).message}` })
    } finally {
      setBackupLoading(false)
    }
  }

  const handleRestoreUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!window.confirm('Warning: Restoring this backup will completely overwrite your current accounts, zones, records, and sync logs. Do you want to proceed?')) {
      e.target.value = ''
      return
    }

    setRestoreLoading(true)
    setBackupMsg(null)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      await restoreBackupConfig(data)
      setBackupMsg({ type: 'ok', text: 'Configuration restored successfully! Refreshing page...' })
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (err) {
      setBackupMsg({ type: 'err', text: `Restore failed: ${(err as Error).message}` })
    } finally {
      setRestoreLoading(false)
      e.target.value = ''
    }
  }

  return (
    <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: 22, fontWeight: 600, margin: 0 }}>// 0x04 settings</h1>

      {/* Info Panel */}
      <div style={card}>
        <div style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: 11, marginBottom: 4 }}>logged in as</div>
        <div style={{ color: '#e5e7eb', fontFamily: 'monospace', fontSize: 15, fontWeight: 600 }}>{user?.username}</div>
      </div>

      {/* System Settings Panel */}
      <div style={card}>
        <h2 style={{ color: '#e5e7eb', fontFamily: 'monospace', fontSize: 13, fontWeight: 600, margin: '0 0 20px' }}>system configuration</h2>
        <form onSubmit={handleSystemSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', color: '#6b7280', fontFamily: 'monospace', fontSize: 11, marginBottom: 6 }}>
                poll interval (seconds, min 60s)
              </label>
              <input
                type="number"
                min="60"
                value={pollInterval}
                onChange={e => setPollInterval(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#fbbf24')}
                onBlur={e => (e.target.style.borderColor = '#252530')}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#6b7280', fontFamily: 'monospace', fontSize: 11, marginBottom: 6 }}>
                log retention days (min 1 day)
              </label>
              <input
                type="number"
                min="1"
                value={logRetention}
                onChange={e => setLogRetention(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#fbbf24')}
                onBlur={e => (e.target.style.borderColor = '#252530')}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#6b7280', fontFamily: 'monospace', fontSize: 11, marginBottom: 6 }}>
              <span>discord webhook url</span>
              {!secretsRevealed && (
                <button
                  type="button"
                  onClick={handleRevealSecrets}
                  style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', fontFamily: 'monospace', fontSize: 11, padding: 0 }}
                >
                  reveal secrets
                </button>
              )}
            </label>
            <input
              type="text"
              placeholder="https://discord.com/api/webhooks/..."
              value={discordUrl}
              onChange={e => { setDiscordUrl(e.target.value); setSecretsRevealed(true) }}
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#fbbf24')}
              onBlur={e => (e.target.style.borderColor = '#252530')}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', color: '#6b7280', fontFamily: 'monospace', fontSize: 11, marginBottom: 6 }}>
                telegram bot token
              </label>
              <input
                type="password"
                placeholder="123456:ABC..."
                value={tgToken}
                onChange={e => { setTgToken(e.target.value); setSecretsRevealed(true) }}
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#fbbf24')}
                onBlur={e => (e.target.style.borderColor = '#252530')}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#6b7280', fontFamily: 'monospace', fontSize: 11, marginBottom: 6 }}>
                telegram chat id
              </label>
              <input
                type="text"
                placeholder="-1001234567"
                value={tgChatId}
                onChange={e => setTgChatId(e.target.value)}
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#fbbf24')}
                onBlur={e => (e.target.style.borderColor = '#252530')}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e5e7eb', fontFamily: 'monospace', fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={notifySuccess}
                onChange={e => setNotifySuccess(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: '#fbbf24' }}
              />
              notify on success
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e5e7eb', fontFamily: 'monospace', fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={notifyError}
                onChange={e => setNotifyError(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: '#fbbf24' }}
              />
              notify on error
            </label>
          </div>

          {sysMsg && (
            <div style={{ background: sysMsg.type === 'ok' ? 'rgba(74,222,128,0.07)' : 'rgba(248,113,113,0.07)', border: `1px solid ${sysMsg.type === 'ok' ? 'rgba(74,222,128,0.18)' : 'rgba(248,113,113,0.18)'}`, borderRadius: 8, padding: '8px 12px', color: sysMsg.type === 'ok' ? '#4ade80' : '#f87171', fontFamily: 'monospace', fontSize: 12 }}>
              {sysMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={sysLoading}
            style={btnStyle()}
            onMouseEnter={e => { if (!sysLoading) e.currentTarget.style.background = 'rgba(251,191,36,0.18)' }}
            onMouseLeave={e => { if (!sysLoading) e.currentTarget.style.background = 'rgba(251,191,36,0.1)' }}
          >
            {sysLoading ? 'saving…' : 'save system settings'}
          </button>
        </form>
      </div>

      {/* Backup & Restore Panel */}
      <div style={card}>
        <h2 style={{ color: '#e5e7eb', fontFamily: 'monospace', fontSize: 13, fontWeight: 600, margin: '0 0 20px' }}>backup & restore</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: 12, margin: 0, lineHeight: '1.5' }}>
            Export your entire Zonekeeper configuration (accounts, zones, records, and system settings) to a portable JSON file, or restore it from an existing backup.
          </p>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
            <button
              onClick={handleBackupDownload}
              disabled={backupLoading}
              style={{ ...btnStyle(), marginTop: 0 }}
              onMouseEnter={e => { if (!backupLoading) e.currentTarget.style.background = 'rgba(251,191,36,0.18)' }}
              onMouseLeave={e => { if (!backupLoading) e.currentTarget.style.background = 'rgba(251,191,36,0.1)' }}
            >
              {backupLoading ? 'downloading…' : 'export configuration'}
            </button>

            <label style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: '1px solid #252530',
              background: '#1a1a24',
              color: '#e5e7eb',
              cursor: restoreLoading ? 'not-allowed' : 'pointer',
              fontFamily: 'monospace',
              fontSize: 13,
              display: 'inline-block',
              textAlign: 'center',
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => { if (!restoreLoading) e.currentTarget.style.background = '#252535' }}
            onMouseLeave={e => { if (!restoreLoading) e.currentTarget.style.background = '#1a1a24' }}
            >
              {restoreLoading ? 'restoring…' : 'import backup'}
              <input
                type="file"
                accept=".json"
                onChange={handleRestoreUpload}
                disabled={restoreLoading}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {backupMsg && (
            <div style={{
              background: backupMsg.type === 'ok' ? 'rgba(74,222,128,0.07)' : 'rgba(248,113,113,0.07)',
              border: `1px solid ${backupMsg.type === 'ok' ? 'rgba(74,222,128,0.18)' : 'rgba(248,113,113,0.18)'}`,
              borderRadius: 8,
              padding: '8px 12px',
              color: backupMsg.type === 'ok' ? '#4ade80' : '#f87171',
              fontFamily: 'monospace',
              fontSize: 12
            }}>
              {backupMsg.text}
            </div>
          )}
        </div>
      </div>

      {/* Change Password Panel */}
      <div style={card}>
        <h2 style={{ color: '#e5e7eb', fontFamily: 'monospace', fontSize: 13, fontWeight: 600, margin: '0 0 20px' }}>change password</h2>
        <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'current password', val: current, set: setCurrent },
            { label: 'new password',     val: next,    set: setNext    },
            { label: 'confirm new',      val: confirm, set: setConfirm },
          ].map(({ label, val, set }) => (
            <div key={label}>
              <label style={{ display: 'block', color: '#6b7280', fontFamily: 'monospace', fontSize: 11, marginBottom: 6 }}>{label}</label>
              <input
                type="password"
                value={val}
                onChange={e => set(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#fbbf24')}
                onBlur={e => (e.target.style.borderColor = '#252530')}
              />
            </div>
          ))}

          {pwdMsg && (
            <div style={{ background: pwdMsg.type === 'ok' ? 'rgba(74,222,128,0.07)' : 'rgba(248,113,113,0.07)', border: `1px solid ${pwdMsg.type === 'ok' ? 'rgba(74,222,128,0.18)' : 'rgba(248,113,113,0.18)'}`, borderRadius: 8, padding: '8px 12px', color: pwdMsg.type === 'ok' ? '#4ade80' : '#f87171', fontFamily: 'monospace', fontSize: 12 }}>
              {pwdMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={pwdLoading}
            style={btnStyle()}
            onMouseEnter={e => { if (!pwdLoading) e.currentTarget.style.background = 'rgba(251,191,36,0.18)' }}
            onMouseLeave={e => { if (!pwdLoading) e.currentTarget.style.background = 'rgba(251,191,36,0.1)' }}
          >
            {pwdLoading ? 'updating…' : 'update password'}
          </button>
        </form>
      </div>

      {/* Logout button */}
      <div>
        <button
          onClick={logout}
          style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #252530', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontFamily: 'monospace', fontSize: 13, transition: 'all 0.15s' }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#f87171'
            e.currentTarget.style.borderColor = 'rgba(248,113,113,0.2)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = '#6b7280'
            e.currentTarget.style.borderColor = '#252530'
          }}
        >
          sign out
        </button>
      </div>
    </div>
  )
}
