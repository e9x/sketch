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

const IDB_STORE = "kv";
const IDB_VERSION = 1;

export class IDBJSONStorage implements JSONStorage {
  private dbName: string;
  private cache = new Map<string, unknown>();
  private idb: IDBDatabase | null = null;
  constructor(dbName: string) {
    this.dbName = dbName;
  }
  async init(): Promise<void> {
    const realName = "TwT" + this.dbName;
    this.idb = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(realName, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE))
          db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    // bulk-read all keys into cache
    const tx = this.idb.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const allKeys = await idbReq<IDBValidKey[]>(store.getAllKeys());
    const allValues = await idbReq<unknown[]>(store.getAll());
    for (let i = 0; i < allKeys.length; i++)
      this.cache.set(allKeys[i] as string, allValues[i]);
  }
  setValue(name: string, value: any): void {
    this.cache.set(name, value);
    if (this.idb) {
      const tx = this.idb.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(value, name);
    }
  }
  getValue<TValue>(name: string, defaultValue?: TValue): TValue {
    if (!this.cache.has(name)) return defaultValue!;
    return this.cache.get(name) as TValue;
  }
  deleteValue(name: string): void {
    this.cache.delete(name);
    if (this.idb) {
      const tx = this.idb.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(name);
    }
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
