// KV-backed replacements for Apps Script's PropertiesService usage.
//
// Original used three flat keys in the script's Properties store:
//   PROCESSED_IDS      -> JSON array of Gmail message IDs (capped at 500, oldest dropped)
//   WELCOMED_USERS     -> JSON array of sender emails who've received the FTUX welcome
//   USER_USAGE_COUNT   -> JSON object { email: count } for the 5-uses survey trigger
//
// Ported 1:1 as three KV keys holding the same JSON shapes. KV is eventually-consistent
// and has no atomic read-modify-write, so under concurrent invocations there's a narrow
// race window (same as the Apps Script version relied on LockService to avoid — see
// index.ts for the KV-based lock equivalent).

const PROCESSED_IDS_KEY = 'PROCESSED_IDS';
const WELCOMED_USERS_KEY = 'WELCOMED_USERS';
const USER_USAGE_COUNT_KEY = 'USER_USAGE_COUNT';
const LOCK_KEY = 'SCOUT_LOCK';

const MAX_PROCESSED_IDS = 500;

export async function isAlreadyProcessed(kv: KVNamespace, messageId: string): Promise<boolean> {
	const raw = await kv.get(PROCESSED_IDS_KEY);
	const log: string[] = raw ? JSON.parse(raw) : [];
	return log.includes(messageId);
}

export async function markProcessed(kv: KVNamespace, messageId: string): Promise<void> {
	const raw = await kv.get(PROCESSED_IDS_KEY);
	const log: string[] = raw ? JSON.parse(raw) : [];
	log.push(messageId);
	if (log.length > MAX_PROCESSED_IDS) {
		log.splice(0, log.length - MAX_PROCESSED_IDS);
	}
	await kv.put(PROCESSED_IDS_KEY, JSON.stringify(log));
}

export async function getWelcomedList(kv: KVNamespace): Promise<string[]> {
	const raw = await kv.get(WELCOMED_USERS_KEY);
	if (!raw) return [];
	try {
		return JSON.parse(raw);
	} catch {
		// Mirrors the Apps Script fallback parse: comma-separated string.
		return raw
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
	}
}

export async function addWelcomedUser(kv: KVNamespace, email: string, currentList: string[]): Promise<void> {
	currentList.push(email);
	await kv.put(WELCOMED_USERS_KEY, JSON.stringify(currentList));
}

export async function trackUsage(kv: KVNamespace, email: string): Promise<number> {
	const raw = await kv.get(USER_USAGE_COUNT_KEY);
	const usageLog: Record<string, number> = raw ? JSON.parse(raw) : {};
	usageLog[email] = (usageLog[email] || 0) + 1;
	await kv.put(USER_USAGE_COUNT_KEY, JSON.stringify(usageLog));
	return usageLog[email];
}

/**
 * Best-effort lock to prevent overlapping executions, mirroring
 * LockService.getScriptLock() in the Apps Script version. Cloudflare Email Workers
 * invoke the `email()` handler per-message rather than on a polling trigger, so the
 * "two triggers overlap" scenario that motivated the original lock mostly doesn't
 * apply here — this is kept as a cheap safety net, not a strict distributed lock
 * (KV's eventual consistency means it cannot be one).
 */
export async function tryAcquireLock(kv: KVNamespace, ttlSeconds = 60): Promise<boolean> {
	const existing = await kv.get(LOCK_KEY);
	if (existing) return false;
	await kv.put(LOCK_KEY, '1', { expirationTtl: ttlSeconds });
	return true;
}

export async function releaseLock(kv: KVNamespace): Promise<void> {
	await kv.delete(LOCK_KEY);
}
