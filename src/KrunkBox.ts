/* eslint-disable no-constant-condition */
import { apiURL } from "./consts";
import { GM_fetch, sleep } from "./util";

export enum WorkInkErrors {
  BadToken,
  DuplicateToken,
}

export enum APIError {
  BadToken,
}

export default class KrunkBox {
  #token: string | undefined;
  static async processWorkInk(token: string) {
    while (true) {
      const res = await GM_fetch(new URL("hi", apiURL).toString(), {
        method: "POST",
        body: token,
        headers: {
          "content-type": "text/plain",
        },
      });

      if (res.status === 402) return WorkInkErrors.BadToken;
      if (res.status === 422) return WorkInkErrors.DuplicateToken;

      if (!res.ok) {
        // server error, try again in some
        console.log("Server error, trying again in 3s");
        await sleep(3e3);
        continue;
      }

      return await res.text();
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
    if (value === undefined) GM_deleteValue("token");
    else GM_setValue("token", value);
  }
  /**
   *
   * Hash a token
   */
  async hash(token: string) {
    while (true) {
      const res = await GM_fetch(new URL("hash", apiURL).toString(), {
        method: "POST",
        body: token,
        headers: {
          "x-token": this.token,
          "content-type": "text/plain",
        },
      });

      if (res.status === 425) {
        console.log("Too early, trying again in 3s");
        await sleep(3e3);
        continue;
      }

      if (res.status === 402) return APIError.BadToken;

      // x-token should be available if eg fastify crashes
      // but if we don't get x-token, just don't change it
      this.token = res.headers.get("x-token") || this.token;

      if (!res.ok) throw new Error("Unknown error");

      return await res.text();
    }
  }
  /**
   * Validates the token. Should be called before making any requests to Krunker's matchmaker
   */
  async valid() {
    while (true) {
      const res = await GM_fetch(new URL("me", apiURL).toString(), {
        method: "POST",
        body: this.token,
        headers: {
          "content-type": "text/plain",
        },
      });

      if (res.status === 402) {
        this.token = undefined;
        return false;
      }

      if (!res.ok) {
        // server error, try again in some
        console.log("Server error, trying again in 3s");
        await sleep(3e3);
        continue;
      }

      this.token = await res.text();

      return true;
    }
  }
  async source() {
    while (true) {
      const res = await GM_fetch(new URL("source", apiURL).toString(), {
        headers: {
          // only have to send the token
          // doesn't get rotated here due to source() and hash() being called at the same time
          "x-token": this.token,
        },
      });

      if (res.status === 402) return APIError.BadToken;

      // has not been minified/processed yet
      if (res.status === 404) {
        console.log("Too early, trying again in 3s");
        await sleep(3e3);
        continue;
      }

      if (!res.ok) {
        // server error, try again in some
        console.log("Server error, trying again in 3s");
        await sleep(3e3);
        continue;
      }

      return await res.text();
    }
  }
  async vars() {
    while (true) {
      const res = await GM_fetch(new URL("vars", apiURL).toString(), {
        headers: {
          "x-token": this.token,
        },
      });

      if (res.status === 402) return APIError.BadToken;

      // x-token should be available even if 404
      this.token = res.headers.get("x-token") || this.token;

      // has not been minified/processed yet
      if (res.status === 404) {
        console.log("Too early, trying again in 3s");
        await sleep(3e3);
        continue;
      }

      if (!res.ok) {
        // server error, try again in some
        console.log("Server error, trying again in 3s");
        await sleep(3e3);
        continue;
      }

      return (await res.json()) as { gameVersion: string };
    }
  }
}
