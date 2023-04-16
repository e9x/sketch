import { useEffect, useState } from "preact/hooks";

const configTarget = new EventTarget();
const valueCache = new Map<string, unknown>();

export function configGet<T>(key: string, defaultValue?: T): T {
  if (valueCache.has(key)) return valueCache.get(key) as T;
  const value = GM_getValue(key, defaultValue);
  valueCache.set(key, value);
  return value;
}

export function configSet<T>(key: string, value: T) {
  valueCache.set(key, value);
  GM_setValue(key, value);
  configTarget.dispatchEvent(new Event(key));
}

export function configDelete(key: string) {
  valueCache.delete(key);
  GM_deleteValue(key);
  configTarget.dispatchEvent(new Event(key));
}

export default function useConfig<T>(key: string, defaultValue?: T) {
  // trigger re-render with useState
  const [state, setState] = useState(configGet(key, defaultValue));

  useEffect(() => {
    function listener() {
      setState(configGet(key, defaultValue));
    }

    configTarget.addEventListener(key, listener, { once: true });

    return () => configTarget.removeEventListener(key, listener);
  });

  return [
    state,
    (value) => {
      // null = nuke the item
      if (value === null) configDelete(key);
      else configSet(key, value);
      setState(configGet(key));
      configTarget.dispatchEvent(new Event(key));
    },
  ] as [T, (value: T | null) => void];
}
