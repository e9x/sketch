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
      onerror: (e) => reject(e),
      onload: (res) =>
        resolve({
          status: res.status,
          statusText: res.statusText,
          ok: res.status >= 200 && res.status < 300,
          text: () => Promise.resolve(res.responseText),
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
