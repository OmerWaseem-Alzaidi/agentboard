/**
 * Tracks task IDs we've deleted. Persists to sessionStorage so they stay hidden
 * across page refresh (Supabase delete may fail; PowerSync re-syncs on reload).
 */
const STORAGE_KEY = 'agentboard_recently_deleted';
const RETENTION_MS = 30 * 60 * 1000; // 30 min

function loadFromStorage(): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    const now = Date.now();
    if (!Array.isArray(parsed)) return new Set();
    const valid: string[] = [];
    for (const p of parsed) {
      const id = typeof p === 'string' ? p : p?.id;
      const until = typeof p === 'object' && p != null && typeof p.until === 'number' ? p.until : now + RETENTION_MS;
      if (id && until > now) valid.push(id);
    }
    return new Set(valid);
  } catch {
    return new Set();
  }
}

function saveToStorage(ids: Set<string>) {
  try {
    const until = Date.now() + RETENTION_MS;
    const arr = Array.from(ids).map((id) => ({ id, until }));
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

const recentlyDeleted = loadFromStorage();

export function markRecentlyDeleted(id: string) {
  recentlyDeleted.add(id);
  saveToStorage(recentlyDeleted);
  setTimeout(() => {
    recentlyDeleted.delete(id);
    saveToStorage(recentlyDeleted);
  }, RETENTION_MS);
}

export function getRecentlyDeletedIds(): Set<string> {
  return recentlyDeleted;
}

export function wasRecentlyDeleted(id: string): boolean {
  return recentlyDeleted.has(id);
}
