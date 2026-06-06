import type { Account, Zone, CfZone, CfDnsRecord, DnsRecord, SyncLog, StatusResponse, SyncResult } from './types';

// HIGH-1 fix: module-level CSRF token — populated from login/me responses
let csrfToken = '';

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  // Include CSRF token on all state-mutating requests
  if (method !== 'GET' && method !== 'HEAD' && csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || 'Request failed');
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

// Auth — not routed through req() to avoid redirect loops
export async function getMe(): Promise<{ username: string } | null> {
  const res = await fetch('/api/auth/me');
  if (!res.ok) return null;
  const data = await res.json();
  // Store CSRF token returned by the server
  if (data.csrfToken) csrfToken = data.csrfToken;
  return { username: data.username };
}

export async function login(username: string, password: string): Promise<{ username: string }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || 'Login failed');
  }
  const data = await res.json();
  // Store CSRF token from fresh session
  if (data.csrfToken) csrfToken = data.csrfToken;
  return { username: data.username };
}

export const logout = () => req<{ ok: boolean }>('POST', '/api/auth/logout');
export const changePassword = (currentPassword: string, newPassword: string) =>
  req<{ ok: boolean }>('POST', '/api/auth/change-password', { currentPassword, newPassword });

// Accounts
export const getAccounts = () => req<Account[]>('GET', '/api/accounts');
export const getAccount  = (id: number) => req<Account>('GET', `/api/accounts/${id}`);
// HIGH-4: dedicated call that fetches the decrypted key on demand
export const getAccountKey = (id: number) => req<{ auth_key: string }>('GET', `/api/accounts/${id}/key`);
export const createAccount = (data: Omit<Account, 'id' | 'created_at'>) => req<Account>('POST', '/api/accounts', data);
export const updateAccount = (id: number, data: Partial<Omit<Account, 'id' | 'created_at'>>) => req<Account>('PUT', `/api/accounts/${id}`, data);
export const deleteAccount = (id: number) => req<void>('DELETE', `/api/accounts/${id}`);
export const verifyAccount = (id: number) => req<CfZone[]>('POST', `/api/accounts/${id}/verify`);
export const getAccountZoneRecords = (accountId: number, zoneId: string) =>
  req<CfDnsRecord[]>('GET', `/api/accounts/${accountId}/zones/${zoneId}/records`);

// Zones
export const getZones = (accountId?: number) =>
  req<Zone[]>('GET', accountId != null ? `/api/zones?accountId=${accountId}` : '/api/zones');
export const createZone = (data: { account_id: number; zone_identifier: string; name: string }) =>
  req<Zone>('POST', '/api/zones', data);
export const deleteZone = (id: number) => req<void>('DELETE', `/api/zones/${id}`);

// Records
export const getRecords    = (zoneId?: number) =>
  req<DnsRecord[]>('GET', zoneId != null ? `/api/records?zoneId=${zoneId}` : '/api/records');
export const createRecord  = (data: Partial<DnsRecord>) => req<DnsRecord>('POST', '/api/records', data);
export const updateRecord  = (id: number, data: Partial<DnsRecord>) => req<DnsRecord>('PUT', `/api/records/${id}`, data);
export const deleteRecord  = (id: number) => req<void>('DELETE', `/api/records/${id}`);
export const syncRecord    = (id: number) => req<SyncResult>('POST', `/api/records/${id}/sync`);
export const getRecordLog  = (id: number) => req<SyncLog[]>('GET', `/api/records/${id}/log`);

// Sync / Status
export const syncAll   = () => req<{ results: (SyncResult & { record_id: number; record_name: string })[] }>('POST', '/api/sync');
export const getStatus = () => req<StatusResponse>('GET', '/api/status');

// Settings
export interface SystemSettings {
  poll_interval: number;
  log_retention_days: number;
  discord_webhook_url: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
  notify_on_success: boolean;
  notify_on_error: boolean;
}
export const getSettings = () => req<SystemSettings>('GET', '/api/settings');
export const updateSettings = (data: Partial<SystemSettings>) => req<{ ok: boolean }>('PUT', '/api/settings', data);
export const getBackupConfig = () => req<any>('GET', '/api/settings/backup');
export const restoreBackupConfig = (data: any) => req<{ ok: boolean }>('POST', '/api/settings/restore', data);

