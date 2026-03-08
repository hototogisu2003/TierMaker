import type { TeamRecord } from "@/lib/teamcustom/types";

const DB_NAME = "ms-team-custom-db";
const DB_VERSION = 2;
const STORE_TEAMS = "teams";
const STORE_SETTINGS = "settings";
const KEY_ARRANGE_IDS = "arrangeIds";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TEAMS)) {
        const store = db.createObjectStore(STORE_TEAMS, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listTeams(): Promise<TeamRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TEAMS, "readonly");
    const req = tx.objectStore(STORE_TEAMS).getAll();
    req.onsuccess = () => {
      const rows = (req.result as TeamRecord[]).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function putTeam(team: TeamRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TEAMS, "readwrite");
    tx.objectStore(STORE_TEAMS).put(team);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteTeam(teamId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TEAMS, "readwrite");
    tx.objectStore(STORE_TEAMS).delete(teamId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getArrangeIds(): Promise<string[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, "readonly");
    const req = tx.objectStore(STORE_SETTINGS).get(KEY_ARRANGE_IDS);
    req.onsuccess = () => {
      const value = (req.result as { key: string; value: unknown } | undefined)?.value;
      resolve(Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function setArrangeIds(ids: string[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, "readwrite");
    tx.objectStore(STORE_SETTINGS).put({ key: KEY_ARRANGE_IDS, value: ids });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
