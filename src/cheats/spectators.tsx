import { getGame, getIO, getOverlay, overlayRenderHooks } from "../filters";
import { entityAlive, isInMenus } from "../krunkerUtil";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import { Switch } from "../krunker-ui/components/Switch";
import { messageDropFilters, onMessageObservers, onSendTransformers } from "./wsHook";

let connected = 0;
let alivePlayers = 0;
let lastPoll = 0;
let pendingScriptConnectedResponses = 0;
let pendingUserConnectedResponses = 0;
let isOverlaySendingConnected = false;

const POLL_INTERVAL = 10000;

export function spectatorsHook() {
  onSendTransformers.push((packet) => {
    if (packet?.[0] !== "ct") return packet;
    if (packet[2] !== "/c") return packet;

    if (isOverlaySendingConnected) pendingScriptConnectedResponses++;
    else pendingUserConnectedResponses++;

    return packet;
  });

  // suppress the /c response from appearing in game chat
  messageDropFilters.push((packet) => {
    if (packet?.[0] !== "chi") return false;
    const args = packet[3];
    if (!Array.isArray(args) || args[0] !== "commands.connected") return false;

    // Keep manual /c chat responses visible.
    if (pendingUserConnectedResponses > 0) {
      pendingUserConnectedResponses--;
      return false;
    }

    // Suppress only overlay-initiated /c responses.
    if (pendingScriptConnectedResponses > 0) {
      pendingScriptConnectedResponses--;
      return true;
    }

    return false;
  });

  onMessageObservers.push((packet) => {
    if (packet?.[0] !== "chi") return;
    const args = packet[3];
    if (!Array.isArray(args) || args[0] !== "commands.connected") return;
    if (typeof args[1] === "number") connected = args[1];
  });

  overlayRenderHooks.push(() => {
    if (!sketchConfig.get("spectatorsOverlay")) return;
    if (isInMenus()) return;

    const now = Date.now();
    if (now - lastPoll >= POLL_INTERVAL) {
      lastPoll = now;
      try {
        isOverlaySendingConnected = true;
        getIO().send("ct", 0, "/c");
      } catch {
        // not connected yet
      } finally {
        isOverlaySendingConnected = false;
      }
      // snapshot alive player count on the same cadence as the /c poll
      try {
        const game = getGame();
        let count = 0;
        for (const p of game.players.list) {
          if (entityAlive(p)) count++;
        }
        alivePlayers = count;
      } catch {
        // game not ready
      }
    }

    if (connected === 0) return;

    const spectating = Math.max(0, connected - alivePlayers);

    const rows = [
      { label: "Spectating", value: String(spectating) },
      { label: "Alive", value: String(alivePlayers) },
      { label: "Connected", value: String(connected) },
    ];

    const overlay = getOverlay();
    overlay.ctx.scale(overlay.scale, overlay.scale);

    const height = overlay.canvas.height / overlay.scale;

    const rowHeight = 36;
    const rowGap = 8;
    const boxPadding = 24;
    const boxWidth = 200;
    const boxHeight = rowHeight * rows.length + rowGap * (rows.length - 1) + boxPadding;
    const boxX = 10;
    const boxY = height / 2 + 10;

    overlay.ctx.fillStyle = "#202020e2";
    overlay.ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

    const contentX = boxX + boxPadding / 2;
    const contentY = boxY + boxPadding / 2;
    const boxInsetWidth = boxWidth - boxPadding;

    overlay.ctx.textBaseline = "middle";
    overlay.ctx.font = "14px 'gamefont'";

    const metrics = overlay.ctx.measureText("");
    const fontHeight = metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent;

    for (let i = 0; i < rows.length; i++) {
      const rowY = contentY + i * (rowHeight + rowGap);
      const midY = rowY + rowHeight / 2 + fontHeight;

      overlay.ctx.fillStyle = "#a5a5a5";
      overlay.ctx.textAlign = "left";
      overlay.ctx.fillText(rows[i].label, contentX, midY);

      const valWidth = overlay.ctx.measureText(rows[i].value).width + 16;
      const valX = contentX + boxInsetWidth - valWidth;

      overlay.ctx.fillStyle = "#888";
      overlay.ctx.fillRect(valX, rowY, valWidth, rowHeight);

      const border = 2;
      overlay.ctx.fillStyle = "#101010";
      overlay.ctx.fillRect(valX + border, rowY + border, valWidth - border * 2, rowHeight - border * 2);

      overlay.ctx.textAlign = "center";
      overlay.ctx.fillStyle = "#fff";
      overlay.ctx.fillText(rows[i].value, valX + valWidth / 2, rowY + (rowHeight - 10) / 2 + fontHeight);
    }

    overlay.ctx.scale(1 / overlay.scale, 1 / overlay.scale);
    overlay.ctx.textAlign = "left";
    overlay.ctx.textBaseline = "alphabetic";
  });
}

export function SpectatorsMenu() {
  const [spectatorsOverlay, setSpectatorsOverlay] =
    useSketchConfig("spectatorsOverlay");

  return (
    <Switch
      title="Spectators Overlay"
      description="Polls /c every 10s and shows connected/spectating count on the left side of the screen."
      defaultChecked={spectatorsOverlay}
      onChange={(event) => setSpectatorsOverlay(event.currentTarget.checked)}
    />
  );
}
