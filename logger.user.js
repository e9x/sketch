// ==UserScript==
// @name         Krunker Packet Logger
// @namespace    https://forum.sys32.dev/
// @icon         https://y9x.github.io/webpack/libs/gg.gif
// @version      1.0
// @match        https://krunker.io/*
// @match        https://*.browserfps.com/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/msgpack-lite/0.1.26/msgpack.min.js
// @run-at       document-start
// @grant        unsafeWindow
// @noframes
// ==/UserScript==

const signaturePadding = 2;

class HookedWebSocket extends WebSocket {
  constructor(...args) {
    super(...args);

    console.info("Outgoing packets will be shown in the `info` tab");
    console.debug("Incoming packets will be shown in the `verbose` tab");

    this.addEventListener("message", async ({ data }) => {
      if (!(data instanceof ArrayBuffer))
        throw new TypeError("Expected ArrayBuffer");

      const decoded = msgpack.decode(new Uint8Array(data));
      if (!Array.isArray(decoded)) throw new TypeError("Expected array");

      console.info("%c <= ", "background:#FF6A19;color:#000", decoded);
    });
  }
  send(packet) {
    const signature = packet.slice(-signaturePadding);
    const decoded = msgpack.decode(packet.slice(0, -signaturePadding));
    console.debug("%c => ", "background:#7F7;color:#000", decoded);
    return super.send(
      Uint8Array.from([...msgpack.encode(decoded), ...signature])
    );
  }
}

unsafeWindow.WebSocket = HookedWebSocket;
