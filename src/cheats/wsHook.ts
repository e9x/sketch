import { encode, decode } from "msgpackr";
import { isDevelopment } from "../consts";
import { console } from "../crashout";
import { mirrorAttributes } from "../hook";
import { onIoHooks } from "../filters";

// Passive observers — called with the decoded incoming packet before drop/transform.
export const onMessageObservers: ((packet: any) => void)[] = [];

// Drop filters — return true to swallow the packet entirely before the game sees it.
export const messageDropFilters: ((packet: any) => boolean)[] = [];

// Transformers — called in sequence after drop check. Return null to drop, or return the (possibly mutated) packet.
export const onMessageTransformers: ((packet: any) => any | null)[] = [];

// Outgoing send transformers — called in sequence on the decoded outgoing packet.
export const onSendTransformers: ((packet: any) => any)[] = [];

// Single WebSocket hook — decodes each packet once, runs all observers/filters/transformers, then re-encodes.
export function wsHook() {
  onIoHooks.push((ws) => {
    let _onmessage:
      | null
      | (((this: WebSocket, ev: MessageEvent) => any) | null) = null;

    ws.addEventListener("message", (ev) => {
      const customEvent = {
        isTrusted: true,
        data: ev.data,
      };

      try {
        const ab = ev.data as ArrayBuffer;
        let packet = decode(new Uint8Array(ab.slice(0, -2)));
        const sig = ab.slice(-2);

        for (const obs of onMessageObservers) obs(packet);

        for (const filter of messageDropFilters) {
          if (filter(packet)) return;
        }

        for (const transformer of onMessageTransformers) {
          const result = transformer(packet);
          if (result === null) return;
          packet = result;
        }

        const newPackEnc = new Uint8Array(encode(packet));
        const newAbSig = new Uint8Array(newPackEnc.byteLength + 2);
        newAbSig.set(newPackEnc);
        newAbSig.set(new Uint8Array(sig), newPackEnc.byteLength);
        customEvent.data = newAbSig.buffer;
      } catch (e) {
        if (isDevelopment) console.error(e);
      }

      try {
        // @ts-ignore
        _onmessage?.call(ws, customEvent as MessageEvent);
      } catch (e) {
        if (isDevelopment) console.error(e);
      }
    });

    Object.defineProperty(ws, "onmessage", {
      set: (v) => (_onmessage = v),
    });

    const { send } = ws;

    ws.send = mirrorAttributes(function (this: any, data: any) {
      try {
        const ab = data as ArrayBuffer;
        let packet = decode(new Uint8Array(ab.slice(0, -2)));
        const sig = ab.slice(-2);

        for (const transformer of onSendTransformers) {
          packet = transformer(packet);
        }

        const newPackEnc = new Uint8Array(encode(packet));
        const newAbSig = new Uint8Array(newPackEnc.byteLength + 2);
        newAbSig.set(newPackEnc);
        newAbSig.set(new Uint8Array(sig), newPackEnc.byteLength);
        data = newAbSig.buffer;
      } catch (e) {
        if (isDevelopment) console.error(e);
      }

      return send.call(this, data);
    } as typeof send, send);
  });
}
