import { encode, decode } from "msgpackr";
import { getBox, getGame, getIO, onGameHooks, onIoHooks } from "../filters";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import { Switch } from "../krunker-ui/components/Switch";

// v9.1.1
const PLAYER_LEN = 50;
const MAX_HISTORY = 40;
const STATIC_SECRET = [75, 82, 85, 78, 75, 51, 82, 95, 65, 67];

// maps skin indexes between the packet formats
const INDEX_MAP = [
  ["1"],
  ["2.0", "12.0"],
  ["2.1", "12.1"],
  ["3", "13"],
  ["4", "14"],
  ["9", "19"],
  ["14", "24"],
  ["15", "29"],
  ["16", "30"],
  ["20", "33"],
  ["21", "34"],
  ["25", "36"],
  ["29.0", "39.0"],
  ["29.1", "39.1"],
  ["30", "41"],
  ["31", "42"],
  ["32"],
];

let skins: any[] = [];
let savedIndexes: { [k: string]: number } = {};
let ownedIDs: any[] = [];
let username = "";
let chatHistory: { role: string; content: string }[] = [];

function normalizeKey(key: any): string {
  if (typeof key === "string") return key;
  if (
    typeof key === "number" ||
    typeof key === "bigint" ||
    typeof key === "boolean"
  ) {
    return String(key);
  }
  if (key == null) return "";
  return JSON.stringify(key);
}

function generateKeyStream(key: any, length: number): Uint8Array {
  const nk = normalizeKey(key);
  const stream = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    const keyByte = nk.charCodeAt(i % nk.length);
    const secretByte = STATIC_SECRET[i % STATIC_SECRET.length];
    stream[i] = ((keyByte ^ secretByte) + i) & 0xff;
  }

  return stream;
}

function decryptPayload(base64Data: string, seed: any): string {
  const decoded =
    typeof Buffer !== "undefined"
      ? new Uint8Array(Buffer.from(base64Data, "base64"))
      : new Uint8Array(
          atob(base64Data)
            .split("")
            .map((c) => c.charCodeAt(0)),
        );

  const keyStream = generateKeyStream(seed, decoded.length);
  const decrypted = new Uint8Array(decoded.length);

  for (let i = 0; i < decoded.length; i++) {
    decrypted[i] = decoded[i] ^ keyStream[i];
  }

  return new TextDecoder().decode(decrypted);
}

// nested property access with dot notation, optionally sets value
function setterFunc(obj: any, key: string, value?: any) {
  const split = key.split(".");
  for (let i = 0; i < split.length - 1; i++) {
    obj = obj[split[i]];
  }
  if (value) obj[split[split.length - 1]] = value;
  return obj[split[split.length - 1]];
}

function onMessage(packet: any) {
  // intercept anti-cheat packets
  if (packet?.[0] === "cc") {
    const seed = packet[1];
    const payload = packet[3];
    if (
      (typeof seed === "string" || typeof seed === "number") &&
      typeof payload === "string"
    ) {
      try {
        const decryptedCode = decryptPayload(payload, seed);
        getBox()
          .reportCC(decryptedCode)
          .catch((err) => console.error("cc report:", err));
      } catch (e) {
        console.error("cc decrypt fail:", e);
      }
    }
  }

  // ai auto-reply
  if (packet[0] === "ch") {
    const [, senderId, senderName, message] = packet;

    const isAiEnabled = sketchConfig.get("aiReply");
    const isNotSelf = senderName !== username;
    const isPlayerChat = senderId === 0;

    if (isPlayerChat && isNotSelf) {
      chatHistory.push({
        role: "user",
        content: `${senderName} says: ${message}`,
      });

      if (chatHistory.length > MAX_HISTORY) {
        chatHistory.shift();
      }
    }

    if (isAiEnabled && isNotSelf && isPlayerChat) {
      const endpoint = sketchConfig.get("aiEndpoint");
      const key = sketchConfig.get("aiKey");
      const prompt = sketchConfig.get("aiPrompt");
      const model = sketchConfig.get("aiModel");

      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: prompt },
            ...chatHistory,
          ],
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
          return res.json();
        })
        .then((data) => {
          const aiResponse = data.choices?.[0]?.message?.content;

          if (aiResponse) {
            chatHistory.push({ role: "assistant", content: aiResponse });
            if (chatHistory.length > MAX_HISTORY) {
              chatHistory.shift();
            }

            try {
              getIO().send("ct", 0, aiResponse);
            } catch (err) {
              console.error("ai send:", err);
            }
          } else {
            console.warn("ai: empty response", data);
          }
        })
        .catch((err) => console.error("ai fetch:", err));
    }
  }

  // skin hack: spoof inventory + player skin data
  if (!sketchConfig.get("skinHack")) return packet;

  const isUpdateAccount = packet?.[0] === "ua";
  if (packet?.[0] === "a" || isUpdateAccount) {
    if (!isUpdateAccount) username = packet[3];
    const data = packet[isUpdateAccount ? 1 : 4];
    if (data?.[10]) {
      ownedIDs = data[10].map((x: any) => x.ind);
      data[10] = Array.from({ length: skins.length }, (_, i) => ({
        ind: i,
        cnt: 1,
        a: "",
      }));
    }
  }

  if (packet?.[0] === "0" && packet?.[1]) {
    const allPlayers = packet[1];
    if (allPlayers.length % PLAYER_LEN === 0) {
      for (let i = 0; i < allPlayers.length; i += PLAYER_LEN) {
        const playerChunk = allPlayers.slice(i, i + PLAYER_LEN);
        if (playerChunk[5] === username) {
          for (const k in savedIndexes) {
            const mapping = INDEX_MAP.find((x) => x[0] === k)?.[1] || "";
            if (mapping) setterFunc(playerChunk, mapping, savedIndexes[k]);
          }
          allPlayers.splice(i, PLAYER_LEN, ...playerChunk);
        }
      }
    }
  }

  return packet;
}

function onSend(packet: any) {
  if (!sketchConfig.get("skinHack")) return packet;
  if (packet?.[0] === "en" && packet[1]) {
    for (let i = 0; i < INDEX_MAP.length; i++) {
      const id = setterFunc(packet[1], INDEX_MAP[i][0]);
      savedIndexes[INDEX_MAP[i][0]] = id ?? -1;
      setterFunc(
        packet[1],
        INDEX_MAP[i][0],
        ownedIDs.includes(id) ? id : -1,
      );
    }
  }
  return packet;
}

// hooks into the websocket to intercept + modify packets
export function skinHackHook() {
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
        const packet = decode(new Uint8Array(ab.slice(0, -2)));
        const sig = ab.slice(-2);

        const newPack = onMessage(packet);
        const newPackEnc = new Uint8Array(encode(newPack));
        const newAbSig = new Uint8Array(newPackEnc.byteLength + 2);

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
        const ab = data as ArrayBuffer;
        const packet = decode(new Uint8Array(ab.slice(0, -2)));
        const sig = ab.slice(-2);

        const newPack = onSend(packet);
        const newPackEnc = new Uint8Array(encode(newPack));
        const newAbSig = new Uint8Array(newPackEnc.byteLength + 2);

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
    skins = getGame().store.skins;
  });
}

export function SkinHackMenu() {
  const [skinHack, setSkinHack] = useSketchConfig("skinHack");

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
