/** Recently played online worlds, remembered per browser (no Firebase dependency). */

export interface RecentRoom {
  code: string;
  name: string;
  at: number;
}

const RECENT_KEY = 'veinreach.recentRooms';

export function recentRooms(): RecentRoom[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as RecentRoom[];
    return Array.isArray(v) ? v.filter((r) => typeof r.code === 'string' && typeof r.name === 'string').slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function rememberRoom(code: string, name: string): void {
  try {
    const list = [{ code, name, at: Date.now() }, ...recentRooms().filter((r) => r.code !== code)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: not remembered */
  }
}

export function clearRecentRooms(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function forgetRoom(code: string): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentRooms().filter((r) => r.code !== code)));
  } catch {
    /* ignore */
  }
}
