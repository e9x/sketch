import sketchConfig, { useSketchConfig } from "../sketchConfig";
import { Switch } from "../krunker-ui/components/Switch";
import { encode, decode } from "msgpackr";
import * as jsonpack from "jsonpack";
import Mod from "./mod";
import { getExposedWindow } from "../consts";
import { mirrorAttributes } from "../hook";

  const mod = new Mod();

  export function skinHackHook() {
    return;
    
  if (!sketchConfig.get("skinHack")) return;
  const w = getExposedWindow();

  const ogW = w.WebSocket;

  type Handler = ((this: WebSocket, ev: MessageEvent) => any) | null;
  const handlers = new WeakMap<WebSocket, Handler>();

  const newW = mirrorAttributes(function WebSocket(
    this: WebSocket,
    ...args: any[]
  ) {
    const ws = Reflect.construct(ogW, args, new.target) as WebSocket;
    ws.onmessage = function (ev) {
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

      const handler = handlers.get(ws);
      if (handler)
        try {
          handler.call(ws, customEvent as MessageEvent);
        } catch (e) {
          console.error(e);
        }
      }

      return ws;
  }, ogW);

  if (sketchConfig.get("skinHack")) {
    w.WebSocket = newW;
    newW.prototype = ogW.prototype;

    const { send } = w.WebSocket.prototype;
    w.WebSocket.prototype.send = mirrorAttributes(function send(
      this: WebSocket,
      data: any,
    ) {
      if (sketchConfig.get("skinHack"))
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

      send.call(this, data);
    }, send);

    const { get, set } = Object.getOwnPropertyDescriptor(
      WebSocket.prototype,
      "onmessage",
    )!;
    Object.defineProperty(WebSocket.prototype, "onmessage", {
      get: mirrorAttributes(function (this: WebSocket, listener: Handler) {
        return handlers.get(this);
      }, get!),
      set: mirrorAttributes(function (this: WebSocket, listener: Handler) {
        handlers.set(this, listener);
      }, set!),
      configurable: true,
    });

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
          let skins: any = jsonpack.unpack(this.response);
          mod.onSkinsLoaded(skins);
        });
      }
    } as any;
  }
}

export function SkinHackMenu() {
  const [skinHack, setSkinHack] = useSketchConfig("skinHack");

  return <></>;
  return (
    <Switch
      title="Skin Hack"
      description="Unlocks all the skins. Your skins will only appear to you. They won't show to other players. You must be signed in."
      attention
      defaultChecked={skinHack}
      onChange={(event) => setSkinHack(event.currentTarget.checked)}
    />
  );
}
