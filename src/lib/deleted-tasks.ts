/**
 * Tracks task IDs the user deleted on this device.
 *
 * - **localStorage (30d):** `wasUserDeletedTask()` — MUST drive Kanban/UI filtering. If you only
 *   use `getRecentlyDeletedIds()` (session ~30m), tasks reappear after the session window when
 *   PowerSync re-downloads rows.
 * - **sessionStorage:** short-lived mirror for compatibility; upload guards use `wasUserDeletedTask`.
 */
const STORAGE_KEY = 'agentboard_recently_deleted';
const PERSIST_DELETED_KEY = 'agentboard_user_deleted_task_ids';
const RETENTION_MS = 30 * 60 * 1000; // 30 min (UI hide)
const PERSIST_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (block resurrecting PUTs)
const MAX_PERSIST_IDS = 500;

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

function loadPersistDeletedIds(): Map<string, number> {
  try {
    const raw = localStorage.getItem(PERSIST_DELETED_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as unknown;
    const now = Date.now();
    const map = new Map<string, number>();
    if (!Array.isArray(parsed)) return map;
    for (const p of parsed) {
      const taskId = typeof p === 'string' ? p : p?.id;
      const until =
        typeof p === 'object' && p != null && typeof p.until === 'number'
          ? p.until
          : now + PERSIST_RETENTION_MS;
      if (taskId && until > now) map.set(taskId, until);
    }
    return map;
  } catch {
    return new Map();
  }
}

function savePersistDeletedIds(map: Map<string, number>) {
  try {
    const now = Date.now();
    const arr = [...map.entries()]
      .filter(([, until]) => until > now)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_PERSIST_IDS)
      .map(([id, until]) => ({ id, until }));
    localStorage.setItem(PERSIST_DELETED_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

let persistDeleted = loadPersistDeletedIds();

/** True if the user deleted this task on this device — stale PowerSync PUTs must not resurrect it. */
export function wasUserDeletedTask(id: string): boolean {
  persistDeleted = loadPersistDeletedIds();
  const until = persistDeleted.get(id);
  return until != null && until > Date.now();
}

export function markRecentlyDeleted(id: string) {
  recentlyDeleted.add(id);
  saveToStorage(recentlyDeleted);
  const until = Date.now() + PERSIST_RETENTION_MS;
  persistDeleted.set(id, until);
  savePersistDeletedIds(persistDeleted);
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
