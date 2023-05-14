export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(() => resolve(), ms));
}

export interface FetchOptions {
  method?: Tampermonkey.Request["method"];
  body?: string;
  headers?: Record<string, string>;
}

export interface FetchResponse {
  status: number;
  statusText: string;
  ok: boolean;
  headers: Headers;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
}

/**
 * Substitute for fetch()
 */
export function GM_fetch(url: string, opts: FetchOptions = {}) {
  // return fetch(url, opts);
  return new Promise<FetchResponse>((resolve, reject) =>
    GM_xmlhttpRequest({
      url,
      method: opts.method,
      data: opts.body,
      headers: opts.headers,
      onerror: () => reject(new TypeError(`Failed to fetch`)),
      onload: (res) =>
        resolve({
          status: res.status,
          statusText: res.statusText,
          ok: res.status >= 200 && res.status < 300,
          text: () => Promise.resolve(res.responseText),
          json: () => Promise.resolve(JSON.parse(res.responseText)),
          headers: res.responseHeaders
            .split("\r\n")
            .filter(Boolean) // empty lines
            .reduce((headers, line) => {
              const [name, ...value] = line.split(": ");
              headers.set(name, value.join(": "));
              return headers;
            }, new Headers()),
        }),
    })
  );
}

type TrueLike<T> = Exclude<NonNullable<T>, false>;

/**
 * Poll a condition every x MS.
 */
export function waitFor<T>(
  check: () => T,
  interval = 50
): Promise<TrueLike<T>> {
  return new Promise((resolve) => {
    let set: ReturnType<typeof setInterval>;

    const run = () => {
      try {
        const result = check();

        if (result) {
          if (set) clearInterval(set);
          resolve(result as TrueLike<T>);

          return true;
        }
      } catch (err) {
        console.error(err);
      }
    };

    if (!run()) set = setInterval(run, interval);
  });
}

export function random(min: number, max: number, decimal = false) {
  return (
    (decimal
      ? Math.random() * (max - min)
      : ~~(Math.random() * (max - min + 1))) + min
  );
}
