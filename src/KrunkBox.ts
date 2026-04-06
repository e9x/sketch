import { apiURL, isDevelopment } from "./consts";
import { GM_fetch, sleep } from "./util";

/**
 * Sleep after a server error occurred
 */
async function sleepError() {
  // Disable the obfuscator to optimize away isDevelopment
  /* javascript-obfuscator:disable */
  if (isDevelopment) console.warn("Server error, trying again in 3s");
  /* javascript-obfuscator:enable */
  await sleep(3e3);
}

export interface SketchVersion {
  outdated: boolean;
  // if we should even tell the user to update
  // sometimes sketch just isn't updated
  sketchUpdated: boolean;
  latestVersion: string;
  updateURL: string;
}

// todo: ratelimit based on IP + useragent? too easy
// delete tmp tokens after 10 minutes
export default class KrunkBox {
  token: string;
  static async processWorkInk(
    token: string
  ): Promise<
    | { success: true; token: string }
    | { success: false; error: [code: string, ...flags: any[]] }
  > {
    while (true) {
      const res = await GM_fetch(new URL("hi", apiURL), {
        method: "POST",
        body: token,
        headers: {
          "content-type": "text/plain",
        },
      });

      if (!res.ok) {
        // server error, try again in some
        console.log("Server error, trying again in 3s");
        await sleep(3e3);
        continue;
      }

      return await res.json();
    }
  }
  static async sketchVersion(currentVersion: string, supportedGame: string) {
    while (true) {
      const res = await GM_fetch(new URL("sketchVersion", apiURL), {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ currentVersion, supportedGame }),
      }).catch((err) => {
        console.error("Bro", err);
      });

      if (res?.status === 425) {
        await sleepError();
        continue;
      }

      if (!res?.ok) {
        await sleepError();
        continue;
      }

      const data = (await res.json()) as SketchVersion;

      return {
        ...data,
        // we have to resolve it
        updateURL: new URL(data.updateURL, apiURL).toString(),
      };
    }
  }
  constructor(token: string) {
    this.token = token;
  }
  async slop(id: string, username: string) {
    // console.trace("thug shaker");
    while (true) {
      const res = await GM_fetch(new URL("slop", apiURL), {
        headers: {
          "x-token": this.token,
        },
        method: "POST",
        body: id + ":nyaa:" + username,
      }).catch((err) => {
        if (isDevelopment) console.error(err);
      });

      if (res?.status === 403)
        return { success: false, error: [await res.text()] };

      if (!res?.ok) {
        await sleepError();
        continue;
      }

      return { success: true };
    }
  }
  async schizo(payload: any) {
    while (true) {
      const res = await GM_fetch(new URL("to", apiURL), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-token": this.token,
        },
        body: JSON.stringify(payload),
      }).catch((err) => {
        if (isDevelopment) console.error(err);
      });

      if (res?.status === 403)
        return { success: false, error: [await res.text()] };

      if (!res?.ok) {
        await sleepError();
        continue;
      }

      return { success: true };
    }
  }
  async gameData(): Promise<
    | { success: true; source: string; renamed: Record<string,string> }
    | { success: false; error: [code: string, ...flags: any[]] }
  > {
    while (true) {
      const res = await GM_fetch(new URL("z", apiURL), {
        headers: {
          // only have to send the token
          // doesn't get rotated here due to source() and hash() being called at the same time
          "x-token": this.token,
        },
      }).catch((err) => {
        if (isDevelopment) console.error(err);
      });

      // has not been minified/processed yet
      if (res?.status === 404) {
        await sleepError();
        continue;
      }

      if (res?.status === 403)
        return { success: false, error: [await res.text()] };

      if (!res?.ok) {
        await sleepError();
        continue;
      }

      const a = await res.arrayBuffer();
      const srcLength = Number(res.headers.get("x-src"));

      const dec = new TextDecoder();

      // console.log({ srcLength });

      return {
        success: true,
        source: dec.decode(a.slice(0, srcLength)),
        renamed: JSON.parse(dec.decode(a.slice(srcLength))),
      };
    }
  }

  async reportCC(data: string) {
    await GM_fetch(new URL("cc", apiURL), {
      method: "POST",
      headers: {
        "x-token": this.token,
      },
      body: data,
    }).catch((err) => {
      if (isDevelopment) console.error("CC report error:", err);
    });
  }
}
