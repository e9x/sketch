import { apiURL, isDevelopment } from "./consts";
import tokenConfig from "./tokenConfig";
import { sleep } from "./util";

export enum ProcessTokenErrors {
  BadToken,
  DuplicateToken,
}

export enum APIError {
  BadToken,
  /**
   * Do it yourself
   */
  DIY,
}

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

// todo: ratelimit based on IP + useragent? too easy
// delete tmp tokens after 10 minutes
export default class KrunkBox {
  #token: string | undefined;

  static async generateTmpToken(signal?: AbortSignal) {
    while (true) {
      const res = await fetch(new URL("hi", apiURL).toString(), {
        signal,
      }).catch((err) => {
        if (isDevelopment) console.error(err);
      });

      if (!res?.ok) {
        await sleepError();
        continue;
      }

      return await res.text();
    }
  }
  static async processToken(accessKey: string, tmpToken: string) {
    while (true) {
      const res = await fetch(new URL("hi", apiURL).toString(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify([accessKey, tmpToken]),
      }).catch((err) => {
        if (isDevelopment) console.error(err);
      });

      if (res?.status === 400) return ProcessTokenErrors.BadToken;
      if (res?.status === 402) return ProcessTokenErrors.BadToken;

      if (!res?.ok) {
        await sleepError();
        continue;
      }

      return await res.text();
    }
  }
  static async sketchVersion(currentVersion: string, supportedGame: string) {
    while (true) {
      const res = await fetch(new URL("sketchVersion", apiURL), {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ currentVersion, supportedGame }),
      }).catch((err) => {
        if (isDevelopment) console.error(err);
      });

      if (res?.status === 425) {
        await sleepError();
        continue;
      }

      if (!res?.ok) {
        await sleepError();
        continue;
      }

      const data = (await res.json()) as {
        outdated: boolean;
        // if we should even tell the user to update
        // sometimes sketch just isn't updated
        sketchUpdated: boolean;
        latestVersion: string;
        updateURL: string;
      };

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
  get token(): string {
    if (!this.#token) throw new Error("No token available");
    return this.#token;
  }
  set token(value: string | undefined) {
    this.#token = value;
    if (value === undefined) tokenConfig.delete("token");
    else tokenConfig.set("token", value);
  }
  async source() {
    while (true) {
      const res = await fetch(new URL("source", apiURL).toString(), {
        headers: {
          // only have to send the token
          // doesn't get rotated here due to source() and hash() being called at the same time
          "x-token": this.token,
        },
      }).catch((err) => {
        if (isDevelopment) console.error(err);
      });

      if (res?.status === 402) return APIError.BadToken;

      // has not been minified/processed yet
      if (res?.status === 404) {
        await sleepError();
        continue;
      }

      if (!res?.ok) {
        await sleepError();
        continue;
      }

      return await res.text();
    }
  }
  async skins() {
    while (true) {
      const res = await fetch(new URL("skins", apiURL), {
        headers: {
          // only have to send the token
          // doesn't get rotated here due to source() and hash() being called at the same time
          "x-token": this.token,
        },
      }).catch((err) => {
        if (isDevelopment) console.error(err);
      });

      if (res?.status === 402) return APIError.BadToken;

      // has not been minified/processed yet
      if (res?.status === 404) {
        await sleepError();
        continue;
      }

      if (!res?.ok) {
        await sleepError();
        continue;
      }

      return await res.text();
    }
  }
  /**
   * Validates the token. Should be called before making any requests to Krunker's matchmaker
   */
  async valid() {
    while (true) {
      const res = await fetch(new URL("me", apiURL).toString(), {
        method: "POST",
        body: this.token,
        headers: {
          "content-type": "text/plain",
        },
      }).catch((err) => {
        if (isDevelopment) console.error(err);
      });

      if (res?.status === 402) {
        this.token = undefined;
        return false;
      }

      if (!res?.ok) {
        await sleepError();
        continue;
      }

      this.token = await res.text();

      return true;
    }
  }
}
