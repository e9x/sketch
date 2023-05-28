import type { JSONStorage } from "./values";
import { useEffect, useState } from "react";

export default class Config<Data extends object> {
  defaultConfig: Data;
  private cache = new Map<keyof Data, Data[keyof Data]>();
  configTarget = new EventTarget();
  private storage: JSONStorage;
  constructor(defaultConfig: Data, storage: JSONStorage) {
    this.defaultConfig = defaultConfig;
    this.storage = storage;
  }
  get<K extends keyof Data>(key: K) {
    if (this.cache.has(key)) return this.cache.get(key) as Data[K];
    const value = this.storage.getValue(key as string, this.defaultConfig[key]);
    this.cache.set(key, value);
    return value;
  }
  set<K extends keyof Data>(key: K, value: Data[K]) {
    this.cache.set(key, value);
    this.storage.setValue(key as string, value);
    this.configTarget.dispatchEvent(new Event(key as string));
  }
  delete(key: keyof Data) {
    this.cache.delete(key);
    this.storage.deleteValue(key as string);
    this.configTarget.dispatchEvent(new Event(key as string));
  }
  reset() {
    for (const key in this.defaultConfig) this.delete(key as keyof Data);
  }
  import(config: Data) {
    for (const key in this.defaultConfig)
      if (key in config) this.set(key as keyof Data, config[key as keyof Data]);
      else this.delete(key as keyof Data);
  }
  export() {
    const exported: Partial<Data> = {};
    for (const key in this.defaultConfig)
      exported[key as keyof Data] = this.get(key as keyof Data) as never;
    return exported as Data;
  }
}

// internal
// passing no arguments to the callback will result in the key being deleted
// checked by (...args) and args.length

export type DataHook<Data extends object, K extends keyof Data> = [
  Data[K],
  (...args: [Data[K]] | []) => void
];

export function useConfig<Data extends object, K extends keyof Data>(
  config: Config<Data>,
  key: K
): DataHook<Data, K> {
  // trigger re-render with useState
  const [state, setState] = useState(config.get(key));

  useEffect(() => {
    function listener() {
      setState(config.get(key));
    }

    config.configTarget.addEventListener(key as string, listener, {
      once: true,
    });

    return () =>
      config.configTarget.removeEventListener(key as string, listener);
  });

  return [
    state,
    (...args) => {
      if (args.length === 0) {
        config.delete(key);
        setState(config.defaultConfig[key]);
      } else {
        config.set(key, args[0]);
        setState(args[0]);
      }
    },
  ];
}
