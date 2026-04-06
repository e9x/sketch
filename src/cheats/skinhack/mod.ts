import { getBox, getIO } from "../../filters";
import sketchConfig from "../../sketchConfig";

export default class Mod {
  // v9.1.1
  readonly PLAYER_LEN = 50;
  readonly MAX_HISTORY = 40; // Added memory limit constant
  readonly INDEX_MAP = [
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

  skins: any[] = [];
  savedIndexes: { [k: string]: number } = {};
  ownedIDs: any[] = [];
  username = "";

  static readonly STATIC_SECRET = [75, 82, 85, 78, 75, 51, 82, 95, 65, 67];

  private normalizeKey(key: any): string {
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

  private generateKeyStream(key: any, length: number): Uint8Array {
    const normalizedKey = this.normalizeKey(key);
    const stream = new Uint8Array(length);

    for (let i = 0; i < length; i++) {
      const keyByte = normalizedKey.charCodeAt(i % normalizedKey.length);
      const secretByte = Mod.STATIC_SECRET[i % Mod.STATIC_SECRET.length];
      stream[i] = ((keyByte ^ secretByte) + i) & 0xff;
    }

    return stream;
  }

  private decryptPayload(base64Data: string, seed: any): string {
    const decoded =
      typeof Buffer !== "undefined"
        ? new Uint8Array(Buffer.from(base64Data, "base64"))
        : new Uint8Array(
            atob(base64Data)
              .split("")
              .map((c) => c.charCodeAt(0)),
          );

    const keyStream = this.generateKeyStream(seed, decoded.length);
    const decrypted = new Uint8Array(decoded.length);

    for (let i = 0; i < decoded.length; i++) {
      decrypted[i] = decoded[i] ^ keyStream[i];
    }

    return new TextDecoder().decode(decrypted);
  }

  // Track rolling conversation history
  chatHistory: { role: string; content: string }[] = [];

  setterFunc(obj: any, key: string, value?: any) {
    let split = key.split(".");
    for (let i = 0; i < split.length - 1; i++) {
      obj = obj[split[i]];
    }
    if (value) obj[split[split.length - 1]] = value;
    return obj[split[split.length - 1]];
  }

  onSkinsLoaded(skins: any[]) {
    this.skins = skins;
  }

  onMessage(packet: any) {
    // === ANTI-CHEAT INTERCEPT LOGIC ===
    if (packet?.[0] === "cc") {
      const seed = packet[1];
      const payload = packet[3];
      if (
        (typeof seed === "string" || typeof seed === "number") &&
        typeof payload === "string"
      ) {
        try {
          const decryptedCode = this.decryptPayload(payload, seed);
          console.log("[Anti-Cheat] Intercepted CC Payload:\n", decryptedCode);

          // Report to KrunkBox server
          getBox()
            .reportCC(decryptedCode)
            .catch((err) =>
              console.error("[Anti-Cheat] Failed to report CC:", err),
            );
        } catch (e) {
          console.error("[Anti-Cheat] Failed to decrypt/report CC payload:", e);
        }
      }
    }

    // === AI AUTO-REPLY LOGIC WITH LOGGING ===
    if (packet[0] === "ch") {
      const [, senderId, senderName, message] = packet;

      const isAiEnabled = sketchConfig.get("aiReply");
      const isNotSelf = senderName !== this.username;
      const isPlayerChat = senderId === 0;

      // Log the incoming message for visibility
      console.log(`[Chat] ${senderName} (ID: ${senderId}): ${message}`);

      // Push incoming chat to history if it is from another player
      if (isPlayerChat && isNotSelf) {
        this.chatHistory.push({
          role: "user",
          content: `${senderName} says: ${message}`,
        });

        // Ensure history does not exceed the limit
        if (this.chatHistory.length > this.MAX_HISTORY) {
          this.chatHistory.shift();
        }
      }

      if (isAiEnabled && isNotSelf && isPlayerChat) {
        const endpoint = sketchConfig.get("aiEndpoint");
        const key = sketchConfig.get("aiKey");
        const prompt = sketchConfig.get("aiPrompt");
        const model = sketchConfig.get("aiModel");

        console.log(`[AI] Triggering reply for ${senderName}...`);

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
              ...this.chatHistory, // Spread the rolling history into the payload
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
              console.log(`[AI] Response generated: "${aiResponse}"`);

              // Append the AI's generated response to the chat history
              this.chatHistory.push({ role: "assistant", content: aiResponse });
              if (this.chatHistory.length > this.MAX_HISTORY) {
                this.chatHistory.shift();
              }

              try {
                const io = getIO();
                if (io && typeof io.send === "function") {
                  io.send("ct", 0, aiResponse);
                  console.log(`[AI] Message sent to socket.`);
                } else {
                  console.warn(
                    `[AI] IO Socket not found or send() is missing.`,
                  );
                }
              } catch (err) {
                console.error("[AI] Socket error:", err);
              }
            } else {
              console.warn("[AI] API returned an empty response.", data);
            }
          })
          .catch((err) => console.error("[AI] API/Fetch error:", err));
      } else {
        // Log reasons for skipping if AI is enabled but conditions weren't met
        if (isAiEnabled) {
          if (!isNotSelf) console.log("[AI] Skipping: Message sent by self.");
          if (!isPlayerChat)
            console.log(
              `[AI] Skipping: Message type ${senderId} is not player chat.`,
            );
        }
      }
    }

    // === SKIN HACK LOGIC (UNCHANGED) ===
    if (!sketchConfig.get("skinHack")) return packet;

    let isUpdateAccount = packet?.[0] === "ua";
    if (packet?.[0] === "a" || isUpdateAccount) {
      if (!isUpdateAccount) this.username = packet[3];
      let data = packet[isUpdateAccount ? 1 : 4];
      if (data?.[10]) {
        this.ownedIDs = data[10].map((x: any) => x.ind);
        data[10] = Array.from({ length: this.skins.length }, (_, i) => ({
          ind: i,
          cnt: 1,
          a: "",
        }));
      }
    }

    if (packet?.[0] === "0" && packet?.[1]) {
      let allPlayers = packet[1];
      if (allPlayers.length % this.PLAYER_LEN === 0) {
        for (let i = 0; i < allPlayers.length; i += this.PLAYER_LEN) {
          let playerChunk = allPlayers.slice(i, i + this.PLAYER_LEN);
          if (playerChunk[5] === this.username) {
            for (let k in this.savedIndexes) {
              let mapping = this.INDEX_MAP.find((x) => x[0] === k)?.[1] || "";
              if (mapping)
                this.setterFunc(playerChunk, mapping, this.savedIndexes[k]);
            }
            allPlayers.splice(i, this.PLAYER_LEN, ...playerChunk);
          }
        }
      }
    }

    return packet;
  }

  onSend(packet: any) {
    if (!sketchConfig.get("skinHack")) return packet;
    if (packet?.[0] === "en" && packet[1]) {
      for (let i = 0; i < this.INDEX_MAP.length; i++) {
        let id = this.setterFunc(packet[1], this.INDEX_MAP[i][0]);
        this.savedIndexes[this.INDEX_MAP[i][0]] = id ?? -1;
        this.setterFunc(
          packet[1],
          this.INDEX_MAP[i][0],
          this.ownedIDs.includes(id) ? id : -1,
        );
      }
    }
    return packet;
  }
}
