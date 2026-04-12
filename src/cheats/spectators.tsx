import { getGame, getOverlay, overlayRenderHooks } from "../filters";
import { entityAlive, isInMenus } from "../krunkerUtil";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import { Switch } from "../krunker-ui/components/Switch";


let connected = 0;
let alivePlayers = 0;
let lastPoll = 0;
let spectatorNames: string[] = [];

const POLL_INTERVAL = 2000;
const OVERLAY_TOP_TIMER_GAP = 12;
const KEYBINDS_OVERLAY_STACK_HEIGHT = 312;

let cachedTopAnchor = 0;
let isTopAnchorDirty = true;
let topHudObserver: MutationObserver | null = null;
let observedTopHudEl: HTMLElement | null = null;

function invalidateTopAnchor() {
  isTopAnchorDirty = true;
}

function ensureTopHudObserver() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;

  const topHudEl = document.getElementById("topLeftBottom") as HTMLElement | null;
  if (!topHudEl) return;

  if (observedTopHudEl === topHudEl && topHudObserver) return;

  if (topHudObserver) topHudObserver.disconnect();

  topHudObserver = new MutationObserver(() => {
    invalidateTopAnchor();
  });
  topHudObserver.observe(topHudEl, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });

  observedTopHudEl = topHudEl;
  invalidateTopAnchor();
}

if (typeof window !== "undefined") {
  window.addEventListener("resize", invalidateTopAnchor, { passive: true });
}

function getTopHudAnchorY() {
  if (typeof document === "undefined") return 0;
  ensureTopHudObserver();
  if (!isTopAnchorDirty) return cachedTopAnchor;

  const topLeftBottomEl =
    observedTopHudEl ??
    (document.getElementById("topLeftBottom") as HTMLElement | null);
  if (!topLeftBottomEl) return 0;

  let bottom = topLeftBottomEl.getBoundingClientRect().bottom;
  for (const el of topLeftBottomEl.querySelectorAll<HTMLElement>("*")) {
    if (el.offsetParent === null) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    if (rect.bottom > bottom) bottom = rect.bottom;
  }

  cachedTopAnchor = Math.round(bottom + OVERLAY_TOP_TIMER_GAP);
  isTopAnchorDirty = false;
  return cachedTopAnchor;
}

function getTopHudAnchorCanvasY(overlay: ReturnType<typeof getOverlay>) {
  const viewportY = getTopHudAnchorY();
  const canvasRect = overlay.canvas.getBoundingClientRect();
  // convert viewport pixels to overlay logical units (ctx is scaled by overlay.scale)
  return Math.round((viewportY - canvasRect.top) / overlay.scale);
}

