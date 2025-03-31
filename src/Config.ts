import type { JSONStorage } from "./values";
import { useState, useEffect } from "preact/hooks";

export interface ConfigEvent extends Event {
  configKey: string | number | symbol;
}

export interface ConfigET extends EventTarget {
  dispatchEvent(e: ConfigEvent): boolean;
  addEventListener(
    type: "change",
    listener: (this: ConfigET, ev: ConfigEvent) => any,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean
  ): void;
  removeEventListener(
    type: "change",
    listener: (this: ConfigET, ev: ConfigEvent) => any,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean
  ): void;
}

export default class Config<Data extends object> {
  defaultConfig: Data;
  private cache = new Map<keyof Data, Data[keyof Data]>();
  configTarget = new EventTarget() as ConfigET;
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
    const e = new Event("change") as ConfigEvent;
    e.configKey = key;
    this.configTarget.dispatchEvent(e);
  }
  delete(key: keyof Data) {
    this.cache.delete(key);
    this.storage.deleteValue(key as string);
    const e = new Event("change") as ConfigEvent;
    e.configKey = key;
    this.configTarget.dispatchEvent(e);
  }
  reset() {
    for (const key in this.defaultConfig) this.delete(key as keyof Data);
  }
  /**
   *
   * @param config
   * @param del whether to delete keys that aren't specified in the new config or to preserve the original ones
   */
  import(config: Partial<Data>, del = true) {
    for (const key in this.defaultConfig) {
      //@ts-ignore
      if (key in config) this.set(key, config[key]);
      else if (del) this.delete(key);
    }
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
  (...args: [Data[K]] | []) => void,
];

export function useConfig<Data extends object, K extends keyof Data>(
  config: Config<Data>,
  key: K
): DataHook<Data, K> {
  // trigger re-render with useState
  const [state, setState] = useState(config.get(key));

  useEffect(() => {
    function listener(event: ConfigEvent) {
      if (event.configKey === key) setState(config.get(key));
    }

    config.configTarget.addEventListener("change", listener);

    return () => config.configTarget.removeEventListener("change", listener);
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
