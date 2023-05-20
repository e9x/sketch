export class FSStorage implements Storage {
  private path: string;
  db: Map<string, string>;
  private save() {
    require("fs").writeFileSync(
      this.path,
      JSON.stringify(Object.fromEntries(this.db))
    );
  }
  constructor(path: string) {
    this.path = path;
    try {
      this.db = new Map(
        Object.entries(
          JSON.parse(require("fs").readFileSync(this.path, "utf-8"))
        )
      );
    } catch {
      this.db = new Map();
    }
  }
  getItem(key: string) {
    if (this.db.has(key)) return this.db.get(key) as string;
    else return null;
  }
  setItem(key: string, val: string) {
    this.db.set(key, val);
    this.save();
  }
  removeItem(key: string) {
    this.db.delete(key);
    this.save();
  }
  clear() {
    this.db = new Map();
    this.save();
  }
  key(i: number) {
    return Object.keys(this)[i];
  }
  get length() {
    return Object.keys(this).length;
  }
}

export class GMStorage implements Storage {
  keys() {
    return GM_listValues();
  }
  getItem(key: string) {
    return GM_getValue(key, null);
  }
  setItem(key: string, val: string) {
    GM_setValue(key, val);
  }
  removeItem(key: string) {
    GM_deleteValue(key);
  }
  clear() {
    for (const key of GM_listValues()) GM_deleteValue(key);
  }
  key(i: number) {
    return GM_listValues()[i];
  }
  get length() {
    return GM_listValues().length;
  }
}

export function storageHasKey(storage: Storage, key: string) {
  if (storage instanceof FSStorage) return storage.db.has(key);
  else if (storage instanceof GMStorage) return storage.keys().includes(key);

  for (let i = 0; i < storage.length; i++)
    if (storage.key(i) === key) return true;
  return false;
}