export function spectatorsHook() {
  overlayRenderHooks.push(() => {
    if (!sketchConfig.get("spectatorsOverlay")) return;
    if (isInMenus()) return;

    const now = Date.now();
    if (now - lastPoll >= POLL_INTERVAL) {
      lastPoll = now;
      try {
        const gameId = getGameActivity().id;
        fetch(
          `https://matchmaker.krunker.io/game-info?game=${encodeURIComponent(gameId)}`,
          { method: "GET", credentials: "omit", mode: "cors" },
        )
          .then((r) => r.json())
          .then((data: unknown) => {
            if (Array.isArray(data) && typeof data[2] === "number") {
              connected = data[2];
            }
          })
          .catch(() => {});
      } catch {
        // game activity not ready
      }
      // snapshot alive player count on the same cadence as the poll
      try {
        const game = getGame();
        let count = 0;
        const names: string[] = [];
        for (const p of game.players.list) {
          if (entityAlive(p)) {
            count++;
          } else {
            const rawName =
              typeof p.getName === "function" ? p.getName() : p.name;
            const safeName = typeof rawName === "string" ? rawName.trim() : "";
            if (safeName) names.push(safeName);
          }
        }
        alivePlayers = count;
        spectatorNames = names;
      } catch {
        // game not ready
      }
    }

    if (connected === 0) return;

    const spectating = Math.max(0, connected - alivePlayers);
    const knownSpectatorNames = spectatorNames.slice(0, spectating);
    const unknownSpectators = Math.max(
      0,
      spectating - knownSpectatorNames.length,
    );

    const rows = [
      { label: "Spectating", value: String(spectating) },
      { label: "Alive", value: String(alivePlayers) },
      { label: "Connected", value: String(connected) },
    ];

    const spectatorLines = [
      ...knownSpectatorNames,
      ...(unknownSpectators > 0 ? [`+${unknownSpectators} unknown`] : []),
    ];

    const overlay = getOverlay();
    overlay.ctx.save();
    overlay.ctx.scale(overlay.scale, overlay.scale);

    const rowHeight = 36;
    const rowGap = 8;
    const boxPadding = 24;
    const listGap = 14;
    const listLineHeight = 18;
    const listHeaderHeight = spectatorLines.length > 0 ? 20 : 0;
    const listHeight =
      spectatorLines.length > 0
        ? listHeaderHeight + spectatorLines.length * listLineHeight
        : 0;
    const boxWidth = 200;
    const statsHeight = rowHeight * rows.length + rowGap * (rows.length - 1);
    const boxHeight =
      statsHeight + boxPadding + (listHeight > 0 ? listGap + listHeight : 0);
    const boxX = 10;
    const stackedOffset = sketchConfig.get("keybindOverlay")
      ? KEYBINDS_OVERLAY_STACK_HEIGHT
      : 0;
    const boxY = getTopHudAnchorCanvasY(overlay) + stackedOffset;

    overlay.ctx.fillStyle = "#202020e2";
    overlay.ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

    const contentX = boxX + boxPadding / 2;
    const contentY = boxY + boxPadding / 2;
    const boxInsetWidth = boxWidth - boxPadding;

    overlay.ctx.textBaseline = "middle";
    overlay.ctx.font = "14px 'gamefont'";

    for (let i = 0; i < rows.length; i++) {
      const rowY = contentY + i * (rowHeight + rowGap);
      const midY = rowY + rowHeight / 2;

      overlay.ctx.fillStyle = "#a5a5a5";
      overlay.ctx.textAlign = "left";
      overlay.ctx.fillText(rows[i].label, contentX, midY);

      const valWidth = overlay.ctx.measureText(rows[i].value).width + 16;
      const valX = contentX + boxInsetWidth - valWidth;

      overlay.ctx.fillStyle = "#888";
      overlay.ctx.fillRect(valX, rowY, valWidth, rowHeight);

      const border = 2;
      overlay.ctx.fillStyle = "#101010";
      overlay.ctx.fillRect(
        valX + border,
        rowY + border,
        valWidth - border * 2,
        rowHeight - border * 2,
      );

      overlay.ctx.textAlign = "left";
      overlay.ctx.fillStyle = "#fff";
      overlay.ctx.fillText(
        rows[i].value,
        valX + 8,
        midY,
      );
    }

    if (spectatorLines.length > 0) {
      const listY = contentY + statsHeight + listGap;

      overlay.ctx.textAlign = "left";
      overlay.ctx.fillStyle = "#cfcfcf";
      overlay.ctx.font = "13px 'gamefont'";
      overlay.ctx.fillText("Watching", contentX, listY + listHeaderHeight / 2);

      overlay.ctx.fillStyle = "#ffffff";
      overlay.ctx.font = "12px 'gamefont'";
      for (let i = 0; i < spectatorLines.length; i++) {
        const lineY = listY + listHeaderHeight + i * listLineHeight;
        overlay.ctx.fillText(
          spectatorLines[i],
          contentX,
          lineY + listLineHeight / 2,
        );
      }
    }

    overlay.ctx.restore();
  });
}

export function SpectatorsMenu() {
  const [spectatorsOverlay, setSpectatorsOverlay] =
    useSketchConfig("spectatorsOverlay");

  return (
    <Switch
      title="Spectators Overlay"
      description="Polls matchmaker every 2s and shows connected/spectating count on the left side of the screen."
      defaultChecked={spectatorsOverlay}
      onChange={(event) => setSpectatorsOverlay(event.currentTarget.checked)}
    />
  );
}
