import { useEffect, useState } from "preact/hooks";

const configTarget = new EventTarget();
const valueCache = new Map<string, unknown>();

export const defaultConfig = {
  aimbot: false,
  wallbangs: false,
  bhop: false,
};

export function getConfig<T>(key: string, defaultValue?: T) {
  if (valueCache.has(key)) return valueCache.get(key);
  const value = GM_getValue(key, defaultValue);
  valueCache.set(key, value);
  return value;
}

export function setConfig<T>(key: string, value: T) {
  valueCache.set(key, value);
  GM_setValue(key, value);

  configTarget.dispatchEvent(new Event(key));
}

export function deleteConfig(key: string) {
  valueCache.delete(key);
  GM_deleteValue(key);

  configTarget.dispatchEvent(new Event(key));
}

export default function useConfig<T>(key: string, defaultValue?: T) {
  // trigger re-render with useState
  const [state, setState] = useState(getConfig(key, defaultValue));

  const event = `set ${key}`;

  useEffect(() => {
    function listener() {
      setState(getConfig(key, defaultValue));
    }

    configTarget.addEventListener(event, listener, { once: true });

    return () => configTarget.removeEventListener(event, listener);
  });

  return [
    state,
    (value) => {
      // null = nuke the item
      if (value === null) deleteConfig(key);
      else setConfig(key, value);

      setState(value);
      configTarget.dispatchEvent(new Event(event));
    },
  ] as [T, (value: T | null) => void];
}
