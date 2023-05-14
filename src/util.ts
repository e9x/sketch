export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(() => resolve(), ms));
}

export interface FetchOptions {
  method?: Tampermonkey.Request["method"];
  body?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
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
  return new Promise<FetchResponse>((resolve, reject) => {
    const abortListener = () => {
      cleanup();
      req.abort();
    };

    const cleanup = () => {
      if (opts.signal) opts.signal.removeEventListener("abort", abortListener);
    };

    const req = GM_xmlhttpRequest({
      url,
      method: opts.method,
      data: opts.body,
      headers: opts.headers,
      onerror: () => {
        cleanup();
        reject(new TypeError("Failed to fetch"));
      },
      onabort: () => {
        cleanup();
        reject(new DOMException("The user aborted a request."));
      },
      onload: (res) => {
        cleanup();
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
        });
      },
    });

    if (opts.signal) {
      if (opts.signal.aborted) abortListener();
      else opts.signal.addEventListener("abort", abortListener);
    }
  });
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
