import type NodeFS from "fs";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface JSONStorage {
  /** Sets the value of `name` to the storage */
  setValue(name: string, value: any): void;
  /** Gets the value of 'name' from storage */
  getValue<TValue>(name: string, defaultValue?: TValue): TValue;
  /** Deletes 'name' from storage */
  deleteValue(name: string): void;
  /** Lists all names of the storage */
  listValues(): string[];
}

export class FSJSONStorage implements JSONStorage {
  private path: string;
  db: Map<string, unknown>;
  fs = require("fs") as typeof NodeFS;
  private save() {
    this.fs.writeFileSync(
      this.path,
      JSON.stringify(Object.fromEntries(this.db))
    );
  }
  constructor(path: string) {
    this.path = path;
    try {
      this.db = new Map(
        Object.entries(JSON.parse(this.fs.readFileSync(this.path, "utf-8")))
      );
    } catch {
      this.db = new Map();
    }
  }
  setValue(name: string, value: any): void {
    this.db.set(name, value);
    this.save();
  }
  getValue<TValue>(name: string, defaultValue?: TValue): TValue {
    if (!this.db.has(name)) return defaultValue!;
    return this.db.get(name) as TValue;
  }
  deleteValue(name: string): void {
    this.db.delete(name);
    this.save();
  }
  listValues(): string[] {
    return Array.from(this.db.keys());
  }
}

const hasDel = typeof GM_deleteValue === "function";
export class GMJSONStorage implements JSONStorage {
  setValue(name: string, value: any): void {
    GM_setValue(name, value);
  }
  getValue<TValue>(name: string, defaultValue?: TValue): TValue {
    return GM_getValue(name, defaultValue);
  }
  deleteValue(name: string): void {
    if (hasDel) GM_deleteValue(name);
    else GM_setValue(name, undefined);
  }
  listValues(): string[] {
    return GM_listValues();
  }
}

const IDB_STORE = "entries";
const IDB_KEY = "_";
const IDB_VERSION = 1;

export class IDBJSONStorage implements JSONStorage {
  private dbName: string;
  private cache = new Map<string, unknown>();
  private idb: IDBDatabase | null = null;
  private flushQueued = false;
  constructor(dbName: string) {
    this.dbName = dbName;
  }
  async init(): Promise<void> {
    this.idb = await openIDB(this.dbName, IDB_VERSION);
    // read single blob
    const tx = this.idb.transaction(IDB_STORE, "readonly");
    const raw = await idbReq<string | undefined>(tx.objectStore(IDB_STORE).get(IDB_KEY));
    if (raw) {
      try {
        const entries: Record<string, unknown> = JSON.parse(atob(raw));
        for (const [k, v] of Object.entries(entries)) this.cache.set(k, v);
      } catch {}
    }
    // migrate from legacy "TwTglensargent" db if it exists
    await this.migrateLegacy();
  }
  private async migrateLegacy(): Promise<void> {
    try {
      const dbs = await indexedDB.databases();
      if (!dbs.some((d) => d.name === "TwTglensargent")) return;
      const old = await openIDB("TwTglensargent", 1);
      const tx = old.transaction("kv", "readonly");
      const store = tx.objectStore("kv");
      const keys = await idbReq<IDBValidKey[]>(store.getAllKeys());
      const vals = await idbReq<unknown[]>(store.getAll());
      for (let i = 0; i < keys.length; i++) {
        if (!this.cache.has(keys[i] as string))
          this.cache.set(keys[i] as string, vals[i]);
      }
      old.close();
      this.flush();
      // delete legacy db
      indexedDB.deleteDatabase("TwTglensargent");
    } catch {}
  }
  private flush(): void {
    if (!this.idb) return;
    const blob = btoa(JSON.stringify(Object.fromEntries(this.cache)));
    const tx = this.idb.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(blob, IDB_KEY);
  }
  private queueFlush(): void {
    if (this.flushQueued) return;
    this.flushQueued = true;
    queueMicrotask(() => {
      this.flushQueued = false;
      this.flush();
    });
  }
  setValue(name: string, value: any): void {
    this.cache.set(name, value);
    this.queueFlush();
  }
  getValue<TValue>(name: string, defaultValue?: TValue): TValue {
    if (!this.cache.has(name)) return defaultValue!;
    return this.cache.get(name) as TValue;
  }
  deleteValue(name: string): void {
    this.cache.delete(name);
    this.queueFlush();
  }
  listValues(): string[] {
    return Array.from(this.cache.keys());
  }
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openIDB(name: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE))
        db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
