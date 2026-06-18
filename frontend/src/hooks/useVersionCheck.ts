import { useEffect, useState } from 'react'

export const CURRENT_VERSION = '1.1.1'

function normalize(v: string): string {
  const parts = v.split('.').map(s => parseInt(s, 10))
  while (parts.length < 3) parts.push(0)
  return parts.join('.')
}

interface VersionState {
  current: string
  latest: string | null
  releaseName: string | null
  changelog: string | null
  hasUpdate: boolean
  releaseUrl: string | null
  loading: boolean
}

export function useVersionCheck(): VersionState {
  const [state, setState] = useState<VersionState>({
    current: CURRENT_VERSION,
    latest: null,
    releaseName: null,
    changelog: null,
    hasUpdate: false,
    releaseUrl: null,
    loading: true,
  })

  useEffect(() => {
    let cancelled = false

    fetch('https://api.github.com/repos/almufty/zonekeeper/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: { tag_name: string; html_url: string; name: string; body: string }) => {
        if (cancelled) return
        const latest = data.tag_name.replace(/^v/, '')
        setState({
          current: CURRENT_VERSION,
          latest,
          releaseName: data.name || `v${latest}`,
          changelog: data.body || null,
          hasUpdate: normalize(latest) !== normalize(CURRENT_VERSION),
          releaseUrl: data.html_url,
          loading: false,
        })
      })
      .catch(() => {
        if (!cancelled) setState(s => ({ ...s, loading: false }))
      })

    return () => { cancelled = true }
  }, [])

  return state
}
