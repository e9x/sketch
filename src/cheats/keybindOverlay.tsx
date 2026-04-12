import { getOverlay, overlayRenderHooks } from "../filters";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import { Switch } from "../krunker-ui/components/Switch";
import { getKeyName } from "../krunker-ui/keys";
import { isInMenus } from "../krunkerUtil";

const OVERLAY_TOP_TIMER_GAP = 12;
const TOP_ANCHOR_REFRESH_MS = 1000;

let cachedTopAnchor = 0;
let isTopAnchorDirty = true;
let topHudObserver: MutationObserver | null = null;
let observedTopHudEl: HTMLElement | null = null;
let topAnchorRefreshTimerStarted = false;

function invalidateTopAnchor() {
  isTopAnchorDirty = true;
}

function ensureTopAnchorRefreshTimer() {
  if (topAnchorRefreshTimerStarted) return;
  if (typeof window === "undefined") return;

  topAnchorRefreshTimerStarted = true;
  window.setInterval(invalidateTopAnchor, TOP_ANCHOR_REFRESH_MS);
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
  ensureTopAnchorRefreshTimer();
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

export function keybindOverlayHook() {
  overlayRenderHooks.push(() => {
    const overlay = getOverlay();
    overlay.ctx.save();
    overlay.ctx.scale(overlay.scale, overlay.scale);

    if (sketchConfig.get("keybindOverlay") && !isInMenus()) {
      const keybinds: { name: string; key: number }[] = [
        {
          name: "Menu",
          key: sketchConfig.get("menuKey"),
        },
        {
          name: "Aimkey",
          key: sketchConfig.get("aimKey"),
        },
        {
          name: "Aimbot Toggle",
          key: sketchConfig.get("toggleAimbotKey"),
        },
        {
          name: "Triggerbot",
          key: sketchConfig.get("triggerbotKey"),
        },
        {
          name: "Recoil Control",
          key: sketchConfig.get("recoilControlKey"),
        },
      ];

      const keyHeight = 48;
      const keyHeightGap = 8;

      const boxPadding = 24; // inset

      const boxWidth = 300;
      const boxHeight =
        keyHeight * keybinds.length +
        keyHeightGap * (keybinds.length - 1) +
        boxPadding;
      const boxX = 10;
      const boxY = getTopHudAnchorCanvasY(overlay);
      overlay.ctx.fillStyle = "#202020e2";
      overlay.ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

      const contentX = boxX + boxPadding / 2;
      const contentY = boxY + boxPadding / 2;
      const boxInsetWidth = boxWidth - boxPadding;

      overlay.ctx.textBaseline = "middle";
      overlay.ctx.font = "16px 'gamefont'";

      for (let i = 0; i < keybinds.length; i++) {
        const rowY = contentY + i * (keyHeight + keyHeightGap);
        const rowMidY = rowY + keyHeight / 2;

        overlay.ctx.fillStyle = "#a5a5a5";
        overlay.ctx.textAlign = "left";
        overlay.ctx.fillText(
          keybinds[i].name,
          contentX,
          rowMidY
        );

        const keyName = getKeyName(keybinds[i].key);
        const keyWidth = overlay.ctx.measureText(keyName).width + 20;
        const keyX = contentX + boxInsetWidth - keyWidth;

        overlay.ctx.fillStyle = "#888";
        overlay.ctx.fillRect(keyX, rowY, keyWidth, keyHeight);

        const border = 2;
        overlay.ctx.fillStyle = "#101010";
        overlay.ctx.fillRect(
          keyX + border,
          rowY + border,
          keyWidth - border * 2,
          keyHeight - border * 2
        );

        overlay.ctx.textAlign = "center";
        overlay.ctx.fillStyle = "#fff";
        overlay.ctx.fillText(
          keyName,
          keyX + keyWidth / 2,
          rowMidY
        );
      }
    }
    overlay.ctx.restore();
  });
}



export function KeybindOverlayMenu() {
  const [keybindOverlay, setKeybindOverlay] = useSketchConfig("keybindOverlay");

  return (
    <Switch
      title="Keybind Overlay"
      description="Shows an in-game overlay of a list of your keybinds"
      defaultChecked={keybindOverlay}
      onChange={(event) => setKeybindOverlay(event.currentTarget.checked)}
    />
  );
}
