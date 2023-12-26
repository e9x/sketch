import { apiURL, isDevelopment } from "./consts";
import { sleep } from "./util";

export enum APIError {
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
  static async generateTmpToken(signal?: AbortSignal) {
    while (true) {
      const res = await fetch(new URL("hi", apiURL).toString(), {
        signal,
      }).catch((err) => {
        if (err instanceof DOMException) throw err;
        if (isDevelopment) console.error(err);
      });

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
  async source() {
    while (true) {
      const res = await fetch(new URL("source", apiURL).toString()).catch(
        (err) => {
          if (isDevelopment) console.error(err);
        }
      );

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
      const res = await fetch(new URL("skins", apiURL)).catch((err) => {
        if (isDevelopment) console.error(err);
      });

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
}
