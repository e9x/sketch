import { isNode } from "./consts";

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(() => resolve(), ms));
}

export function random(min: number, max: number, decimal = false) {
  return (
    (decimal
      ? Math.random() * (max - min)
      : ~~(Math.random() * (max - min + 1))) + min
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
  arrayBuffer: () => Promise<ArrayBuffer>;
  text: () => Promise<string>;
  json: () => Promise<any>;
}

const ogFetch = fetch;

/**
 * Substitute for fetch()
 */
export function GM_fetch(url: URL | string, opts: FetchOptions = {}) {
  // do this retarded shit for now...
  url = url.toString();
  // debugger;
  if (!isNode) return ogFetch(url, opts);

  // Check if the request should use https or http
  const isHttps = url.startsWith("https://");
  const lib: typeof import("http") | typeof import("https") = isHttps
    ? require("https")
    : require("http");

  const abortListener = () => {
    cleanup();
    req.destroy();
  };

  const cleanup = () => {
    if (opts.signal) opts.signal.removeEventListener("abort", abortListener);
  };

  const req = lib.request(url, {
    method: opts.method || "GET",
    headers: opts.headers,
  });

  return new Promise<FetchResponse>((resolve, reject) => {
    req.on("response", (res) => {
      // console.log(res);
      const chunks: Buffer[] = [];

      res.on("data", (chunk) => {
        chunks.push(chunk);
      });

      res.on("end", () => {
        resolve({
          status: res.statusCode!,
          statusText: res.statusMessage!,
          ok: res.statusCode! >= 200 && res.statusCode! < 300,
          arrayBuffer: () => Promise.resolve(Buffer.concat(chunks).buffer),
          text: () => Promise.resolve(Buffer.concat(chunks).toString()),
          json: () =>
            Promise.resolve(JSON.parse(Buffer.concat(chunks).toString())),
          headers: new Headers(res.headers as HeadersInit),
        });
      });
    });

    req.on("error", (error) => {
      cleanup();
      reject(new TypeError("Failed to fetch: " + error.message));
    });

    if (opts.body) req.write(opts.body);

    req.end();

    if (opts.signal) {
      if (opts.signal.aborted) abortListener();
      else opts.signal.addEventListener("abort", abortListener);
    }
  });
}

export function compareDistance(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number
) {
  return Math.sqrt(
    Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2)
  );
}
