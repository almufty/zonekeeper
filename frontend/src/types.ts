export interface Account { id: number; name: string; auth_email: string; auth_method: 'global' | 'token'; auth_key: string; created_at: string; }
export interface Zone { id: number; account_id: number; zone_identifier: string; name: string; created_at: string; }
export interface CfZone { id: string; name: string; status: string; }
export interface CfDnsRecord { id: string; name: string; content: string; ttl: number; proxied: boolean; type?: string; }
export interface DnsRecord {
  id: number; zone_id: number; record_name: string; record_type: string;
  ttl: number; proxied: boolean; enabled: boolean;
  last_ip: string | null; last_checked_at: string | null;
  last_status: 'updated' | 'unchanged' | 'error' | null;
  cloudflare_record_id: string | null; created_at: string;
}
export interface SyncLog {
  id: number; record_id: number; record_name?: string; timestamp: string;
  old_ip: string | null; new_ip: string | null;
  status: 'updated' | 'unchanged' | 'error'; message: string | null;
}
export interface StatusResponse {
  publicIpV4: string | null;
  publicIpV6: string | null;
  lastPollTime: string | null;
  pollInterval: number;
  records: Pick<DnsRecord, 'id' | 'record_name' | 'last_ip' | 'last_status' | 'last_checked_at'>[];
  recentLogs: SyncLog[];
}
export interface SyncResult { status: 'updated' | 'unchanged' | 'error'; old_ip?: string; new_ip?: string; message?: string; }