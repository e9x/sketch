import { encode, decode } from "msgpackr";
import * as jsonpack from "jsonpack";
import Mod from "./mod";
// import sketchConfig from "../../sketchConfig";
import { getExposedWindow } from "consts";

export class Hook {
  init(mod: Mod) {
    const w = getExposedWindow();
    w.WebSocket = class Hooked extends w.WebSocket {
      _onmessage: null | (((this: WebSocket, ev: MessageEvent) => any) | null) =
        null;

      constructor(url: string, protocols?: string | string[]) {
        super(url, protocols);

        this.addEventListener("message", (ev) => {
          let customEvent = {
            isTrusted: true,
            data: ev.data,
          };

          try {
            let ab = ev.data as ArrayBuffer;
            let packet = decode(new Uint8Array(ab.slice(0, -2)));
            let sig = ab.slice(-2);

            let newPack = mod.onMessage(packet);
            let newPackEnc = new Uint8Array(encode(newPack));
            let newAbSig = new Uint8Array(newPackEnc.byteLength + 2);

            newAbSig.set(newPackEnc);
            newAbSig.set(new Uint8Array(sig), newPackEnc.byteLength);

            customEvent.data = newAbSig.buffer;
          } catch (e) {
            console.log(e);
          }

          try {
            this._onmessage?.call(this, customEvent as MessageEvent);
          } catch (e) {
            console.error(e);
          }
        });
      }

      set onmessage(
        listener: ((this: WebSocket, ev: MessageEvent) => any) | null,
      ) {
        this._onmessage = listener;
      }

      send(data: any) {
        // if (sketchConfig.get("skinHack"))
          try {
            let ab = data as ArrayBuffer;
            let packet = decode(new Uint8Array(ab.slice(0, -2)));
            let sig = ab.slice(-2);

            let newPack = mod.onSend(packet);
            let newPackEnc = new Uint8Array(encode(newPack));
            let newAbSig = new Uint8Array(newPackEnc.byteLength + 2);

            newAbSig.set(newPackEnc);
            newAbSig.set(new Uint8Array(sig), newPackEnc.byteLength);

            data = newAbSig.buffer;
          } catch (e) {
            console.log(e);
          }

        return super.send(data);
      }
    } as any;

    w.XMLHttpRequest = class Hooked extends w.XMLHttpRequest {
      open(
        method: string,
        url: string,
        async: boolean = true,
        user?: string,
        password?: string,
      ) {
        super.open(method, url, async, user, password);

        let urlObj = new URL(url, location.href);

        if (
          urlObj.hostname !== "gapi.svc.krunker.io" &&
          urlObj.pathname !== "/data/skins"
        )
          return;

        this.addEventListener("load", () => {
          let skins: any = jsonpack.unpack(
            this.response
          );
          mod.onSkinsLoaded(skins);
        });
      }
    } as any;
  }
}
