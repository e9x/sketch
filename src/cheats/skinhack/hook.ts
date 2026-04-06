import { encode, decode } from "msgpackr";
import Mod from "./mod";
import { getGame, onGameHooks, onIoHooks } from "../../filters";

export class Hook {
  init(mod: Mod) {
    onIoHooks.push((ws) => {
      let _onmessage:
        | null
        | (((this: WebSocket, ev: MessageEvent) => any) | null) = null;

      ws.addEventListener("message", (ev) => {
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
          console.error(e);
        }

        try {
          // @ts-ignore
          _onmessage?.call(ws, customEvent as MessageEvent);
        } catch (e) {
          console.error(e);
        }
      });

      Object.defineProperty(ws, "onmessage", {
        set: (v) => (_onmessage = v),
      });

      const { send } = ws;

      ws.send = function (data) {
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
          console.error(e);
        }

        return send.call(this, data);
      };
    });

    onGameHooks.push(() => {
      mod.onSkinsLoaded(getGame().store.skins);
    });
  }
}
