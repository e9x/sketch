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
